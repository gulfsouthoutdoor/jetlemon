import type { SupabaseClient } from "@supabase/supabase-js";
import { emailConfigured, sendEmail, unsubscribeUrl } from "@/lib/email";
import { dayKey, fromLocalInput, invoiceTotal, money } from "@/lib/format";
import { sendBusinessText } from "@/lib/texting";
import { hasFollowUps } from "@/lib/stripe";
import { payUrl } from "@/lib/payments";
import type { Customer, Organization } from "@/lib/types";

/**
 * Follow-ups: three pre-made sequences a business switches on. Each step is a text or an email
 * sent N days after the trigger, at 9 AM in the business's time zone (day 0 goes right away).
 * A run stops on its own when the customer replies or the job/invoice moves on.
 */
export const SEQUENCE_KEYS = ["new_lead", "after_job", "unpaid_invoice"] as const;
export type SequenceKey = (typeof SEQUENCE_KEYS)[number];
export type Channel = "text" | "email";
export type Step = { day: number; channel: Channel; subject: string; body: string };
export type Sequence = { key: SequenceKey; enabled: boolean; steps: Step[]; custom: boolean };
export const MAX_STEPS = 8;
/** Sequences that run without the owner touching anything. */
export const DEFAULT_ENABLED: Record<SequenceKey, boolean> = { new_lead: true, after_job: false, unpaid_invoice: false };
export const SEND_HOUR = 9;

export const SEQUENCE_INFO: Record<SequenceKey, { name: string; trigger: string; stops: string }> = {
  new_lead: { name: "New lead", trigger: "a new lead comes in (text + email right away, then days 1, 3 and 7)", stops: "they reply, or the job is scheduled or cancelled" },
  after_job: { name: "After the job", trigger: "a job is marked completed", stops: "they reply" },
  unpaid_invoice: { name: "Unpaid invoice", trigger: "an invoice is sent", stops: "it's paid or voided, or they reply" },
};

export const DEFAULT_STEPS: Record<SequenceKey, Step[]> = {
  new_lead: [
    { day: 0, channel: "text", subject: "", body: "Hi {first_name}, this is {business}. We got your request and will be in touch shortly. When is a good time to call you?" },
    {
      day: 0,
      channel: "email",
      subject: "We got your request, {first_name}",
      body: "Hi {first_name},\n\nThanks for reaching out to {business}. We've got your request and will be in touch shortly to go over what you need and set up a time.\n\nIf it's easier, reply to this email or call {phone}.\n\nTalk soon,\n{business}",
    },
    { day: 1, channel: "text", subject: "", body: "Hi {first_name}, it's {business}. Still want a hand with your project? Reply here and we'll get you on the schedule." },
    {
      day: 1,
      channel: "email",
      subject: "Ready when you are, {first_name}",
      body: "Hi {first_name},\n\nJust following up on your request to {business}. We'd be glad to help — reply to this email or call {phone} and we'll find a time that works for you.\n\nThanks,\n{business}",
    },
    { day: 3, channel: "text", subject: "", body: "Hi {first_name}, {business} here. Want us to get you on the schedule this week? Reply with a day that works." },
    {
      day: 3,
      channel: "email",
      subject: "Still need a hand, {first_name}?",
      body: "Hi {first_name},\n\nChecking in one more time from {business}. If you still need help with your project, we'd love to take care of it. Reply here or call {phone}.\n\nThanks,\n{business}",
    },
    { day: 7, channel: "text", subject: "", body: "Hi {first_name}, last check-in from {business}. If the timing isn't right, no problem — reply anytime and we'll be ready." },
    {
      day: 7,
      channel: "email",
      subject: "We're here when you're ready",
      body: "Hi {first_name},\n\nThis is our last check-in from {business}. If now isn't the right time, no problem at all — this email will be here whenever you're ready, and so will we.\n\nAll the best,\n{business}",
    },
  ],
  after_job: [
    { day: 0, channel: "text", subject: "", body: "Thanks for choosing {business}, {first_name}! If anything isn't right, reply here and we'll take care of it." },
    {
      day: 2,
      channel: "email",
      subject: "How did we do, {first_name}?",
      body: "Hi {first_name},\n\nThanks for having {business} out. If we did a good job, a quick review helps us more than you'd think:\n\n{review_link}\n\nAnd if anything wasn't right, just reply to this email — we'll make it right.\n\nThank you,\n{business}",
    },
  ],
  unpaid_invoice: [
    {
      day: 3,
      channel: "email",
      subject: "Invoice #{invoice_number} from {business}",
      body: "Hi {first_name},\n\nA quick reminder that invoice #{invoice_number} for {amount} is open. You can view it and pay here:\n\n{pay_link}\n\nReply to this email if you have any questions.\n\nThank you,\n{business}",
    },
    { day: 7, channel: "text", subject: "", body: "Hi {first_name}, {business} here. Invoice #{invoice_number} ({amount}) is still open. Pay or view it here: {pay_link} — reply with any questions. Thanks!" },
    {
      day: 14,
      channel: "email",
      subject: "Invoice #{invoice_number} is past due",
      body: "Hi {first_name},\n\nInvoice #{invoice_number} for {amount} is now past due. You can settle it here:\n\n{pay_link}\n\nOr reply to this email or call {phone} and we'll sort it out.\n\nThank you,\n{business}",
    },
  ],
};

