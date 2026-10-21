import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { statusLabel, toLocalInput } from "@/lib/format";
import { JOB_STATUSES, type Job, type Member } from "@/lib/types";

export function JobForm({
  action,
  job,
  customers,
  members,
  defaultCustomerId,
  defaultDate,
  timeZone,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  job?: Job;
  customers: { id: string; name: string }[];
  members: Member[];
  defaultCustomerId?: string;
  defaultDate?: string;
  timeZone: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Job title" className="sm:col-span-2">
        <Input name="title" required defaultValue={job?.title} placeholder="e.g. Deep clean — 3 bed house" />
      </Field>
      <Field label="Customer">
        <Select name="customer_id" defaultValue={job?.customer_id ?? defaultCustomerId ?? ""}>
          <option value="">— None —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={job?.status ?? "scheduled"}>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date & time">
        <Input type="datetime-local" name="scheduled_at" defaultValue={job ? toLocalInput(job.scheduled_at, timeZone) : defaultDate} />
      </Field>
      <Field label="Duration (minutes)">
        <Input type="number" name="duration_minutes" min={0} step={15} defaultValue={job?.duration_minutes ?? 60} />
      </Field>
      <Field label="Price ($)">
        <Input type="number" name="price" min={0} step="0.01" defaultValue={job?.price ?? ""} />
      </Field>
      <Field label="Assigned to">
        <Select name="assigned_to" defaultValue={job?.assigned_to ?? ""}>
          <option value="">— Unassigned —</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.email}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Address (defaults to customer's)" className="sm:col-span-2">
        <Input name="address" defaultValue={job?.address ?? ""} />
      </Field>
      <Field label="Description / instructions" className="sm:col-span-2">
        <Textarea name="description" defaultValue={job?.description ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
