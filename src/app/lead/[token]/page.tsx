import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// Public, hosted lead form. Posts straight to the business's lead address.
export default async function LeadFormPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { token } = await params;
  const { sent } = await searchParams;
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("name, phone, lead_form_intro").eq("inbound_token", token).maybeSingle();
  if (!org) notFound();

  const input = "w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-slate-900 focus:outline-none";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{org.name}</h1>
        {sent ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-3 text-emerald-800">Thanks — we got your request and will be in touch shortly.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">{org.lead_form_intro || "Tell us what you need and we'll get right back to you."}</p>
            <form action={`/api/leads/${token}`} method="post" className="mt-5 space-y-3">
              <input type="hidden" name="source" value="website" />
              <input type="hidden" name="redirect" value={`${process.env.NEXT_PUBLIC_SITE_URL}/lead/${token}?sent=1`} />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
                <input name="name" required className={input} autoComplete="name" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Phone</span>
                <input name="phone" type="tel" required className={input} autoComplete="tel" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
                <input name="email" type="email" className={input} autoComplete="email" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Address</span>
                <input name="address" className={input} autoComplete="street-address" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">What do you need?</span>
                <textarea name="message" rows={3} className={input} />
              </label>
              <button className="w-full rounded-md bg-slate-900 px-4 py-3 text-base font-medium text-white hover:bg-slate-700">Send request</button>
              <p className="text-xs text-slate-500">By sending, you agree that {org.name} may call or text you about your request. Message and data rates may apply.</p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