export const MERGE_FIELDS: Record<SequenceKey, string[]> = {
  new_lead: ["{first_name}", "{name}", "{business}", "{phone}"],
  after_job: ["{first_name}", "{name}", "{business}", "{phone}", "{review_link}"],
  unpaid_invoice: ["{first_name}", "{name}", "{business}", "{phone}", "{invoice_number}", "{amount}", "{pay_link}"],
};

type Vars = Record<string, string>;
const fill = (t: string, vars: Vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t);

function cleanSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      day: Math.max(0, Math.min(60, Number(s?.day) || 0)),
      channel: (s?.channel === "email" ? "email" : "text") as Channel,
      subject: String(s?.subject ?? "").slice(0, 150),
      body: String(s?.body ?? "").slice(0, 1200),
    }))
    .filter((s) => s.body.trim())
    .slice(0, MAX_STEPS);
}

/** All three sequences for a business, falling back to the defaults (switched off) where nothing is saved. */
export async function getSequences(db: SupabaseClient, orgId: string): Promise<Sequence[]> {
  const { data } = await db.from("sequences").select("key, enabled, steps").eq("org_id", orgId);
  return SEQUENCE_KEYS.map((key) => {
    const row = data?.find((r) => r.key === key);
    return row ? { key, enabled: row.enabled, steps: cleanSteps(row.steps), custom: true } : { key, enabled: DEFAULT_ENABLED[key], steps: DEFAULT_STEPS[key], custom: false };
  });
}

/** When step N of a run should go out: right away for day 0, otherwise 9 AM local on that day. */
function stepTime(step: Step, startedAt: Date, timezone: string) {
  if (step.day === 0) return startedAt.toISOString();
  const day = dayKey(new Date(startedAt.getTime() + step.day * 86_400_000), timezone);
  return fromLocalInput(`${day}T${String(SEND_HOUR).padStart(2, "0")}:00`, timezone) ?? startedAt.toISOString();
}

/** One sequence's switch and steps, using the built-in defaults when the business hasn't saved its own. */
async function loadSequence(db: SupabaseClient, orgId: string, key: SequenceKey) {
  const { data } = await db.from("sequences").select("enabled, steps").eq("org_id", orgId).eq("key", key).maybeSingle();
  return data ? { enabled: data.enabled as boolean, steps: cleanSteps(data.steps) } : { enabled: DEFAULT_ENABLED[key], steps: DEFAULT_STEPS[key] };
}

export type EnrollTarget = { customerId: string | null | undefined; jobId?: string | null; invoiceId?: string | null };

