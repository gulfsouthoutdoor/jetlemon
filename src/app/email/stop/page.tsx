import { unsubscribeToken } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// The "stop these emails" link at the bottom of every customer email. No login — the link is signed.
export default async function StopEmailsPage({ searchParams }: { searchParams: Promise<{ c?: string; t?: string }> }) {
  const { c, t } = await searchParams;
  let business: string | null = null;
  let ok = false;
  if (c && t && t === unsubscribeToken(c)) {
    const admin = createAdminClient();
    const { data } = await admin.from("customers").update({ email_opt_out: true }).eq("id", c).select("organizations(name)").maybeSingle();
    const org = data?.organizations as unknown as { name: string } | null;
    business = org?.name ?? null;
    ok = Boolean(data);
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        {ok ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900">You&apos;re unsubscribed</h1>
            <p className="mt-2 text-sm text-slate-600">{business ? `${business} won't` : "We won't"} send you any more emails like that one.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900">That link didn&apos;t work</h1>
            <p className="mt-2 text-sm text-slate-600">Open the link from the email again, or reply to the email and ask to be removed.</p>
          </>
        )}
      </div>
    </main>
  );
}
