import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, listPages, subscribePage } from "@/lib/meta";
import { getContext } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";

// Facebook sends the user back here after they pick which pages to share.
export async function GET(request: NextRequest) {
  const { org, user, role } = await getContext();
  const back = (msg: string, ok = false) => NextResponse.redirect(new URL(`/settings?${ok ? "saved" : "error"}=${encodeURIComponent(msg)}`, request.url));
  if (role !== "owner") return back("Only the owner can connect Facebook");

  const q = request.nextUrl.searchParams;
  if (q.get("error")) return back(q.get("error_description") ?? "Facebook connection was cancelled");
  const code = q.get("code");
  const state = q.get("state");
  if (!code || !state || state !== request.cookies.get("meta_oauth_state")?.value) return back("Facebook connection could not be verified. Try again.");

  try {
    const userToken = await exchangeCode(code, `${process.env.NEXT_PUBLIC_SITE_URL}/api/meta/callback`);
    const pages = await listPages(userToken);
    if (pages.length === 0) return back("No Facebook pages were shared. Try again and tick the page you run ads from.");

    const admin = createAdminClient();
    for (const p of pages) {
      await subscribePage(p.id, p.access_token);
      await admin
        .from("meta_pages")
        .upsert({ org_id: org.id, page_id: p.id, page_name: p.name, access_token: p.access_token, connected_by: user.id }, { onConflict: "page_id" });
    }
    const res = back(`Connected ${pages.length} Facebook page${pages.length === 1 ? "" : "s"}.`, true);
    res.cookies.delete("meta_oauth_state");
    return res;
  } catch (err) {
    return back(`Facebook: ${(err as Error).message}`);
  }
}
