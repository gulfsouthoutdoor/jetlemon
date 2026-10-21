import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** JetLemon staff: emails listed in ADMIN_EMAILS (comma separated). */
export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Use at the top of every admin page and action. Sends non-admins to the dashboard. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdminEmail(user.email)) redirect("/dashboard");
  return user;
}

export type AdminOrg = {
  id: string;
  name: string;
  plan: "starter" | "pro";
  subscription_status: string;
  trial_ends_at: string;
  created_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  sms_number: string | null;
  texting_paused: boolean;
  setup_done: boolean;
  owner_email: string | null;
  members: number;
  customers: number;
  jobs: number;
  texts_this_month: number;
  last_seen: string | null;
};
