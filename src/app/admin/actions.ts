"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { str } from "@/lib/format";
import { normalizePhone } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";

const back = (msg: string, ok = true): never => redirect(`/admin?${ok ? "saved" : "error"}=${encodeURIComponent(msg)}`);

/** Give a business a texting number (or clear it). */
export async function setNumber(orgId: string, fd: FormData) {
  await requireAdmin();
  const raw = str(fd, "sms_number");
  const number = raw ? normalizePhone(raw) : null;
  if (raw && !number) back("Enter the number with area code, like 205-555-0142", false);
  const { error } = await createAdminClient().from("organizations").update({ sms_number: number }).eq("id", orgId);
  if (error) back(error.code === "23505" ? "That number is already assigned to another business." : error.message, false);
  revalidatePath("/admin");
  back(number ? `Number ${number} assigned.` : "Number removed.");
}

/** Mark a business complimentary: active, no Stripe subscription, chosen plan. */
export async function comp(orgId: string, fd: FormData) {
  await requireAdmin();
  const plan = fd.get("plan") === "starter" ? "starter" : "pro";
  const { error } = await createAdminClient()
    .from("organizations")
    .update({ subscription_status: "active", stripe_subscription_id: null, plan, trial_ends_at: new Date(Date.now() + 100 * 365 * 86_400_000).toISOString() })
    .eq("id", orgId);
  if (error) back(error.message, false);
  revalidatePath("/admin");
  back(`Complimentary ${plan === "pro" ? "Pro" : "Starter"} set.`);
}

/** Put a business back on a normal trial (removes comp). */
export async function uncomp(orgId: string) {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("organizations")
    .update({ subscription_status: "trialing", trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString() })
    .eq("id", orgId);
  if (error) back(error.message, false);
  revalidatePath("/admin");
  back("Back on a 14-day trial.");
}

/** Add days to the trial. */
export async function extendTrial(orgId: string, fd: FormData) {
  await requireAdmin();
  const days = Math.max(1, Math.min(365, Number(str(fd, "days") ?? 14) || 14));
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("trial_ends_at, subscription_status").eq("id", orgId).single();
  const base = org && new Date(org.trial_ends_at) > new Date() ? new Date(org.trial_ends_at) : new Date();
  const { error } = await admin
    .from("organizations")
    .update({ trial_ends_at: new Date(base.getTime() + days * 86_400_000).toISOString(), ...(org?.subscription_status === "canceled" ? { subscription_status: "trialing" } : {}) })
    .eq("id", orgId);
  if (error) back(error.message, false);
  revalidatePath("/admin");
  back(`Trial extended ${days} days.`);
}

/** Change the plan without touching Stripe (for comped accounts or fixes). */
export async function setPlan(orgId: string, fd: FormData) {
  await requireAdmin();
  const plan = fd.get("plan") === "pro" ? "pro" : "starter";
  const { error } = await createAdminClient().from("organizations").update({ plan }).eq("id", orgId);
  if (error) back(error.message, false);
  revalidatePath("/admin");
  back(`Plan set to ${plan === "pro" ? "Pro" : "Starter"}.`);
}

export async function togglePause(orgId: string, paused: boolean) {
  await requireAdmin();
  const { error } = await createAdminClient().from("organizations").update({ texting_paused: paused }).eq("id", orgId);
  if (error) back(error.message, false);
  revalidatePath("/admin");
  back(paused ? "Texting paused." : "Texting resumed.");
}

/** Permanently removes a business and everything in it. */
export async function deleteBusiness(orgId: string, fd: FormData) {
  await requireAdmin();
  if (str(fd, "confirm") !== "DELETE") back("Type DELETE to confirm.", false);
  const { error } = await createAdminClient().from("organizations").delete().eq("id", orgId);
  if (error) back(error.message, false);
  revalidatePath("/admin");
  back("Business deleted.");
}
