"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiConfigured, askJson, businessContext } from "@/lib/ai";
import { str } from "@/lib/format";
import { getContext } from "@/lib/org";
import { proposalTotal } from "@/lib/proposals";
import { enroll, stopRuns } from "@/lib/sequences";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProposalItem } from "@/lib/types";

const back: (id: string, msg: string, ok?: boolean) => never = (id, msg, ok = false) => redirect(`/proposals/${id}?${ok ? "saved" : "error"}=${encodeURIComponent(msg)}`);

export async function createProposal(fd: FormData) {
  const { supabase, org } = await getContext();
  const { data, error } = await supabase
    .from("proposals")
    .insert({ org_id: org.id, customer_id: str(fd, "customer_id"), job_id: str(fd, "job_id"), title: str(fd, "title") ?? "" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/proposals/${data.id}`);
}

export async function updateProposal(id: string, fd: FormData) {
  const { supabase } = await getContext();
  const { error } = await supabase
    .from("proposals")
    .update({
      customer_id: str(fd, "customer_id"),
      title: str(fd, "title") ?? "",
      intro: str(fd, "intro"),
      terms: str(fd, "terms"),
      valid_until: str(fd, "valid_until"),
      deposit_percent: Math.max(0, Math.min(100, Number(str(fd, "deposit_percent") ?? 0) || 0)),
    })
    .eq("id", id);
  if (error) back(id, error.message);
  revalidatePath(`/proposals/${id}`);
  redirect(`/proposals/${id}?saved=Saved.`);
}

export async function addProposalItem(id: string, fd: FormData) {
  const { supabase, org } = await getContext();
  const description = str(fd, "description");
  if (!description) return;
  const { error } = await supabase.from("proposal_items").insert({
    org_id: org.id,
    proposal_id: id,
    description,
    quantity: Number(str(fd, "quantity") ?? 1) || 1,
    unit_price: Number(str(fd, "unit_price") ?? 0) || 0,
    optional: fd.get("optional") === "on",
  });
  if (error) back(id, error.message);
  revalidatePath(`/proposals/${id}`);
}

export async function removeProposalItem(id: string, itemId: string) {
  const { supabase } = await getContext();
  await supabase.from("proposal_items").delete().eq("id", itemId);
  revalidatePath(`/proposals/${id}`);
}

/** Mark sent (starts follow-ups), reopen, or expire by hand. */
export async function setProposalStatus(id: string, status: "sent" | "draft" | "expired") {
  const { supabase, org } = await getContext();
  const { data: items } = await supabase.from("proposal_items").select("quantity, unit_price, optional, selected").eq("proposal_id", id);
  if (status === "sent" && proposalTotal((items ?? []) as ProposalItem[]) <= 0) back(id, "Add at least one priced line before sending.");
  const { data: p, error } = await supabase
    .from("proposals")
    .update({ status, ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}) })
    .eq("id", id)
    .in("status", ["draft", "sent", "expired"])
    .select("customer_id")
    .maybeSingle();
  if (error) back(id, error.message);
  const admin = createAdminClient();
  if (status === "sent" && p) await enroll(admin, org, "proposal", { customerId: p.customer_id, proposalId: id });
  else await stopRuns(admin, { proposalId: id }, status === "expired" ? "proposal expired" : "proposal reopened");
  revalidatePath(`/proposals/${id}`);
  revalidatePath("/proposals");
  redirect(`/proposals/${id}?saved=${encodeURIComponent(status === "sent" ? "Marked as sent. Copy the link below or email it to the customer." : "Updated.")}`);
}

export async function deleteProposal(id: string) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("proposals").delete().eq("id", id);
  if (error) back(id, error.message);
  revalidatePath("/proposals");
  redirect("/proposals");
}

/** Accepted proposal → a scheduled job with the same customer and title. */
export async function proposalToJob(id: string) {
  const { supabase, org } = await getContext();
  const { data: p } = await supabase.from("proposals").select("*, proposal_items(*)").eq("id", id).single();
  if (!p) return;
  if (p.job_id) redirect(`/jobs/${p.job_id}`);
  const items = (p.proposal_items ?? []) as ProposalItem[];
  const lines = items.filter((it) => !it.optional || it.selected).map((it) => `• ${it.description}${Number(it.quantity) !== 1 ? ` × ${Number(it.quantity)}` : ""}`);
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      org_id: org.id,
      customer_id: p.customer_id,
      title: p.title || `Proposal #${p.number}`,
      description: [`From proposal #${p.number}`, ...lines].join("\n"),
      status: "scheduled",
      price: proposalTotal(items),
      address: p.customers?.address ?? null,
      source: "proposal",
      source_ref: p.id,
    })
    .select("id")
    .single();
  if (error || !job) back(id, error?.message ?? "Could not create the job.");
  await supabase.from("proposals").update({ job_id: job.id }).eq("id", id);
  revalidatePath(`/proposals/${id}`);
  redirect(`/jobs/${job.id}`);
}

