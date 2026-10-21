import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, ButtonLink, Card, PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CUSTOMER_FIELDS, JOB_FIELDS, type ImportSummary, type Mapping, type Sheet } from "@/lib/import";
import { getContext } from "@/lib/org";
import { confirmImport, discardImport } from "../actions";

const label = (f: string) => f.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default async function ReviewImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, org } = await getContext();
  const { data: imp } = await supabase.from("imports").select("*").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!imp) notFound();

  if (imp.status === "done") {
    const s = imp.summary as ImportSummary;
    return (
      <>
        <PageHeader title="Import finished" subtitle={imp.filename} actions={<ButtonLink href="/customers">See customers</ButtonLink>} />
        <div className="max-w-2xl space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              ["Customers added", s.customers_added],
              ["Customers updated", s.customers_updated],
              ["Jobs added", s.jobs_added],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{v}</p>
              </div>
            ))}
          </div>
          {s.skipped.length > 0 && (
            <Card title={`Rows we couldn't use (${s.skipped.length})`}>
              <ul className="max-h-64 space-y-1 overflow-y-auto text-sm text-slate-700">
                {s.skipped.map((k, i) => (
                  <li key={i}>
                    {k.sheet}, row {k.row}: {k.reason}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Link href="/import" className="text-sm text-indigo-600 hover:underline">
            Import another file
          </Link>
        </div>
      </>
    );
  }

  const sheets = imp.sheets as Sheet[];
  const mapping = imp.mapping as Mapping;

  return (
    <>
      <PageHeader title="Check the columns" subtitle={imp.filename} />
      <form action={confirmImport.bind(null, id)} className="max-w-3xl space-y-6">
        {mapping.summary && <p className="rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{mapping.summary}</p>}

        {mapping.sheets.map((sm) => {
          const sheet = sheets.find((s) => s.name === sm.sheet);
          if (!sheet) return null;
          const fields = sm.kind === "jobs" ? JOB_FIELDS : CUSTOMER_FIELDS;
          return (
            <Card
              key={sm.sheet}
              title={`${sheet.name} · ${sheet.rows.length.toLocaleString()} rows`}
              action={
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  This sheet is
                  <Select name={`kind:${sm.sheet}`} defaultValue={sm.kind} className="w-auto">
                    <option value="customers">Customers</option>
                    <option value="jobs">Jobs</option>
                    <option value="skip">Skip it</option>
                  </Select>
                </label>
              }
            >
              {sm.note && <p className="mb-4 text-sm text-slate-600">{sm.note}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                      <th className="border-b border-slate-200 px-2 py-2 font-medium">Column in your file</th>
                      <th className="border-b border-slate-200 px-2 py-2 font-medium">Example</th>
                      <th className="border-b border-slate-200 px-2 py-2 font-medium">Goes into</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.headers.map((h, i) => {
                      const example = sheet.rows.find((r) => r[i])?.[i] ?? "";
                      return (
                        <tr key={h}>
                          <td className="border-b border-slate-100 px-2 py-2 font-medium text-slate-800">{h}</td>
                          <td className="max-w-[16rem] truncate border-b border-slate-100 px-2 py-2 text-slate-500">{example}</td>
                          <td className="border-b border-slate-100 px-2 py-2">
                            <Select name={`col:${sm.sheet}:${h}`} defaultValue={sm.columns[h] ?? "skip"} className="w-auto">
                              {fields.map((f) => (
                                <option key={f} value={f}>
                                  {f === "skip" ? "— skip —" : label(f)}
                                </option>
                              ))}
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Changing &quot;This sheet is&quot; swaps the field list; if you switch kinds, re-check the columns after the page reloads.
              </p>
            </Card>
          );
        })}

        <p className="text-sm text-slate-600">
          People already in JetLemon (same phone, email, or exact name) are updated, not duplicated. Columns set to Notes are kept on the customer as &quot;Column: value&quot;.
        </p>
        <div className="flex gap-2">
          <SubmitButton pendingLabel="Importing…">Import now</SubmitButton>
          <Button formAction={discardImport.bind(null, id)} variant="secondary" type="submit">
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
