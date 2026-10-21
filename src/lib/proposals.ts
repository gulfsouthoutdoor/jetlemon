import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, emailConfigured } from "@/lib/email";
import { money } from "@/lib/format";
import { stripe } from "@/lib/stripe";
import { stopRuns } from "@/lib/sequences";
import { sendBusinessText } from "@/lib/texting";
import type { Organization, ProposalItem } from "@/lib/types";

/** Proposals: a priced offer the customer accepts online. Reuses the invoice and payment plumbing. */
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://jetlemon.com";
export const proposalUrl = (token: string) => `${siteUrl()}/p/${token}`;

type Line = Pick<ProposalItem, "quantity" | "unit_price" | "optional" | "selected">;
const lineTotal = (it: Line) => Number(it.quantity) * Number(it.unit_price);

/** Total of required items plus the optional ones the customer kept. */
export const proposalTotal = (items: Line[]) => items.filter((it) => !it.optional || it.selected).reduce((s, it) => s + lineTotal(it), 0);
/** Everything if they said yes to every option. */
export const proposalMax = (items: Line[]) => items.reduce((s, it) => s + lineTotal(it), 0);
export const depositAmount = (items: Line[], percent: number) => Math.round(proposalTotal(items) * percent) / 100;

export function isExpired(p: { status: string; valid_until: string | null }) {
  return p.status === "sent" && Boolean(p.valid_until) && new Date(p.valid_until!) < new Date(new Date().toDateString());
}

/** Stripe Checkout for the deposit, on the business's own account. */
export async function createDepositCheckout(
  admin: SupabaseClient,
  org: Pick<Organization, "id" | "name" | "stripe_account_id">,
  p: { id: string; number: number; title: string; customer_email: string | null; pay_token: string },
  amount: number,
) {
  if (!org.stripe_account_id) throw new Error("This business hasn't connected Stripe yet.");
  if (amount <= 0) throw new Error("There is no deposit to pay.");
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(amount * 100), product_data: { name: `Deposit — ${p.title || `Proposal #${p.number}`}` } } }],
      customer_email: p.customer_email ?? undefined,
      success_url: `${proposalUrl(p.pay_token)}?paid=1`,
      cancel_url: proposalUrl(p.pay_token),
      metadata: { proposal_id: p.id, org_id: org.id },
      payment_intent_data: { description: `Deposit for proposal #${p.number} — ${org.name}` },
    },
    { stripeAccount: org.stripe_account_id },
  );
  await admin.from("proposals").update({ stripe_checkout_session_id: session.id }).eq("id", p.id);
  return session.url!;
}

/** Asks Stripe whether a started deposit checkout was paid, and records it. */
export async function syncDeposit(admin: SupabaseClient, p: { id: string; deposit_paid_on: string | null; stripe_checkout_session_id: string | null }, stripeAccountId: string | null) {
  if (p.deposit_paid_on || !p.stripe_checkout_session_id || !stripeAccountId) return p.deposit_paid_on;
  try {
    const session = await stripe.checkout.sessions.retrieve(p.stripe_checkout_session_id, {}, { stripeAccount: stripeAccountId });
    if (session.payment_status === "paid") {
      const today = new Date().toISOString().slice(0, 10);
      await admin.from("proposals").update({ deposit_paid_on: today }).eq("id", p.id).is("deposit_paid_on", null);
      return today;
    }
  } catch {
    // try again next load
  }
  return null;
}

/** Customer accepted: record it, stop follow-ups, tell the owner. Runs with the admin client. */
export async function recordAcceptance(
  admin: SupabaseClient,
  p: { id: string; org_id: string; number: number; title: string; customer_id: string | null; customer_name: string | null; pay_token: string },
  name: string,
  ip: string | null,
  selectedOptionIds: string[],
  items: ProposalItem[],
) {
  // Save which optional items they kept.
  for (const it of items.filter((i) => i.optional)) {
    await admin.from("proposal_items").update({ selected: selectedOptionIds.includes(it.id) }).eq("id", it.id);
  }
  const { data: updated } = await admin
    .from("proposals")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_name: name, accepted_ip: ip })
    .eq("id", p.id)
    .eq("status", "sent")
    .select("id")
    .maybeSingle();
  if (!updated) return false;
  await stopRuns(admin, { proposalId: p.id }, "proposal accepted");

  const kept = items.map((it) => ({ ...it, selected: it.optional ? selectedOptionIds.includes(it.id) : true }));
  const total = proposalTotal(kept);
  const { data: org } = await admin.from("organizations").select("*").eq("id", p.org_id).single();
  if (!org) return true;
  const o = org as Organization;
  const link = `${siteUrl()}/proposals/${p.id}`;
  const who = p.customer_name ?? name;
  if (o.sms_number && o.notify_phone) {
    await sendBusinessText(admin, o, { to: o.notify_phone, body: `${who} accepted proposal #${p.number} (${money(total)}). ${link}`, customerId: null, kind: "lead_alert" });
  }
  if (o.email && emailConfigured()) {
    try {
      await sendEmail({
        to: o.email,
        subject: `Accepted: proposal #${p.number} — ${who}`,
        text: `${who} accepted proposal #${p.number}${p.title ? ` (${p.title})` : ""} for ${money(total)}, signed "${name}".\n\nOpen it: ${link}`,
        fromName: "JetLemon",
      });
    } catch {
      // alert is best-effort
    }
  }
  return true;
}
