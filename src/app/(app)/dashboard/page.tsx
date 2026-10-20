import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink, Card, Empty, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/org";
import { date, dateTime, dayKey, fromLocalInput, invoiceTotal, isOverdue, money, time } from "@/lib/format";
import type { Invoice, Job } from "@/lib/types";
import { getTextUsage } from "@/lib/texting";

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  const { supabase, org } = await getContext();
  if (!org.setup_done) redirect("/setup");
  const tz = org.timezone;
  const today = dayKey(new Date(), tz);
  const monthStart = today.slice(0, 8) + "01";
  const startOfToday = fromLocalInput(`${today}T00:00`, tz)!;
  const weekAhead = new Date(new Date(startOfToday).getTime() + 7 * 86_400_000).toISOString();

  const [{ data: upcoming }, { data: openInvoices }, { data: paidThisMonth }, { count: newCustomers }, { data: leads }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, customers(id, name)")
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_at", startOfToday)
      .lt("scheduled_at", weekAhead)
      .order("scheduled_at")
      .limit(20),
    supabase.from("invoices").select("*, customers(id, name), invoice_items(quantity, unit_price)").eq("status", "sent").order("due_on"),
    supabase.from("invoices").select("id, invoice_items(quantity, unit_price)").eq("status", "paid").gte("paid_on", monthStart),
    supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", fromLocalInput(`${monthStart}T00:00`, tz)!),
    supabase.from("jobs").select("*, customers(id, name)").eq("status", "lead").order("created_at", { ascending: false }).limit(5),
  ]);

  const usage = org.sms_number ? await getTextUsage(supabase, org) : null;
  const jobs = (upcoming ?? []) as Job[];
  const todaysJobs = jobs.filter((j) => j.scheduled_at && dayKey(new Date(j.scheduled_at), tz) === today);
  const sent = (openInvoices ?? []) as Invoice[];
  const overdue = sent.filter(isOverdue);
  const outstanding = sent.reduce((s, i) => s + invoiceTotal(i), 0);
  const revenue = (paidThisMonth ?? []).reduce((s, i) => s + invoiceTotal(i as Invoice), 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" })}
        actions={
          <>
            <ButtonLink href="/jobs/new">New job</ButtonLink>
            <ButtonLink href="/customers/new" variant="secondary">
              New customer
            </ButtonLink>
          </>
        }
      />
      {usage && (usage.paused || usage.capReached) && (
        <Link href="/settings" className="mb-6 block rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          {usage.paused ? "Texting is paused" : `Texting stopped: monthly cap reached (${usage.used} of ${usage.allowance} texts)`} — auto-texts and lead alerts are not going out.{" "}
          <span className="font-medium underline">Change in Settings →</span>
        </Link>
      )}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Jobs today" value={String(todaysJobs.length)} href="/schedule" />
        <Stat label="Revenue this month" value={money(revenue)} href="/invoices?status=paid" />
        <Stat label="Outstanding" value={money(outstanding)} href="/invoices?status=sent" />
        <Stat label="New customers (month)" value={String(newCustomers ?? 0)} href="/customers" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Next 7 days" className="lg:col-span-2" action={<Link href="/schedule" className="text-sm text-indigo-600 hover:underline">Schedule →</Link>}>
          {jobs.length === 0 ? (
            <Empty>Nothing scheduled this week.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Link href={`/jobs/${j.id}`} className="font-medium text-indigo-600 hover:underline">
                      {j.title}
                    </Link>
                    <p className="truncate text-slate-500">
                      {j.customers?.name ?? "No customer"}
                      {j.address ? ` · ${j.address}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-slate-600">
                    {dayKey(new Date(j.scheduled_at!), tz) === today ? `Today ${time(j.scheduled_at!, tz)}` : dateTime(j.scheduled_at, tz)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title={`Overdue invoices (${overdue.length})`}>
            {overdue.length === 0 ? (
              <p className="text-sm text-slate-500">All caught up 🎉</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {overdue.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <Link href={`/invoices/${i.id}`} className="text-indigo-600 hover:underline">
                      #{i.number} {i.customers?.name}
                    </Link>
                    <span className="text-red-600">{money(invoiceTotal(i))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Recent leads" action={<Link href="/jobs?status=lead" className="text-sm text-indigo-600 hover:underline">All →</Link>}>
            {(leads ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No open leads.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(leads as Job[]).map((j) => (
                  <li key={j.id}>
                    <div className="flex justify-between gap-2">
                      <Link href={`/jobs/${j.id}`} className="truncate text-indigo-600 hover:underline">
                        {j.title}
                      </Link>
                      <span className="shrink-0 text-slate-400">{date(j.created_at)}</span>
                    </div>
                    {j.ai_summary && <p className="text-xs text-slate-500">{j.ai_summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