/**
 * Starts a run if the business has this sequence switched on. Safe to call twice for the same job or
 * invoice — the second call is ignored. `db` may be the user's client (RLS) or the admin client.
 * Day-0 steps are sent right away, so pass the admin client when the caller can.
 */
export async function enroll(db: SupabaseClient, org: Organization, key: SequenceKey, target: EnrollTarget) {
  if (!target.customerId || !hasFollowUps(org)) return;
  const seq = await loadSequence(db, org.id, key);
  if (!seq.enabled || !seq.steps.length) return;
  const steps = seq.steps;

  const now = new Date();
  const { data: run, error } = await db
    .from("sequence_runs")
    .insert({
      org_id: org.id,
      sequence_key: key,
      customer_id: target.customerId,
      job_id: target.jobId ?? null,
      invoice_id: target.invoiceId ?? null,
      step: 0,
      next_at: stepTime(steps[0], now, org.timezone),
      started_at: now.toISOString(),
    })
    .select("id, next_at")
    .single();
  if (error || !run) return; // unique index: already enrolled
  if (new Date(run.next_at) <= now) await processDue(db, { runId: run.id });
}

/** Stops every active run for a customer (reply), a job (status change) or an invoice (paid/void). */
export async function stopRuns(db: SupabaseClient, where: { customerId?: string; jobId?: string; invoiceId?: string; key?: SequenceKey }, reason: string) {
  let q = db.from("sequence_runs").update({ status: "stopped", stop_reason: reason, updated_at: new Date().toISOString() }).eq("status", "active");
  if (where.customerId) q = q.eq("customer_id", where.customerId);
  if (where.jobId) q = q.eq("job_id", where.jobId);
  if (where.invoiceId) q = q.eq("invoice_id", where.invoiceId);
  if (where.key) q = q.eq("sequence_key", where.key);
  await q;
}

type RunRow = {
  id: string;
  org_id: string;
  sequence_key: SequenceKey;
  customer_id: string;
  job_id: string | null;
  invoice_id: string | null;
  step: number;
  next_at: string;
  started_at: string;
};

/**
 * Sends every step that is due. Called by the hourly cron, and by enroll() for day-0 steps.
 * Each step is checked against the stop rules first, then sent on whichever channel it uses;
 * a step that can't go (no phone, no email, opted out, Starter plan) is skipped, not retried.
 */
export async function processDue(db: SupabaseClient, opts: { runId?: string; limit?: number } = {}) {
  let q = db.from("sequence_runs").select("*").eq("status", "active").lte("next_at", new Date().toISOString()).order("next_at").limit(opts.limit ?? 200);
  if (opts.runId) q = q.eq("id", opts.runId);
  const { data: runs } = await q;
  let sent = 0;
  let skipped = 0;
  for (const run of (runs ?? []) as RunRow[]) {
    const r = await processRun(db, run);
    if (r === "sent") sent++;
    else if (r === "skipped") skipped++;
  }
  return { due: runs?.length ?? 0, sent, skipped };
}

