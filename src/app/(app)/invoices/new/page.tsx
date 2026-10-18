import { Button, Card, Field, PageHeader, Select } from "@/components/ui";
import { getContext } from "@/lib/org";
import { createInvoice } from "../actions";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const { supabase } = await getContext();
  const { data: customers } = await supabase.from("customers").select("id, name").order("name");
  return (
    <>
      <PageHeader title="New invoice" subtitle="Pick a customer — you'll add line items next." />
      <Card className="max-w-md">
        <form action={createInvoice} className="space-y-4">
          <Field label="Customer">
            <Select name="customer_id" defaultValue={customer ?? ""}>
              <option value="">— None —</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button>Create draft</Button>
        </form>
      </Card>
    </>
  );
}
