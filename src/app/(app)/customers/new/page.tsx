import { Card, PageHeader } from "@/components/ui";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="New customer" />
      <Card className="max-w-2xl">
        <CustomerForm action={createCustomer} submitLabel="Create customer" />
      </Card>
    </>
  );
}
