import Link from "next/link";
import { Badge, ButtonLink, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/org";
import { dayKey, fromLocalInput, time } from "@/lib/format";
import type { Job } from "@/lib/types";

/** Adds days to a YYYY-MM-DD string. */
const addDays = (d: string, n: number) => {
  const t = new Date(d + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const weekday = (d: string) => new Date(d + "T12:00:00Z").getUTCDay(); // 0 = Sunday

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const { supabase, org } = await getContext();
  const tz = org.timezone;
  const today = dayKey(new Date(), tz);

  const anchor = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today;
  const monday = addDays(anchor, -((weekday(anchor) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const { data } = await supabase
    .from("jobs")
    .select("*, customers(id, name)")
    .neq("status", "cancelled")
    .gte("scheduled_at", fromLocalInput(`${monday}T00:00`, tz)!)
    .lt("scheduled_at", fromLocalInput(`${addDays(monday, 7)}T00:00`, tz)!)
    .order("scheduled_at");
  const jobs = (data ?? []) as Job[];
  const byDay = new Map<string, Job[]>();
  for (const j of jobs) {
    const k = dayKey(new Date(j.scheduled_at!), tz);
    byDay.set(k, [...(byDay.get(k) ?? []), j]);
  }

  const label = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`Week of ${label(monday, { month: "long", day: "numeric", year: "numeric" })} · ${jobs.length} jobs`}
        actions={
          <>
            <ButtonLink variant="secondary" href={`/schedule?week=${addDays(monday, -7)}`}>
              ← Prev
            </ButtonLink>
            <ButtonLink variant="secondary" href="/schedule">
              Today
            </ButtonLink>
            <ButtonLink variant="secondary" href={`/schedule?week=${addDays(monday, 7)}`}>
              Next →
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => (
          <div key={d} className={`flex min-h-40 flex-col rounded-lg border bg-white ${d === today ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"}`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">{label(d, { weekday: "short" })}</p>
                <p className={`text-lg font-semibold ${d === today ? "text-indigo-600" : "text-slate-900"}`}>{label(d, { day: "numeric" })}</p>
              </div>
              <Link href={`/jobs/new?date=${d}`} className="rounded px-1.5 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Add job">
                +
              </Link>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {(byDay.get(d) ?? []).map((j) => (
                <Link key={j.id} href={`/jobs/${j.id}`} className="block rounded-md border border-slate-200 bg-slate-50 p-2 text-xs hover:border-indigo-300 hover:bg-indigo-50">
                  <p className="font-semibold text-slate-900">{time(j.scheduled_at!, tz)}</p>
                  <p className="truncate text-slate-700">{j.title}</p>
                  {j.customers && <p className="truncate text-slate-500">{j.customers.name}</p>}
                  <div className="mt-1">
                    <Badge status={j.status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