async function processRun(db: SupabaseClient, run: RunRow): Promise<"sent" | "skipped" | "stopped" | "done"> {
  const finish = (status: "stopped" | "done", reason?: string) =>
    db.from("sequence_runs").update({ status, stop_reason: reason ?? null, next_at: null, updated_at: new Date().toISOString() }).eq("id", run.id);

  const [{ data: org }, seq, { data: customer }] = await Promise.all([
    db.from("organizations").select("*").eq("id", run.org_id).single(),
    loadSequence(db, run.org_id, run.sequence_key),
    db.from("customers").select("*").eq("id", run.customer_id).single(),
  ]);
  if (!org || !customer) {
    await finish("stopped", "customer or business no longer exists");
    return "stopped";
  }
  if (!seq.enabled) {
    await finish("stopped", "follow-up switched off");
    return "stopped";
  }
  if (!hasFollowUps(org)) {
    await finish("stopped", "follow-ups need the Pro plan");
    return "stopped";
  }
  const steps = seq.steps;
  const step = steps[run.step];
  if (!step) {
    await finish("done");
    return "done";
  }

  // Stop rules.
  const { count: replies } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customer.id)
    .eq("direction", "in")
    .gte("created_at", run.started_at);
  if (replies) {
    await finish("stopped", "customer replied");
    return "stopped";
  }
  const vars: Vars = {
    first_name: customer.name.trim().split(/\s+/)[0] || "there",
    name: customer.name,
    business: org.name,
    phone: org.phone ?? "",
    review_link: org.review_url ?? "",
  };
  if (run.job_id) {
    const { data: job } = await db.from("jobs").select("status").eq("id", run.job_id).maybeSingle();
    if (!job) {
      await finish("stopped", "job removed");
      return "stopped";
    }
    if (run.sequence_key === "new_lead" && job.status !== "lead") {
      await finish("stopped", `job moved to ${job.status.replace("_", " ")}`);
      return "stopped";
    }
  }
  if (run.invoice_id) {
    const { data: inv } = await db.from("invoices").select("number, status, pay_token, invoice_items(quantity, unit_price)").eq("id", run.invoice_id).maybeSingle();
    if (!inv || inv.status !== "sent") {
      await finish("stopped", inv ? `invoice ${inv.status}` : "invoice removed");
      return "stopped";
    }
    vars.invoice_number = String(inv.number);
    vars.amount = money(invoiceTotal(inv));
    vars.pay_link = payUrl(inv.pay_token);
  }

  // Send this step.
  const o = org as Organization;
  const c = customer as Customer;
  let outcome: "sent" | "skipped" = "skipped";
  if (step.channel === "text") {
    if (c.phone && !c.text_opt_out) {
      const r = await sendBusinessText(db, o, { to: c.phone, body: fill(step.body, vars), customerId: c.id, kind: "sequence" });
      outcome = r.ok ? "sent" : "skipped";
    }
  } else if (c.email && !c.email_opt_out && emailConfigured()) {
    const text = fill(step.body, vars);
    const subject = fill(step.subject || `A note from ${o.name}`, vars);
    const log = (status: string, sid: string | null = null) =>
      db.from("messages").insert({
        org_id: o.id,
        customer_id: c.id,
        direction: "out",
        channel: "email",
        body: `${subject}\n\n${text}`,
        from_number: process.env.EMAIL_FROM ?? "hello@jetlemon.com",
        to_number: c.email!,
        provider_sid: sid,
        status,
        kind: "sequence",
      });
    try {
      const id = await sendEmail({
        to: c.email,
        subject,
        text,
        fromName: o.name,
        replyTo: o.email,
        footer: [o.name, o.phone, o.address].filter(Boolean).join(" · "),
        unsubscribe: unsubscribeUrl(c.id),
      });
      await log("sent", id);
      outcome = "sent";
    } catch (err) {
      await log(`failed: ${(err as Error).message}`.slice(0, 200));
    }
  }

  // Move to the next step, or finish.
  const next = steps[run.step + 1];
  if (next) {
    await db
      .from("sequence_runs")
      .update({ step: run.step + 1, next_at: stepTime(next, new Date(run.started_at), o.timezone), updated_at: new Date().toISOString() })
      .eq("id", run.id);
  } else {
    await finish("done");
  }
  return outcome;
}

/** Plain-words status for one job's or invoice's runs, for the job/invoice pages. */
export function describeRun(run: { sequence_key: SequenceKey; status: string; step: number; next_at: string | null; stop_reason: string | null }, steps: Step[], timezone: string) {
  const name = SEQUENCE_INFO[run.sequence_key].name;
  if (run.status === "done") return `${name} follow-up: finished`;
  if (run.status === "stopped") return `${name} follow-up: stopped (${run.stop_reason ?? "manually"})`;
  const step = steps[run.step];
  const when = run.next_at ? new Date(run.next_at).toLocaleString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric" }) : "";
  return `${name} follow-up: ${step?.channel === "email" ? "email" : "text"} ${run.step + 1} of ${steps.length} goes ${when}`;
}
