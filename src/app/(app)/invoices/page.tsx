import Link from "next/link";
import { Badge, ButtonLink, Card, Empty, PageHeader, tableClass, tdClass, thClass } from "@/components/ui";
import { getContext } from "@/lib/org";
import { date, invoiceTotal, isOverdue, money, statusLabel } from "@/lib/format";
import { INVOICE_STATUSES, type Invoice } from "@/lib/types";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase } = await getContext();

  let query = supabase.from("invoices").select("*, customers(id, name), invoice_items(quantity, unit_price)").order("number", { ascending: false }).limit(300);
  if (status) query = query.eq("status", status);
  const { data } = await query;
  const invoices = (data ?? []) as Invoice[];
  const outstanding = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + invoiceTotal(i), 0);

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={status ? undefined : `${money(outstanding)} outstanding`}
        actions={<ButtonLink href="/invoices/new">New invoice</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap gap-1">
        {[undefined, ...INVOICE_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/invoices?status=${s}` : "/invoices"}
            className={`rounded-full px-3 py-1 text-sm ${
              status === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {s ? statusLabel(s) : "All"}
          </Link>
        ))}
      </div>
      <Card>
        {invoices.length === 0 ? (
          <Empty>No invoices here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Number</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Issued</th>
                  <th className={thClass}>Due</th>
                  <th className={thClass}>Total</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className={tdClass}>
                      <Link href={`/invoices/${i.id}`} className="font-medium text-indigo-600 hover:underline">
                        #{i.number}
                      </Link>
                    </td>
                    <td className={tdClass}>{i.customers?.name ?? "—"}</td>
                    <td className={tdClass}>{date(i.issued_on)}</td>
                    <td className={tdClass}>{date(i.due_on)}</td>
                    <td className={tdClass}>{money(invoiceTotal(i))}</td>
                    <td className={tdClass}>
                      <Badge status={isOverdue(i) ? "overdue" : i.status} />
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
