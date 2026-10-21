import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { getContext } from "@/lib/org";
import { date, isOverdue, money } from "@/lib/format";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { addItem, deleteInvoice, removeItem, setInvoiceStatus, updateInvoice } from "../actions";
import { CopyField } from "@/components/copy-field";
import { payUrl, syncInvoicePayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, org } = await getContext();
  const [{ data }, { data: itemRows }, { data: customers }] = await Promise.all([
    supabase.from("invoices").select("*, customers(id, name, email, address)").eq("id", id).maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at"),
    supabase.from("customers").select("id, name").order("name"),
  ]);
  if (!data) notFound();
  const inv = data as Invoice;
  // A card payment may have landed since the page was last opened.
  if (inv.status === "sent" && inv.stripe_checkout_session_id) {
    const status = await syncInvoicePayment(createAdminClient(), inv, org.stripe_account_id);
    if (status === "paid") {
      inv.status = "paid";
      inv.paid_on = new Date().toISOString().slice(0, 10);
      inv.paid_via = "card";
    }
  }
  const payLink = payUrl(inv.pay_token);
  const cardPay = org.stripe_charges_enabled && org.pay_online;
  const items = (itemRows ?? []) as InvoiceItem[];
  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const editable = inv.status === "draft" || inv.status === "sent";

  const mailto =
    inv.customers?.email &&
    `mailto:${inv.customers.email}?subject=${encodeURIComponent(`Invoice #${inv.number} from ${org.name}`)}&body=${encodeURIComponent(
      `Hi ${inv.customers.name},\n\nPlease find your invoice #${inv.number} for ${money(total)}, due ${date(inv.due_on)}.\n\n${cardPay ? "Pay by card here: " : "View it here: "}${payLink}\n\nThank you for your business!\n${org.name}`,
    )}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/invoices" className="text-sm text-slate-500 hover:text-slate-900">
          ← All invoices
        </Link>
        <div className="flex flex-wrap gap-2">
          {inv.status === "draft" && (
            <form action={setInvoiceStatus.bind(null, inv.id, "sent")}>
              <Button>Mark as sent</Button>
            </form>
          )}
          {inv.status === "sent" && (
            <form action={setInvoiceStatus.bind(null, inv.id, "paid")}>
              <Button>Mark as paid</Button>
            </form>
          )}
          {mailto && (
            <a href={mailto} className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              Email customer
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      {inv.status !== "draft" && (
        <div className="mb-6 rounded-md border border-slate-200 bg-white p-4 print:hidden">
          <p className="mb-2 text-sm font-medium text-slate-700">
            {cardPay ? "Pay link — customers can pay by card here" : "Customer link — they can view the invoice here"}
          </p>
          <CopyField value={payLink} />
          {!cardPay && (
            <p className="mt-2 text-xs text-slate-500">
              Connect Stripe under <Link href="/settings#payments" className="text-indigo-600 hover:underline">Settings → Get paid online</Link> and this link takes card payments.
            </p>
          )}
        </div>
      )}

      {/* Printable invoice */}
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap justify-between gap-6">
          <div>
            <p className="text-xl font-semibold text-slate-900">{org.name}</p>
            <p className="whitespace-pre-line text-sm text-slate-500">{[org.address, org.phone, org.email].filter(Boolean).join("\n")}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-900">Invoice #{inv.number}</p>
            <div className="mt-1 print:hidden">
              <Badge status={isOverdue(inv) ? "overdue" : inv.status} />
            </div>
            <p className="mt-2 text-sm text-slate-500">Issued {date(inv.issued_on)}</p>
            <p className="text-sm text-slate-500">Due {date(inv.due_on)}</p>
            {inv.paid_on && (
              <p className="text-sm font-medium text-emerald-600">
                Paid {date(inv.paid_on)}
                {inv.paid_via === "card" ? " by card" : ""}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Bill to</p>
          <p className="font-medium text-slate-900">{inv.customers?.name ?? "—"}</p>
          {inv.customers?.address && <p className="text-sm text-slate-500">{inv.customers.address}</p>}
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2">Description</th>
              <th className="w-20 py-2 text-right">Qty</th>
              <th className="w-28 py-2 text-right">Price</th>
              <th className="w-28 py-2 text-right">Amount</th>
              {editable && <th className="w-10 print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2.5 text-slate-800">{it.description}</td>
                <td className="py-2.5 text-right">{Number(it.quantity)}</td>
                <td className="py-2.5 text-right">{money(it.unit_price)}</td>
                <td className="py-2.5 text-right">{money(Number(it.quantity) * Number(it.unit_price))}</td>
                {editable && (
                  <td className="text-right print:hidden">
                    <form action={removeItem.bind(null, inv.id, it.id)}>
                      <button className="text-slate-400 hover:text-red-600" aria-label="Remove item">
                        ×
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-4 text-right font-medium text-slate-900">
                Total
              </td>
              <td className="pt-4 text-right text-lg font-semibold text-slate-900">{money(total)}</td>
            </tr>
          </tfoot>
        </table>

        {editable && (
          <form action={addItem.bind(null, inv.id)} className="mt-4 grid gap-2 sm:grid-cols-[1fr_6rem_8rem_auto] print:hidden">
            <Input name="description" placeholder="Add line item…" required />
            <Input name="quantity" type="number" step="0.01" defaultValue={1} aria-label="Quantity" />
            <Input name="unit_price" type="number" step="0.01" placeholder="Price" aria-label="Unit price" />
            <Button variant="secondary">Add</Button>
          </form>
        )}

        {inv.notes && <p className="mt-8 whitespace-pre-line border-t border-slate-100 pt-4 text-sm text-slate-600">{inv.notes}</p>}
        {org.invoice_footer && <p className="mt-6 text-center text-xs text-slate-500">{org.invoice_footer}</p>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3 print:hidden">
        <Card title="Invoice settings" className="lg:col-span-2">
          <form action={updateInvoice.bind(null, inv.id)} className="grid gap-4 sm:grid-cols-3">
            <Field label="Customer" className="sm:col-span-3">
              <Select name="customer_id" defaultValue={inv.customer_id ?? ""}>
                <option value="">— None —</option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Issued">
              <Input type="date" name="issued_on" defaultValue={inv.issued_on} required />
            </Field>
            <Field label="Due">
              <Input type="date" name="due_on" defaultValue={inv.due_on} required />
            </Field>
            <Field label="Notes / payment instructions" className="sm:col-span-3">
              <Textarea name="notes" defaultValue={inv.notes ?? ""} />
            </Field>
            <div>
              <Button>Save</Button>
            </div>
          </form>
        </Card>
        <div className="space-y-3">
          {inv.status !== "void" && inv.status !== "paid" && (
            <form action={setInvoiceStatus.bind(null, inv.id, "void")}>
              <Button variant="secondary" className="w-full">
                Void invoice
              </Button>
            </form>
          )}
          {inv.status !== "draft" && inv.status !== "sent" && (
            <form action={setInvoiceStatus.bind(null, inv.id, "draft")}>
              <Button variant="secondary" className="w-full">
                Reopen as draft
              </Button>
            </form>
          )}
          <form action={deleteInvoice.bind(null, inv.id)}>
            <Button variant="danger" className="w-full">
              Delete invoice
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
