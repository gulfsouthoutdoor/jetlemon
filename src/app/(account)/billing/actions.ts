"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanKey, stripe } from "@/lib/stripe";

async function origin() {
  return (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

const asPlan = (v: unknown): PlanKey => (v === "pro" ? "pro" : "starter");

/** New subscriber: Stripe Checkout for the chosen plan. Existing subscriber: switch plans in place. */
export async function choosePlan(fd: FormData) {
  const { org, user, role } = await getContext();
  if (role !== "owner") redirect("/billing?error=Only+the+account+owner+can+manage+billing");
  const plan = asPlan(fd.get("plan"));
  const price = PLANS[plan];
  if (!price.priceId) redirect(`/billing?error=${encodeURIComponent(`${price.name} is not set up on this server yet.`)}`);

  // Already paying: change the subscription's price (prorated), no new checkout.
  if (org.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      const item = sub.items.data[0];
      if (item && item.price.id !== price.priceId) {
        await stripe.subscriptions.update(sub.id, {
          items: [{ id: item.id, price: price.priceId }],
          proration_behavior: "create_prorations",
        });
      }
      // The webhook updates plan; set it now too so the page reflects it immediately.
      await createAdminClient().from("organizations").update({ plan }).eq("id", org.id);
    } catch (err) {
      redirect(`/billing?error=${encodeURIComponent((err as Error).message)}`);
    }
    redirect("/billing?success=1");
  }

  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: org.name, metadata: { org_id: org.id } });
    customerId = customer.id;
    await createAdminClient().from("organizations").update({ stripe_customer_id: customerId }).eq("id", org.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: price.priceId, quantity: 1 }],
    client_reference_id: org.id,
    subscription_data: { metadata: { org_id: org.id, plan } },
    allow_promotion_codes: true,
    success_url: `${await origin()}/billing?success=1`,
    cancel_url: `${await origin()}/billing`,
  });
  redirect(session.url!);
}

/** Kept for any old links: defaults to Starter. */
export async function startCheckout() {
  const fd = new FormData();
  fd.set("plan", "starter");
  return choosePlan(fd);
}

export async function openPortal() {
  const { org } = await getContext();
  if (!org.stripe_customer_id) redirect("/billing");
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${await origin()}/billing`,
  });
  redirect(session.url);
}
