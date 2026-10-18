import Link from "next/link";
import { ButtonLink, Card, Empty, Input, PageHeader, tableClass, tdClass, thClass } from "@/components/ui";
import { getContext } from "@/lib/org";
import type { Customer } from "@/lib/types";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await getContext();

  let query = supabase.from("customers").select("*").order("name").limit(200);
  if (q) {
    const term = `%${q.replace(/[%,()]/g, "")}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term},address.ilike.${term}`);
  }
  const { data } = await query;
  const customers = (data ?? []) as Customer[];

  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.length} shown`} actions={<ButtonLink href="/customers/new">New customer</ButtonLink>} />
      <Card>
        <form className="mb-4">
          <Input name="q" defaultValue={q} placeholder="Search by name, phone, email or address…" />
        </form>
        {customers.length === 0 ? (
          <Empty>{q ? "No customers match your search." : "No customers yet. Add your first one!"}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Phone</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Address</th>
                  <th className={thClass}>Tags</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className={tdClass}>
                      <Link href={`/customers/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className={tdClass}>{c.phone ?? "—"}</td>
                    <td className={tdClass}>{c.email ?? "—"}</td>
                    <td className={tdClass}>{c.address ?? "—"}</td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                            {t}
                          </span>
                        ))}
                      </div>
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
