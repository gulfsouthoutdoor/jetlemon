import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKey, fromLocalInput } from "@/lib/format";
import { sendSms } from "@/lib/sms";
import { stripe } from "@/lib/stripe";
import type { Organization } from "@/lib/types";

/** 'YYYY-MM' for right now in the business's time zone, plus the UTC instant the month started. */
export function currentMonth(org: Pick<Organization, "timezone">) {
  const key = dayKey(new Date(), org.timezone).slice(0, 7);
  return { key, startsAt: fromLocalInput(`${key}-01T00:00`, org.timezone)! };
}

export type TextUsage = {
  month: string;
  used: number;
  included: number;
  blocks: number;
  blockSize: number;
  blockPriceCents: number;
  blockLimit: number;
  allowance: number; // included + blocks * blockSize
  remaining: number;
  capReached: boolean; // allowance used up and no more blocks allowed this month
  paused: boolean;
};

/** Texts sent this month vs. what the plan (plus any bought blocks) allows. */
export async function getTextUsage(db: SupabaseClient, org: Organization): Promise<TextUsage> {
  const { key, startsAt } = currentMonth(org);
  const [{ count }, { data: tb }] = await Promise.all([
    db.from("messages").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("direction", "out").eq("status", "sent").gte("created_at", startsAt),
    db.from("text_blocks").select("blocks").eq("org_id", org.id).eq("month", key).maybeSingle(),
  ]);
  const used = count ?? 0;
  const blocks = tb?.blocks ?? 0;
  const allowance = org.texts_included + blocks * org.text_block_size;
  return {
    month: key,
    used,
    included: org.texts_included,
    blocks,
    blockSize: org.text_block_size,
    blockPriceCents: org.text_block_price_cents,
    blockLimit: org.text_block_limit,
    allowance,
    remaining: Math.max(0, allowance - used),
    capReached: used >= allowance && blocks >= org.text_block_limit,
    paused: org.texting_paused,
  };
}

export type OutgoingText = {
  to: string;
  body: string;
  customerId: string | null;
  kind: "manual" | "auto_text" | "lead_alert";
  sentBy?: string | null;
};

/**
 * The one door every outgoing text goes through. Checks the pause switch and the monthly
 * allowance, buys an overage block on the business's Stripe account when needed (within
 * their cap), sends through Twilio, and records the message either way.
 * `admin` must be the service-role client; callers verify the user first.
 */
export async function sendBusinessText(admin: SupabaseClient, org: Organization, t: OutgoingText): Promise<{ ok: boolean; reason?: string }> {
  const log = (status: string, sid: string | null = null) =>
    admin.from("messages").insert({
      org_id: org.id,
      customer_id: t.customerId,
      direction: "out",
      body: t.body,
      from_number: org.sms_number ?? "",
      to_number: t.to,
      provider_sid: sid,
      status,
      kind: t.kind,
      sent_by: t.sentBy ?? null,
    });

  if (!org.sms_number) return { ok: false, reason: "This business has no texting number." };
  if (org.texting_paused) {
    await log("blocked: texting paused");
    return { ok: false, reason: "Texting is paused. Turn it back on in Settings." };
  }

  const usage = await getTextUsage(admin, org);
  if (usage.used >= usage.allowance) {
    if (usage.blocks >= usage.blockLimit) {
      await log("blocked: monthly cap reached");
      return { ok: false, reason: `Monthly text cap reached (${usage.allowance} texts). Raise the cap in Settings to keep texting.` };
    }
    const bought = await buyBlock(admin, org, usage);
    if (!bought.ok) {
      await log(`blocked: ${bought.reason}`);
      return bought;
    }
  }

  try {
    const sid = await sendSms(org.sms_number, t.to, t.body);
    await log("sent", sid);
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    await log(`failed: ${msg}`.slice(0, 200));
    return { ok: false, reason: `Text not sent — ${msg}` };
  }
}

/** Adds one overage block to the business's next Stripe invoice and records it for this month. */
async function buyBlock(admin: SupabaseClient, org: Organization, usage: TextUsage): Promise<{ ok: boolean; reason?: string }> {
  if (!org.stripe_customer_id || org.subscription_status === "trialing" || org.subscription_status === "canceled") {
    return { ok: false, reason: "included texts used up; extra blocks need an active paid plan" };
  }
  let itemId: string;
  try {
    const item = await stripe.invoiceItems.create({
      customer: org.stripe_customer_id,
      amount: org.text_block_price_cents,
      currency: "usd",
      description: `Extra texts: ${org.text_block_size}-text block (${usage.month})`,
      metadata: { org_id: org.id, month: usage.month, block: String(usage.blocks + 1) },
    });
    itemId = item.id;
  } catch (err) {
    return { ok: false, reason: `could not bill a text block (${(err as Error).message})` };
  }
  const { data: existing } = await admin.from("text_blocks").select("blocks, stripe_invoice_item_ids").eq("org_id", org.id).eq("month", usage.month).maybeSingle();
  await admin.from("text_blocks").upsert(
    {
      org_id: org.id,
      month: usage.month,
      blocks: (existing?.blocks ?? 0) + 1,
      stripe_invoice_item_ids: [...(existing?.stripe_invoice_item_ids ?? []), itemId],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,month" },
  );
  return { ok: true };
}
