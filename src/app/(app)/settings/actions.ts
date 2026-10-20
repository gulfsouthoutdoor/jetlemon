"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { str } from "@/lib/format";
import { normalizePhone } from "@/lib/sms";

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
      auto_text_enabled: fd.get("auto_text_enabled") === "on",
      auto_text_template: str(fd, "auto_text_template") ?? org.auto_text_template,
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