/** Accepted proposal → a draft invoice with the accepted lines (minus any deposit already paid). */
export async function proposalToInvoice(id: string) {
  const { supabase, org } = await getContext();
  const { data: p } = await supabase.from("proposals").select("*, proposal_items(*)").eq("id", id).single();
  if (!p) return;
  if (p.invoice_id) redirect(`/invoices/${p.invoice_id}`);
  const items = ((p.proposal_items ?? []) as ProposalItem[]).filter((it) => !it.optional || it.selected);
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({ org_id: org.id, customer_id: p.customer_id, job_id: p.job_id, notes: `Proposal #${p.number}${p.title ? ` — ${p.title}` : ""}` })
    .select("id")
    .single();
  if (error || !inv) back(id, error?.message ?? "Could not create the invoice.");
  const rows = items.map((it) => ({ org_id: org.id, invoice_id: inv.id, description: it.description, quantity: it.quantity, unit_price: it.unit_price }));
  if (p.deposit_paid_on && p.deposit_percent > 0) {
    rows.push({ org_id: org.id, invoice_id: inv.id, description: `Deposit received ${p.deposit_paid_on}`, quantity: 1, unit_price: -Math.round(proposalTotal(items) * p.deposit_percent) / 100 });
  }
  if (rows.length) await supabase.from("invoice_items").insert(rows);
  await supabase.from("proposals").update({ invoice_id: inv.id }).eq("id", id);
  revalidatePath(`/proposals/${id}`);
  redirect(`/invoices/${inv.id}`);
}

/** AI: turn a one-line description of the work into line items (no prices) and a short intro. */
export async function draftProposal(id: string, fd: FormData) {
  const { supabase, org } = await getContext();
  const brief = str(fd, "brief");
  if (!brief) return;
  if (!aiConfigured()) back(id, "AI assist isn't switched on for this server.");
  const { data: p } = await supabase.from("proposals").select("title, customers(name)").eq("id", id).single();
  const customer = (p?.customers as unknown as { name: string } | null)?.name ?? "the customer";
  type Draft = { title: string; intro: string; items: { description: string; quantity: number; optional: boolean }[] };
  let draft: Draft | undefined;
  try {
    draft = await askJson<Draft>(
      `You write proposals for a small business. From the owner's short description, produce a clear title, a 2-3 sentence friendly intro addressed to the customer (no prices, no promises about timing), and 3-8 line items a customer would understand. Mark true add-ons as optional. Never invent prices. Plain words, no hype.\n${businessContext(org)}\nReturn JSON: {"title": "...", "intro": "...", "items": [{"description": "...", "quantity": 1, "optional": false}]}`,
      `Customer: ${customer}\nWork: ${brief}`,
      1200,
    );
  } catch (err) {
    back(id, `AI couldn't draft that (${(err as Error).message}).`);
  }
  if (!draft) back(id, "AI returned nothing.");
  const items = (draft.items ?? []).slice(0, 10).map((it) => ({
    org_id: org.id,
    proposal_id: id,
    description: String(it.description).slice(0, 200),
    quantity: Math.max(0.25, Number(it.quantity) || 1),
    unit_price: 0,
    optional: Boolean(it.optional),
  }));
  if (items.length) await supabase.from("proposal_items").insert(items);
  await supabase
    .from("proposals")
    .update({ ...(p?.title ? {} : { title: String(draft.title ?? "").slice(0, 120) }), intro: String(draft.intro ?? "").slice(0, 1500) })
    .eq("id", id);
  revalidatePath(`/proposals/${id}`);
  redirect(`/proposals/${id}?saved=${encodeURIComponent("Drafted — now put a price on each line.")}`);
}
