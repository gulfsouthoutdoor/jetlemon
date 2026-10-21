"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/format";

const TYPES: EmailOtpType[] = ["recovery", "signup", "invite", "magiclink", "email_change", "email"];

/** Spends the one-time token from an email link. Only runs when a person presses Continue. */
export async function confirmLink(fd: FormData) {
  const token_hash = str(fd, "token_hash") ?? "";
  const type = str(fd, "type") as EmailOtpType;
  const next = str(fd, "next");
  if (!token_hash || !TYPES.includes(type)) redirect("/login?error=" + encodeURIComponent("That link is missing its code. Request a new one."));

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) {
    const msg = /expired|invalid|not found/i.test(error.message) ? "That link has expired or was already used. Request a new one." : error.message;
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }
  await supabase.rpc("accept_invitations");

  if (type === "recovery") redirect("/reset");
  if (type === "signup") redirect("/onboarding");
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}
