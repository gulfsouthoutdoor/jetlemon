"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { str } from "@/lib/format";

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

export async function removeMember(userId: string) {
  const { supabase, org } = await getContext();
  await supabase.from("memberships").delete().eq("org_id", org.id).eq("user_id", userId);
  revalidatePath("/settings");
}
