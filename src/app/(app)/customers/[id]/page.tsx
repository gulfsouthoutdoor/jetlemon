import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, ButtonLink, Card, Empty, ErrorNote, PageHeader, Textarea } from "@/components/ui";
import { getContext } from "@/lib/org";
import { dateTime, invoiceTotal, money } from "@/lib/format";
import type { Customer, Invoice, Job, Message } from "@/lib/types";
import { addNote, deleteCustomer, deleteNote, sendText, updateCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, org } = await getContext();

  const [{ data: customer }, { data: jobs }, { data: invoices }, { data: notes }, { data: messages }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("jobs").select("*").eq("customer_id", id).order("scheduled_at", { ascending: false, nullsFirst: true }),
    supabase.from("invoices").select("*, invoice_items(quantity, unit_price)").eq("customer_id", id).order("number", { ascending: false }),
    supabase.from("notes").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("messages").select("*").eq("customer_id", id).order("created_at").limit(200),
  ]);
  if (!customer) notFound();
  const c = customer as Customer;
  const lifetime = ((invoices ?? []) as Invoice[]).filter((i) => i.status === "paid").reduce((s, i) => s + invoiceTotal(i), 0);

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={
          <>
            {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info"} · Lifetime revenue {money(lifetime)}
          </>
        }
        actions={
          <>
            <ButtonLink href={`/jobs/new?customer=${c.id}`}>New job</ButtonLink>
            <ButtonLink variant="secondary" href={`/invoices/new?customer=${c.id}`}>
              New invoice
            </ButtonLink>
          </>
        }
      />

      <ErrorNote message={error} />
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Text messages">
            {(messages as Message[])?.length ? (
              <ul className="mb-4 flex max-h-96 flex-col gap-2 overflow-y-auto">
                {(messages as Message[]).map((m) => (
                  <li key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        m.direction === "out" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={`mt-1 text-[11px] ${m.direction === "out" ? "text-indigo-200" : "text-slate-400"}`}>
                        {dateTime(m.created_at, org.timezone)}
                        {m.kind === "auto_text" ? " · auto" : ""}
                        {m.status.startsWith("failed") ? " · not delivered" : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{c.phone ? "No texts yet." : "Add a phone number to text this customer."}</Empty>
            )}
            <form action={sendText.bind(null, c.id)} className="flex gap-2">
              <Textarea name="body" rows={2} placeholder={org.sms_number ? "Type a text…" : "Texting needs a number — see Settings"} required disabled={!org.sms_number || !c.phone} />
              <Button disabled={!org.sms_number || !c.phone}>Send</Button>
            </form>
          </Card>

          <Card title="Jobs">
            {(jobs as Job[])?.length ? (
              <ul className="divide-y divide-slate-100">
                {(jobs as Job[]).map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link href={`/jobs/${j.id}`} className="font-medium text-indigo-600 hover:underline">
                      {j.title}
                    </Link>
                    <span className="flex items-center gap-3 text-slate-500">
                      {dateTime(j.scheduled_at, org.timezone)} <Badge status={j.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No jobs yet.</Empty>
            )}
          </Card>

          <Card title="Invoices">
            {(invoices as Invoice[])?.length ? (
              <ul className="divide-y divide-slate-100">
                {(invoices as Invoice[]).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link href={`/invoices/${i.id}`} className="font-medium text-indigo-600 hover:underline">
                      #{i.number}
                    </Link>
                    <span className="flex items-center gap-3 text-slate-500">
                      {money(invoiceTotal(i))} <Badge status={i.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No invoices yet.</Empty>
            )}
          </Card>

          <Card title="Details">
            <CustomerForm action={updateCustomer.bind(null, c.id)} customer={c} submitLabel="Save changes" />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Activity notes">
            <form action={addNote.bind(null, c.id)} className="mb-4 space-y-2">
              <Textarea name="body" placeholder="Called about rescheduling…" required />
              <Button variant="secondary">Add note</Button>
            </form>
            <ul className="space-y-3">
              {(notes ?? []).map((n) => (
                <li key={n.id} className="rounded-md bg-slate-50 p-3 text-sm">
                  <p className="whitespace-pre-wrap text-slate-800">{n.body}</p>
                  <div className="mt-1 flex justify-between text-xs text-slate-400">
                    {dateTime(n.created_at, org.timezone)}
                    <form action={deleteNote.bind(null, c.id, n.id)}>
                      <button className="hover:text-red-600">Delete</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <form action={deleteCustomer.bind(null, c.id)}>
            <Button variant="danger" className="w-full">
              Delete customer
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
