import Link from "next/link";
import { Badge, ButtonLink, Card, Empty, PageHeader, tableClass, tdClass, thClass } from "@/components/ui";
import { date, money, statusLabel } from "@/lib/format";
import { getContext } from "@/lib/org";
import { isExpired, proposalTotal } from "@/lib/proposals";
import { PROPOSAL_STATUSES, type Proposal } from "@/lib/types";

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase } = await getContext();
  let q = supabase.from("proposals").select("*, customers(id, name), proposal_items(quantity, unit_price, optional, selected)").order("number", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const proposals = (data ?? []) as Proposal[];
  const open = proposals.filter((p) => p.status === "sent" && !isExpired(p));
  const openTotal = open.reduce((s, p) => s + proposalTotal(p.proposal_items ?? []), 0);

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle={status ? undefined : `${open.length} waiting on a yes · ${money(openTotal)}`}
        actions={<ButtonLink href="/proposals/new">New proposal</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap gap-1">
        {[undefined, ...PROPOSAL_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/proposals?status=${s}` : "/proposals"}
            className={`rounded-full px-3 py-1 text-sm ${status === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`}
          >
            {s ? statusLabel(s) : "All"}
          </Link>
        ))}
      </div>
      <Card>
        {proposals.length === 0 ? (
          <Empty>No proposals yet. Write one, send the link, and the customer can accept it from their phone.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Number</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Title</th>
                  <th className={thClass}>Sent</th>
                  <th className={thClass}>Total</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className={tdClass}>
                      <Link href={`/proposals/${p.id}`} className="font-medium text-indigo-600 hover:underline">
                        #{p.number}
                      </Link>
                    </td>
                    <td className={tdClass}>{p.customers?.name ?? "—"}</td>
                    <td className={tdClass}>{p.title || "—"}</td>
                    <td className={tdClass}>{p.sent_at ? date(p.sent_at.slice(0, 10)) : "—"}</td>
                    <td className={tdClass}>{money(proposalTotal(p.proposal_items ?? []))}</td>
                    <td className={tdClass}>
                      <Badge status={isExpired(p) ? "expired" : p.status} />
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
