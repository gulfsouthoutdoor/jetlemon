import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/org";
import { refreshConnect } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe sends the owner back here after onboarding (return_url) or if the link expired (refresh_url).
export async function GET(request: NextRequest) {
  const { org } = await getContext();
  const { searchParams, origin } = new URL(request.url);
  const enabled = await refreshConnect(createAdminClient(), org);
  const msg = searchParams.get("refresh")
    ? "That Stripe link expired — press Connect Stripe again."
    : enabled
      ? "Stripe connected. Customers can now pay your invoices by card."
      : "Stripe isn't finished yet — press Connect Stripe to pick up where you left off.";
  return NextResponse.redirect(`${origin}/settings?${enabled ? "saved" : "error"}=${encodeURIComponent(msg)}#payments`);
}
