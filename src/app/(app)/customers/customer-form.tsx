import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { Customer } from "@/lib/types";

export function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  customer?: Customer;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" required defaultValue={customer?.name} />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" defaultValue={customer?.phone ?? ""} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={customer?.email ?? ""} />
      </Field>
      <Field label="Service address" className="sm:col-span-2">
        <Input name="address" defaultValue={customer?.address ?? ""} />
      </Field>
      <Field label="Tags (comma separated)" className="sm:col-span-2">
        <Input name="tags" placeholder="residential, VIP" defaultValue={customer?.tags.join(", ")} />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea name="notes" defaultValue={customer?.notes ?? ""} placeholder="Gate code, pets, preferences…" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
