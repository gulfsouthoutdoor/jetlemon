import Link from "next/link";
import { Button, Card, ErrorNote, PageHeader } from "@/components/ui";
import { aiConfigured } from "@/lib/ai";
import { dateTime } from "@/lib/format";
import { getContext } from "@/lib/org";
import { uploadFile } from "./actions";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, org } = await getContext();
  const { data: past } = await supabase.from("imports").select("id, filename, status, summary, created_at").eq("org_id", org.id).order("created_at", { ascending: false }).limit(10);

  return (
    <>
      <PageHeader title="Import customers" subtitle="Bring in a spreadsheet or an export from your old CRM. We'll figure out the columns." />
      <div className="max-w-2xl space-y-6">
        <ErrorNote message={error} />
        <Card title="Upload a file">
          <form action={uploadFile} className="space-y-4">
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,.xlsx,.xls,.tsv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
            />
            <p className="text-sm text-slate-500">
              CSV or Excel. Works with exports from GoHighLevel, Jobber, Housecall Pro, QuickBooks, Google Contacts, or any sheet you made yourself — column names don&apos;t
              have to match anything. Up to 5,000 rows per sheet.
            </p>
            <Button>Upload and review</Button>
            {!aiConfigured() && <p className="text-xs text-slate-500">AI matching is off on this server; columns will be guessed from their names.</p>}
          </form>
        </Card>

        <Card title="How to export from your old system">
          <ul className="space-y-2 text-sm text-slate-700">
            <li><span className="font-medium">GoHighLevel:</span> Contacts → select all → Export. Opportunities → Export for your pipeline.</li>
            <li><span className="font-medium">Jobber:</span> Clients → ⋯ → Export clients. Jobs → Export.</li>
            <li><span className="font-medium">Housecall Pro:</span> Customers → Export → CSV.</li>
            <li><span className="font-medium">QuickBooks:</span> Sales → Customers → Export to Excel.</li>
            <li><span className="font-medium">Phone contacts:</span> Google Contacts → Export → CSV. iPhone: sync to iCloud, then icloud.com → Contacts → Export vCard, open in Numbers/Excel, save as CSV.</li>
          </ul>
        </Card>

        {past?.length ? (
          <Card title="Past imports">
            <ul className="divide-y divide-slate-100 text-sm">
              {past.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span>
                    <Link href={`/import/${p.id}`} className="font-medium text-indigo-600 hover:underline">
                      {p.filename}
                    </Link>{" "}
                    <span className="text-slate-400">· {dateTime(p.created_at, org.timezone)}</span>
                  </span>
                  <span className="text-slate-500">
                    {p.status === "done" && p.summary ? `${(p.summary as { customers_added: number }).customers_added} added` : p.status === "mapping" ? "Needs review" : p.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
