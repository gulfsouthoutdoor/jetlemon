import Link from "next/link";
import { Badge, ButtonLink, Card, Empty, PageHeader, tableClass, tdClass, thClass } from "@/components/ui";
import { getContext } from "@/lib/org";
import { dateTime, money, statusLabel } from "@/lib/format";
import { JOB_STATUSES, type Job } from "@/lib/types";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase, org } = await getContext();

  let query = supabase
    .from("jobs")
    .select("*, customers(id, name)")
    .order("scheduled_at", { ascending: status === "completed" ? false : true, nullsFirst: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  else query = query.in("status", ["lead", "scheduled", "in_progress"]);
  const { data } = await query;
  const jobs = (data ?? []) as Job[];

  const tabs = [{ key: undefined, label: "Open" }, ...JOB_STATUSES.map((s) => ({ key: s, label: statusLabel(s) }))];

  return (
    <>
      <PageHeader title="Jobs" actions={<ButtonLink href="/jobs/new">New job</ButtonLink>} />
      <div className="mb-4 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={t.key ? `/jobs?status=${t.key}` : "/jobs"}
            className={`rounded-full px-3 py-1 text-sm ${
              status === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Card>
        {jobs.length === 0 ? (
          <Empty>No jobs here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Job</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>When</th>
                  <th className={thClass}>Price</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50">
                    <td className={tdClass}>
                      <Link href={`/jobs/${j.id}`} className="font-medium text-indigo-600 hover:underline">
                        {j.title}
                      </Link>
                    </td>
                    <td className={tdClass}>{j.customers?.name ?? "—"}</td>
                    <td className={tdClass}>{dateTime(j.scheduled_at, org.timezone)}</td>
                    <td className={tdClass}>{money(j.price)}</td>
                    <td className={tdClass}>
                      <Badge status={j.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
