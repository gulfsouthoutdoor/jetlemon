import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { planForPrice, stripe } from "@/lib/stripe";

// Keeps organizations.subscription_status in sync with Stripe.
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.client_reference_id && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const plan = planForPrice(sub.items.data[0]?.price.id) ?? "starter";
      await admin
        .from("organizations")
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          subscription_status: "active",
          plan,
        })
        .eq("id", session.client_reference_id);
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "customer.subscription.created") {
    const sub = event.data.object as Stripe.Subscription;
    const status =
      sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "past_due" || sub.status === "unpaid" ? "past_due" : "canceled";
    const plan = planForPrice(sub.items.data[0]?.price.id);
    await admin
      .from("organizations")
      .update({ stripe_subscription_id: sub.id, subscription_status: status, ...(plan ? { plan } : {}) })
      .eq("stripe_customer_id", sub.customer as string);
  }

  return NextResponse.json({ received: true });
}
