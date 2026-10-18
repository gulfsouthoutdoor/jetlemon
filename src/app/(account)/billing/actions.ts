"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN, stripe } from "@/lib/stripe";

async function origin() {
  return (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function startCheckout() {
  const { org, user, role } = await getContext();
  if (role !== "owner") redirect("/billing?error=Only+the+account+owner+can+manage+billing");

  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: org.name, metadata: { org_id: org.id } });
    customerId = customer.id;
    await createAdminClient().from("organizations").update({ stripe_customer_id: customerId }).eq("id", org.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: PLAN.priceId, quantity: 1 }],
    client_reference_id: org.id,
    subscription_data: { metadata: { org_id: org.id } },
    success_url: `${await origin()}/billing?success=1`,
    cancel_url: `${await origin()}/billing`,
  });
  redirect(session.url!);
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
