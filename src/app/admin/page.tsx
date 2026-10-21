import Link from "next/link";
import { Wordmark } from "@/components/auth-shell";
import { Badge, Button, ErrorNote, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin, type AdminOrg } from "@/lib/admin";
import { date, dateTime } from "@/lib/format";
import { PLANS, isComplimentary } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { comp, deleteBusiness, extendTrial, setNumber, setPlan, togglePause, uncomp } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; q?: string }> }) {
  await requireAdmin();
  const { saved, error, q } = await searchParams;
  const { data, error: loadError } = await createAdminClient().rpc("admin_orgs");
  const all = ((data ?? []) as AdminOrg[]).filter((o) => !q || `${o.name} ${o.owner_email ?? ""} ${o.sms_number ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  const paying = all.filter((o) => o.stripe_subscription_id && o.subscription_status === "active");
  const mrr = paying.reduce((s, o) => s + PLANS[o.plan].price, 0);
  const stat = (l: string, v: string | number) => (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{v}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Wordmark className="h-7" /> <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white">Admin</span>
          </p>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
            ← Back to the app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <ErrorNote message={error ?? loadError?.message} />
        {saved && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{saved}</p>}

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {stat("Businesses", all.length)}
          {stat("On trial", all.filter((o) => o.subscription_status === "trialing").length)}
          {stat("Paying", paying.length)}
          {stat("Monthly revenue", `$${mrr.toLocaleString()}`)}
          {stat("Texting numbers", all.filter((o) => o.sms_number).length)}
        </div>

        <form className="mb-4">
          <Input name="q" defaultValue={q} placeholder="Search by business, owner email, or number…" />
        </form>

        <div className="space-y-4">
          {all.map((o) => {
            const comped = isComplimentary(o);
            const trialDays = Math.ceil((new Date(o.trial_ends_at).getTime() - Date.now()) / 86_400_000);
            return (
              <section key={o.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{o.name}</p>
                    <p className="text-sm text-slate-500">
                      {o.owner_email ?? "no owner"} · joined {date(o.created_at)} · last seen {o.last_seen ? dateTime(o.last_seen, "America/Chicago") : "never"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge status={o.subscription_status === "active" ? "paid" : o.subscription_status === "trialing" ? "scheduled" : "cancelled"} />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{PLANS[o.plan].name}</span>
                    {comped && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Complimentary</span>}
                    {o.subscription_status === "trialing" && <span className="text-slate-500">{trialDays > 0 ? `${trialDays} days left` : "trial ended"}</span>}
                    {!o.setup_done && <span className="text-amber-700">setup not finished</span>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-4">
                  <span>{o.members} team member{o.members === 1 ? "" : "s"}</span>
                  <span>{o.customers} customers</span>
                  <span>{o.jobs} jobs</span>
                  <span>
                    {o.texts_this_month} texts this month{o.texting_paused ? " · paused" : ""}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm lg:grid-cols-4">
                  <form action={setNumber.bind(null, o.id)} className="flex gap-2">
                    <Input name="sms_number" defaultValue={o.sms_number ?? ""} placeholder="Texting number" />
                    <SubmitButton variant="secondary" pendingLabel="…">
                      Set
                    </SubmitButton>
                  </form>

                  <form action={setPlan.bind(null, o.id)} className="flex gap-2">
                    <Select name="plan" defaultValue={o.plan}>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                    </Select>
                    <SubmitButton variant="secondary" pendingLabel="…">
                      Plan
                    </SubmitButton>
                  </form>

                  <form action={extendTrial.bind(null, o.id)} className="flex gap-2">
                    <Input name="days" type="number" defaultValue={14} min={1} max={365} className="w-24" aria-label="Days" />
                    <SubmitButton variant="secondary" pendingLabel="…">
                      Extend trial
                    </SubmitButton>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    {comped ? (
                      <form action={uncomp.bind(null, o.id)}>
                        <Button variant="secondary">Remove comp</Button>
                      </form>
                    ) : (
                      <form action={comp.bind(null, o.id)} className="flex gap-1">
                        <input type="hidden" name="plan" value="pro" />
                        <Button variant="secondary">Comp (Pro)</Button>
                      </form>
                    )}
                    <form action={togglePause.bind(null, o.id, !o.texting_paused)}>
                      <Button variant="secondary">{o.texting_paused ? "Resume texting" : "Pause texting"}</Button>
                    </form>
                  </div>
                </div>

                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer hover:text-red-600">Delete this business…</summary>
                  <form action={deleteBusiness.bind(null, o.id)} className="mt-2 flex items-center gap-2">
                    <Input name="confirm" placeholder="Type DELETE" className="w-40" />
                    <Button variant="danger">Delete {o.name} and all its data</Button>
                  </form>
                </details>
              </section>
            );
          })}
          {all.length === 0 && <p className="text-sm text-slate-500">No businesses match.</p>}
        </div>
      </main>
    </div>
  );
}
