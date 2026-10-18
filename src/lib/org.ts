import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/types";

/** Returns the signed-in user, their Supabase client, and their current business. */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, organizations(*)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership?.organizations) redirect("/onboarding");

  return {
    supabase,
    user,
    org: membership.organizations as unknown as Organization,
    role: membership.role as "owner" | "member",
  };
});

export function hasActiveAccess(org: Organization) {
  if (org.subscription_status === "active" || org.subscription_status === "past_due") return true;
  if (org.subscription_status === "trialing") return new Date(org.trial_ends_at) > new Date();
  return false;
}
