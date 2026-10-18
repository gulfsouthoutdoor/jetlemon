import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/org";
import { dateTime, money } from "@/lib/format";
import type { Job, Member } from "@/lib/types";
import { deleteJob, invoiceJob, setJobStatus, updateJob } from "../actions";
import { JobForm } from "../job-form";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, org } = await getContext();
  const [{ data }, { data: customers }, { data: members }, { data: invoices }] = await Promise.all([
    supabase.from("jobs").select("*, customers(id, name)").eq("id", id).maybeSingle(),
    supabase.from("customers").select("id, name").order("name"),
    supabase.rpc("org_members", { target_org: org.id }),
    supabase.from("invoices").select("id, number, status").eq("job_id", id),
  ]);
  if (!data) notFound();
  const job = data as Job;

  const next: Record<string, { status: Job["status"]; label: string } | undefined> = {
    lead: { status: "scheduled", label: "Mark scheduled" },
    scheduled: { status: "in_progress", label: "Start job" },
    in_progress: { status: "completed", label: "Mark completed" },
  };
  const step = next[job.status];

  return (
    <>
      <PageHeader
        title={job.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge status={job.status} />
            {dateTime(job.scheduled_at, org.timezone)} · {money(job.price)}
            {job.customers && (
              <>
                ·{" "}
                <Link href={`/customers/${job.customers.id}`} className="text-indigo-600 hover:underline">
                  {job.customers.name}
                </Link>
              </>
            )}
          </span>
        }
        actions={
          <>
            {step && (
              <form action={setJobStatus.bind(null, job.id, step.status)}>
                <Button>{step.label}</Button>
              </form>
            )}
            <form action={invoiceJob.bind(null, job.id)}>
              <Button variant="secondary">Create invoice</Button>
            </form>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Job details" className="lg:col-span-2">
          <JobForm
            action={updateJob.bind(null, job.id)}
            job={job}
            customers={customers ?? []}
            members={(members ?? []) as Member[]}
            timeZone={org.timezone}
            submitLabel="Save changes"
          />
        </Card>
        <div className="space-y-6">
          {job.address && (
            <Card title="Location">
              <p className="text-sm text-slate-700">{job.address}</p>
              <a
                className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Maps →
              </a>
            </Card>
          )}
          <Card title="Invoices">
            {invoices?.length ? (
              <ul className="space-y-2 text-sm">
                {invoices.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <Link href={`/invoices/${i.id}`} className="text-indigo-600 hover:underline">
                      #{i.number}
                    </Link>
                    <Badge status={i.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Not invoiced yet.</p>
            )}
          </Card>
          <form action={deleteJob.bind(null, job.id)}>
            <Button variant="danger" className="w-full">
              Delete job
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
