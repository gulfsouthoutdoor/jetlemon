import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the email-confirmation link from Supabase.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await supabase.rpc("accept_invitations");
      return NextResponse.redirect(`${origin}${next && next.startsWith("/") ? next : "/dashboard"}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Could not verify your link. Please sign in.")}`);
}
