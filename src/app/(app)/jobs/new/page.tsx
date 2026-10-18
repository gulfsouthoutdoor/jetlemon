import { Card, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/org";
import type { Member } from "@/lib/types";
import { createJob } from "../actions";
import { JobForm } from "../job-form";

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ customer?: string; date?: string }> }) {
  const { customer, date } = await searchParams;
  const { supabase, org } = await getContext();
  const [{ data: customers }, { data: members }] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase.rpc("org_members", { target_org: org.id }),
  ]);
  return (
    <>
      <PageHeader title="New job" />
      <Card className="max-w-2xl">
        <JobForm
          action={createJob}
          customers={customers ?? []}
          members={(members ?? []) as Member[]}
          defaultCustomerId={customer}
          defaultDate={date ? `${date}T09:00` : undefined}
          timeZone={org.timezone}
          submitLabel="Create job"
        />
      </Card>
    </>
  );
}
