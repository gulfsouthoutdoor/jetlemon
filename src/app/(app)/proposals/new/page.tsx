import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getContext } from "@/lib/org";
import { createProposal } from "../actions";

export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ customer?: string; job?: string }> }) {
  const { customer, job } = await searchParams;
  const { supabase } = await getContext();
  const { data: customers } = await supabase.from("customers").select("id, name").order("name");
  return (
    <>
      <PageHeader title="New proposal" subtitle="Pick the customer and give it a name — you'll add the lines next." />
      <Card className="max-w-md">
        <form action={createProposal} className="space-y-4">
          {job && <input type="hidden" name="job_id" value={job} />}
          <Field label="Customer">
            <Select name="customer_id" defaultValue={customer ?? ""} required>
              <option value="">— Choose —</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What's it for">
            <Input name="title" placeholder="Water heater replacement" />
          </Field>
          <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
        </form>
      </Card>
    </>
  );
}
