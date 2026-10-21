"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { str } from "@/lib/format";
import { normalizePhone } from "@/lib/sms";
import { DEFAULT_STEPS, MAX_STEPS, SEQUENCE_KEYS, type SequenceKey } from "@/lib/sequences";

export async function updateBusiness(fd: FormData) {
  const { supabase, org } = await getContext();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: str(fd, "name") ?? org.name,
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      address: str(fd, "address"),
      timezone: str(fd, "timezone") ?? org.timezone,
      services: str(fd, "services"),
      service_area: str(fd, "service_area"),
      hours: str(fd, "hours"),
      website: str(fd, "website"),
      lead_form_intro: str(fd, "lead_form_intro"),
      invoice_footer: str(fd, "invoice_footer"),
    })
    .eq("id", org.id);
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

export async function inviteMember(fd: FormData) {
  const { supabase, org, user } = await getContext();
  const email = str(fd, "email")?.toLowerCase();
  if (!email) return;
  const { error } = await supabase.from("invitations").insert({ org_id: org.id, email, invited_by: user.id });
  if (error) redirect(`/settings?error=${encodeURIComponent(error.code === "23505" ? "That email is already invited." : error.message)}`);
  revalidatePath("/settings");
}

export async function cancelInvite(id: string) {
  const { supabase } = await getContext();
  await supabase.from("invitations").delete().eq("id", id);
  revalidatePath("/settings");
}

export async function updateTexting(fd: FormData) {
  const { supabase, org, role } = await getContext();
  if (role !== "owner") return;
  const notify = str(fd, "notify_phone");
  const notifyPhone = notify ? normalizePhone(notify) : null;
  if (notify && !notifyPhone) redirect("/settings?error=Enter+the+alert+number+with+area+code%2C+like+205-555-0142");
  const { error } = await supabase
    .from("organizations")
    .update({
      notify_phone: notifyPhone,
      text_block_limit: Math.max(0, Math.min(50, Number(str(fd, "text_block_limit") ?? org.text_block_limit) || 0)),
      texting_paused: fd.get("texting_paused") === "on",
      daily_brief_enabled: fd.get("daily_brief_enabled") === "on",
      daily_brief_hour: Math.max(0, Math.min(23, Number(str(fd, "daily_brief_hour") ?? org.daily_brief_hour) || 7)),
    })
    .eq("id", org.id);
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function regenerateLeadAddress() {
  const { supabase, org } = await getContext();
  const { error } = await supabase.rpc("regenerate_inbound_token", { target_org: org.id });
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

export async function disconnectPage(id: string) {
  const { supabase } = await getContext();
  await supabase.from("meta_pages").delete().eq("id", id);
  revalidatePath("/settings");
}

export async function removeMember(userId: string) {
  const { supabase, org } = await getContext();
  await supabase.from("memberships").delete().eq("org_id", org.id).eq("user_id", userId);
  revalidatePath("/settings");
}

/** Saves one follow-up sequence: the on/off switch, the review link, and up to four steps. */
export async function saveSequence(key: SequenceKey, fd: FormData) {
  const { supabase, org, role } = await getContext();
  if (role !== "owner" || !SEQUENCE_KEYS.includes(key)) return;
  const steps = [];
  for (let i = 0; i < MAX_STEPS; i++) {
    const body = str(fd, `step_${i}_body`);
    if (!body) continue;
    steps.push({
      day: Math.max(0, Math.min(60, Number(str(fd, `step_${i}_day`) ?? 0) || 0)),
      channel: fd.get(`step_${i}_channel`) === "email" ? "email" : "text",
      subject: str(fd, `step_${i}_subject`) ?? "",
      body,
    });
  }
  steps.sort((a, b) => a.day - b.day);
  const enabled = fd.get("enabled") === "on" && steps.length > 0;
  const { error } = await supabase
    .from("sequences")
    .upsert({ org_id: org.id, key, enabled, steps, updated_at: new Date().toISOString() }, { onConflict: "org_id,key" });
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  if (fd.has("review_url")) await supabase.from("organizations").update({ review_url: str(fd, "review_url") }).eq("id", org.id);
  revalidatePath("/settings");
  redirect(`/settings?saved=1#followups`);
}

/** Puts a sequence back to the built-in wording (keeps the on/off switch as it was). */
export async function resetSequence(key: SequenceKey) {
  const { supabase, org, role } = await getContext();
  if (role !== "owner" || !SEQUENCE_KEYS.includes(key)) return;
  const { data } = await supabase.from("sequences").select("enabled").eq("org_id", org.id).eq("key", key).maybeSingle();
  await supabase
    .from("sequences")
    .upsert({ org_id: org.id, key, enabled: data?.enabled ?? false, steps: DEFAULT_STEPS[key], updated_at: new Date().toISOString() }, { onConflict: "org_id,key" });
  revalidatePath("/settings");
  redirect("/settings?saved=1#followups");
}
