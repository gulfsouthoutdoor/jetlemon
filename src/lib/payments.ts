import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { stopRuns } from "@/lib/sequences";
import type { Organization } from "@/lib/types";

/**
 * Pay online. Each business connects its own Stripe account (Stripe Connect, "standard" type):
 * the money, payouts and disputes are theirs, JetLemon just creates the checkout. No platform fee
 * unless PLATFORM_FEE_PERCENT is set.
 */
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://jetlemon.com";
export const payUrl = (payToken: string) => `${siteUrl()}/pay/${payToken}`;
export const connectConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** Starts (or resumes) Stripe onboarding for a business. Returns the URL to send the owner to. */
export async function startConnect(admin: SupabaseClient, org: Organization, email: string | null) {
  let accountId = org.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      email: email ?? undefined,
      business_profile: { name: org.name, url: org.website ?? undefined },
      metadata: { org_id: org.id },
    });
    accountId = account.id;
    await admin.from("organizations").update({ stripe_account_id: accountId }).eq("id", org.id);
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${siteUrl()}/api/stripe/connect?refresh=1`,
    return_url: `${siteUrl()}/api/stripe/connect?return=1`,
  });
  return link.url;
}

/** Asks Stripe whether the connected account can take card payments yet, and remembers the answer. */
export async function refreshConnect(admin: SupabaseClient, org: Pick<Organization, "id" | "stripe_account_id">) {
  if (!org.stripe_account_id) return false;
  const account = await stripe.accounts.retrieve(org.stripe_account_id);
  const enabled = Boolean(account.charges_enabled);
  await admin.from("organizations").update({ stripe_charges_enabled: enabled }).eq("id", org.id);
  return enabled;
}

export type PayableInvoice = {
  id: string;
  org_id: string;
  number: number;
  status: string;
  customer_email: string | null;
  items: { description: string; quantity: number; unit_price: number }[];
};

/** Creates a Stripe Checkout session on the business's own account for this invoice. */
export async function createInvoiceCheckout(admin: SupabaseClient, org: Pick<Organization, "id" | "name" | "stripe_account_id">, inv: PayableInvoice, payToken: string) {
  if (!org.stripe_account_id) throw new Error("This business hasn't connected Stripe yet.");
  const line_items = inv.items
    .filter((it) => Number(it.quantity) * Number(it.unit_price) > 0)
    .map((it) => ({
      quantity: Math.max(1, Math.round(Number(it.quantity))),
      price_data: {
        currency: "usd",
        product_data: { name: it.description || `Invoice #${inv.number}` },
        // Stripe wants whole cents per unit; fractional quantities are folded into the unit price.
        unit_amount: Math.round((Number(it.quantity) * Number(it.unit_price) * 100) / Math.max(1, Math.round(Number(it.quantity)))),
      },
    }));
  if (!line_items.length) throw new Error("This invoice has nothing to pay.");
  const total = inv.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const feePct = Number(process.env.PLATFORM_FEE_PERCENT ?? 0);

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items,
      customer_email: inv.customer_email ?? undefined,
      success_url: `${payUrl(payToken)}?paid=1`,
      cancel_url: payUrl(payToken),
      metadata: { invoice_id: inv.id, org_id: org.id },
      payment_intent_data: {
        description: `Invoice #${inv.number} — ${org.name}`,
        ...(feePct > 0 ? { application_fee_amount: Math.round(total * 100 * (feePct / 100)) } : {}),
      },
    },
    { stripeAccount: org.stripe_account_id },
  );
  await admin.from("invoices").update({ stripe_checkout_session_id: session.id }).eq("id", inv.id);
  return session.url!;
}

/**
 * If a checkout was started for this invoice, asks Stripe whether it was paid and marks the invoice.
 * Called whenever the pay page or the invoice page loads, so no Connect webhook is needed.
 */
export async function syncInvoicePayment(admin: SupabaseClient, inv: { id: string; status: string; stripe_checkout_session_id: string | null }, stripeAccountId: string | null) {
  if (inv.status === "paid" || !inv.stripe_checkout_session_id || !stripeAccountId) return inv.status;
  try {
    const session = await stripe.checkout.sessions.retrieve(inv.stripe_checkout_session_id, {}, { stripeAccount: stripeAccountId });
    if (session.payment_status === "paid") {
      await admin
        .from("invoices")
        .update({ status: "paid", paid_on: new Date().toISOString().slice(0, 10), paid_via: "card" })
        .eq("id", inv.id)
        .neq("status", "paid");
      await stopRuns(admin, { invoiceId: inv.id }, "paid online");
      return "paid";
    }
  } catch {
    // Stripe hiccup: leave it; the next page load tries again.
  }
  return inv.status;
}
