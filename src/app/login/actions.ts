"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/format";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(formData, "email") ?? "",
    password: (formData.get("password") as string) ?? "",
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  await supabase.rpc("accept_invitations");
  const next = str(formData, "next");
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: str(formData, "email") ?? "",
    password: (formData.get("password") as string) ?? "",
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);

  // If email confirmation is disabled, a session exists right away.
  if (data.session) {
    await supabase.rpc("accept_invitations");
    redirect("/onboarding");
  }
  redirect("/login?message=" + encodeURIComponent("Check your email to confirm your account, then sign in."));
}

export async function sendReset(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const email = str(formData, "email") ?? "";
  // Always report success so the form can't be used to check which emails exist.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset` });
  redirect("/forgot?sent=1");
}

export async function setNewPassword(formData: FormData) {
  const supabase = await createClient();
  const password = (formData.get("password") as string) ?? "";
  if (password.length < 8) redirect("/reset?error=Use+at+least+8+characters");
  if (password !== formData.get("confirm")) redirect("/reset?error=The+two+passwords+don%27t+match");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
