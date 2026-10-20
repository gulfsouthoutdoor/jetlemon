import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { META_SCOPES, metaConfigured } from "@/lib/meta";
import { getContext } from "@/lib/org";

// "Connect Facebook" button → Facebook's permission dialog → /api/meta/callback.
export async function GET(request: NextRequest) {
  const { role } = await getContext();
  if (role !== "owner") return NextResponse.redirect(new URL("/settings?error=Only+the+owner+can+connect+Facebook", request.url));
  if (!metaConfigured()) return NextResponse.redirect(new URL("/settings?error=Facebook+is+not+set+up+on+this+server+yet", request.url));

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/meta/callback`;
  const dialog = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  dialog.searchParams.set("client_id", process.env.META_APP_ID!);
  dialog.searchParams.set("redirect_uri", redirectUri);
  dialog.searchParams.set("scope", META_SCOPES);
  dialog.searchParams.set("state", state);
  dialog.searchParams.set("response_type", "code");

  const res = NextResponse.redirect(dialog);
  res.cookies.set("meta_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/meta", maxAge: 600 });
  return res;
}
