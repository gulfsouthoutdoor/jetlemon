import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/sms";
import { sendBusinessText } from "@/lib/texting";
import { enroll } from "@/lib/sequences";
import { aiConfigured, askJson, businessContext } from "@/lib/ai";

export type InboundLead = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  message?: string | null;
  /** Where it came from: 'facebook', 'website', 'zapier', … */
  source: string;
  /** Provider's own id for the lead, used to ignore duplicates (e.g. Facebook leadgen_id). */
  sourceRef?: string | null;
  /** Any other answers the form collected, shown in the job description. */
  extra?: Record<string, string>;
};

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://jetlemon.com";

/**
 * Turns an inbound lead into a customer (found or created) plus a job in "lead" status,
 * then fires the speed-to-lead text and the owner alert if the business turned them on.
 * Runs with the service-role client (no signed-in user), so it is only called from trusted routes.
 */
export async function createInboundLead(admin: SupabaseClient, orgId: string, lead: InboundLead) {
  const { data: org } = await admin.from("organizations").select("*").eq("id", orgId).single();
  if (!org) throw new Error("Unknown business");

  // Drop duplicates (Facebook retries webhooks; Zapier can double-fire).
  if (lead.sourceRef) {
    const { data: existing } = await admin
      .from("jobs")
      .select("id")
      .eq("org_id", orgId)
      .eq("source", lead.source)
      .eq("source_ref", lead.sourceRef)
      .maybeSingle();
    if (existing) return { jobId: existing.id as string, duplicate: true };
  }

  const phone = normalizePhone(lead.phone);
  const email = lead.email?.trim().toLowerCase() || null;
  const name = lead.name?.trim() || (phone ?? email ?? "New lead");

  // Match an existing customer by phone, then by email.
  let customerId: string | null = null;
  if (phone) {
    const { data } = await admin.from("customers").select("id").eq("org_id", orgId).eq("phone", phone).limit(1).maybeSingle();
    customerId = data?.id ?? null;
  }
  if (!customerId && email) {
    const { data } = await admin.from("customers").select("id").eq("org_id", orgId).ilike("email", email).limit(1).maybeSingle();
    customerId = data?.id ?? null;
  }
  if (!customerId) {
    const { data, error } = await admin
      .from("customers")
      .insert({ org_id: orgId, name, phone, email, address: lead.address?.trim() || null, tags: [lead.source] })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    customerId = data.id;
  }

  const lines: string[] = [];
  if (lead.message?.trim()) lines.push(lead.message.trim());
  for (const [k, v] of Object.entries(lead.extra ?? {})) if (v?.trim()) lines.push(`${k}: ${v.trim()}`);
  lines.push(`Source: ${lead.source}`);

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .insert({
      org_id: orgId,
      customer_id: customerId,
      title: `${sourceLabel(lead.source)} lead — ${name}`,
      description: lines.join("\n"),
      status: "lead",
      address: lead.address?.trim() || null,
      source: lead.source,
      source_ref: lead.sourceRef ?? null,
    })
    .select("id")
    .single();
  if (jobError) {
    // Unique index hit: another request created it first.
    if (jobError.code === "23505" && lead.sourceRef) {
      const { data: existing } = await admin.from("jobs").select("id").eq("org_id", orgId).eq("source", lead.source).eq("source_ref", lead.sourceRef).single();
      return { jobId: existing!.id as string, duplicate: true };
    }
    throw new Error(jobError.message);
  }

  // One-line AI summary of what the lead wants and what to do next.
  if (aiConfigured()) {
    try {
      const r = await askJson<{ summary: string }>(
        `You summarize a new lead for a busy service business owner in ONE sentence (under 160 characters): what they want, any timing or budget signals, and the single best next step. Plain words, no emojis.\n${businessContext(org)}\nReturn JSON: {"summary": "..."}`,
        lines.join("\n") + `\nName: ${name}${phone ? ", phone on file" : ", no phone"}${email ? ", email on file" : ""}`,
        200,
      );
      if (r.summary) await admin.from("jobs").update({ ai_summary: String(r.summary).slice(0, 240) }).eq("id", job.id);
    } catch {
      // Summary is a nice-to-have; never block the lead.
    }
  }

  // Speed-to-lead: the "New lead" follow-up sends the instant text + email, then the repeats.
  await enroll(admin, org, "new_lead", { customerId, jobId: job.id });

  // Alert the owner.
  if (org.sms_number && org.notify_phone) {
    const body = `New ${sourceLabel(lead.source).toLowerCase()} lead: ${name}${phone ? ` ${phone}` : ""}. ${siteUrl()}/jobs/${job.id}`;
    await sendBusinessText(admin, org, { to: org.notify_phone, body, customerId: null, kind: "lead_alert" });
  }

  return { jobId: job.id as string, duplicate: false };
}

export function sourceLabel(source: string) {
  const known: Record<string, string> = { facebook: "Facebook", website: "Website", zapier: "Zapier", manual: "Manual" };
  return known[source] ?? source.replace(/^\w/, (c) => c.toUpperCase());
}
