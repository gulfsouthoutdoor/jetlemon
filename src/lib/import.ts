import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { askJson } from "@/lib/ai";
import { normalizePhone } from "@/lib/sms";

export const MAX_ROWS = 5000;

export type Sheet = { name: string; headers: string[]; rows: string[][] };

/** Fields a column can map to. "notes" columns are appended to the customer's notes as "Header: value". */
export const CUSTOMER_FIELDS = ["name", "first_name", "last_name", "company", "phone", "email", "address", "tags", "notes", "skip"] as const;
export const JOB_FIELDS = ["title", "description", "status", "scheduled_at", "price", "address", "customer_name", "customer_phone", "customer_email", "notes", "skip"] as const;

export type SheetMapping = {
  sheet: string;
  kind: "customers" | "jobs" | "skip";
  columns: Record<string, string>; // header → field
  note: string; // plain-words explanation shown to the user
};
export type Mapping = { sheets: SheetMapping[]; summary: string };

/** Reads a CSV or Excel upload into plain string grids. */
export function parseUpload(buffer: Buffer, filename: string): Sheet[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: true, dense: true });
  const sheets: Sheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "", raw: false }) as unknown[][];
    if (grid.length < 2) continue;
    // Header row = first row with at least two non-empty cells.
    const hi = grid.findIndex((r) => r.filter((c) => String(c ?? "").trim()).length >= 2);
    if (hi < 0) continue;
    const headers = grid[hi].map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`);
    const rows = grid
      .slice(hi + 1, hi + 1 + MAX_ROWS)
      .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()))
      .filter((r) => r.some(Boolean));
    if (rows.length) sheets.push({ name: name || filename, headers, rows });
  }
  return sheets;
}

/** Asks the AI what each column is. Falls back to header-name guesses if AI is off. */
export async function proposeMapping(sheets: Sheet[], aiOn: boolean): Promise<Mapping> {
  if (!aiOn) return { sheets: sheets.map(guessSheet), summary: "Mapped by column names. Check each one below." };
  const sample = sheets.map((s) => ({ sheet: s.name, headers: s.headers, sample_rows: s.rows.slice(0, 5), row_count: s.rows.length }));
  const system = `You map spreadsheet columns from a small business (any kind) into a simple CRM. The export may come from GoHighLevel, Jobber, Housecall Pro, QuickBooks, a phone contact list, or a homemade sheet.
For each sheet decide kind: "customers" (people/companies with contact info), "jobs" (visits, appointments, work orders, opportunities, pipeline deals), or "skip".
Customer fields: ${CUSTOMER_FIELDS.join(", ")}. Job fields: ${JOB_FIELDS.join(", ")}.
Use "notes" for anything useful that has no field (last service date, gate code, how they found us). Use "skip" for ids, timestamps, booleans, and junk.
Only one column per field, except "notes" and "tags" which may repeat. Write "note" as one plain sentence for the business owner saying what you did and anything they should double-check. Shape:
{"sheets":[{"sheet":"...","kind":"customers","columns":{"Header":"field",...},"note":"..."}],"summary":"one sentence"}`;
  try {
    const m = await askJson<Mapping>(system, JSON.stringify(sample), 2000);
    // Keep only sheets and headers we actually have.
    const byName = new Map(sheets.map((s) => [s.name, s]));
    m.sheets = (m.sheets ?? [])
      .filter((sm) => byName.has(sm.sheet))
      .map((sm) => {
        const s = byName.get(sm.sheet)!;
        const allowed = sm.kind === "jobs" ? (JOB_FIELDS as readonly string[]) : (CUSTOMER_FIELDS as readonly string[]);
        const columns: Record<string, string> = {};
        for (const h of s.headers) columns[h] = allowed.includes(sm.columns?.[h]) ? sm.columns[h] : "skip";
        return { sheet: sm.sheet, kind: sm.kind === "jobs" || sm.kind === "skip" ? sm.kind : "customers", columns, note: sm.note ?? "" };
      });
    for (const s of sheets) if (!m.sheets.find((x) => x.sheet === s.name)) m.sheets.push(guessSheet(s));
    return m;
  } catch {
    return { sheets: sheets.map(guessSheet), summary: "AI mapping was unavailable, so this is a best guess from column names. Check each one below." };
  }
}

function guessSheet(s: Sheet): SheetMapping {
  const columns: Record<string, string> = {};
  const lower = s.headers.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const isJobs = lower.some((h) => /scheduled|appointment|jobtitle|opportunity|stage|pipeline/.test(h));
  for (let i = 0; i < s.headers.length; i++) {
    const h = lower[i];
    let f = "skip";
    if (/^(full)?name$|^contact(name)?$|^customer(name)?$/.test(h)) f = isJobs ? "customer_name" : "name";
    else if (/^first(name)?$/.test(h)) f = "first_name";
    else if (/^last(name)?$|^surname$/.test(h)) f = "last_name";
    else if (/company|business/.test(h)) f = "company";
    else if (/phone|mobile|cell/.test(h)) f = isJobs ? "customer_phone" : "phone";
    else if (/email/.test(h)) f = isJobs ? "customer_email" : "email";
    else if (/address|street|city|zip|location|site/.test(h)) f = "address";
    else if (/tag|label|type|source/.test(h)) f = isJobs ? "notes" : "tags";
    else if (/note|comment|memo|detail|description/.test(h)) f = isJobs ? "description" : "notes";
    else if (isJobs && /title|service|job/.test(h)) f = "title";
    else if (isJobs && /status|stage/.test(h)) f = "status";
    else if (isJobs && /date|scheduled|when|time/.test(h)) f = "scheduled_at";
    else if (isJobs && /price|amount|total|value/.test(h)) f = "price";
    columns[s.headers[i]] = f;
  }
  return { sheet: s.name, kind: isJobs ? "jobs" : "customers", columns, note: "Guessed from the column names." };
}

export type ImportSummary = {
  customers_added: number;
  customers_updated: number;
  jobs_added: number;
  skipped: { sheet: string; row: number; reason: string }[];
};

/** Runs the import with the (possibly user-corrected) mapping. Dedupes by phone, then email, then exact name. */
export async function runImport(db: SupabaseClient, orgId: string, sheets: Sheet[], mapping: Mapping, timezone: string): Promise<ImportSummary> {
  const summary: ImportSummary = { customers_added: 0, customers_updated: 0, jobs_added: 0, skipped: [] };

  // Existing customers, for matching.
  const { data: existing } = await db.from("customers").select("id, name, phone, email, tags, notes").eq("org_id", orgId);
  type C = { id: string; name: string; phone: string | null; email: string | null; tags: string[]; notes: string | null };
  const byPhone = new Map<string, C>(), byEmail = new Map<string, C>(), byName = new Map<string, C>();
  const index = (c: C) => {
    if (c.phone) byPhone.set(c.phone, c);
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
    byName.set(c.name.trim().toLowerCase(), c);
  };
  (existing ?? []).forEach((c) => index(c as C));
  const find = (phone: string | null, email: string | null, name: string | null) =>
    (phone && byPhone.get(phone)) || (email && byEmail.get(email.toLowerCase())) || (name && byName.get(name.trim().toLowerCase())) || null;

  // Customers first.
  for (const sm of mapping.sheets.filter((s) => s.kind === "customers")) {
    const sheet = sheets.find((s) => s.name === sm.sheet);
    if (!sheet) continue;
    const col = (row: string[], field: string) =>
      sheet.headers.map((h, i) => (sm.columns[h] === field ? row[i] : "")).filter(Boolean);
    for (let r = 0; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      const name = col(row, "name")[0] || [col(row, "first_name")[0], col(row, "last_name")[0]].filter(Boolean).join(" ") || col(row, "company")[0] || "";
      const company = col(row, "company")[0] || "";
      const phone = normalizePhone(col(row, "phone")[0]);
      const email = col(row, "email")[0]?.toLowerCase() || null;
      if (!name && !phone && !email) {
        summary.skipped.push({ sheet: sheet.name, row: r + 2, reason: "no name, phone, or email" });
        continue;
      }
      const address = col(row, "address").join(", ") || null;
      const tags = col(row, "tags").flatMap((t) => t.split(/[,;|]/)).map((t) => t.trim()).filter(Boolean);
      const noteLines = sheet.headers
        .map((h, i) => (sm.columns[h] === "notes" && row[i] ? `${h}: ${row[i]}` : ""))
        .filter(Boolean);
      if (company && name !== company) noteLines.unshift(`Company: ${company}`);
      const notes = noteLines.join("\n") || null;

      const match = find(phone, email, name || null);
      if (match) {
        const merged = {
          phone: match.phone ?? phone,
          email: match.email ?? email,
          address: address ?? undefined,
          tags: Array.from(new Set([...(match.tags ?? []), ...tags])),
          notes: [match.notes, notes].filter(Boolean).join("\n") || null,
        };
        const { error } = await db.from("customers").update(merged).eq("id", match.id);
        if (!error) { summary.customers_updated++; index({ ...match, ...merged, notes: merged.notes } as C); }
        else summary.skipped.push({ sheet: sheet.name, row: r + 2, reason: error.message });
      } else {
        const { data, error } = await db
          .from("customers")
          .insert({ org_id: orgId, name: name || phone || email, phone, email, address, tags, notes })
          .select("id, name, phone, email, tags, notes")
          .single();
        if (!error && data) { summary.customers_added++; index(data as C); }
        else summary.skipped.push({ sheet: sheet.name, row: r + 2, reason: error?.message ?? "insert failed" });
      }
    }
  }

  // Then jobs, linked to customers by phone / email / name.
  for (const sm of mapping.sheets.filter((s) => s.kind === "jobs")) {
    const sheet = sheets.find((s) => s.name === sm.sheet);
    if (!sheet) continue;
    const col = (row: string[], field: string) =>
      sheet.headers.map((h, i) => (sm.columns[h] === field ? row[i] : "")).filter(Boolean);
    for (let r = 0; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      const title = col(row, "title")[0] || "Imported job";
      const phone = normalizePhone(col(row, "customer_phone")[0]);
      const email = col(row, "customer_email")[0]?.toLowerCase() || null;
      const cname = col(row, "customer_name")[0] || null;
      let customer = find(phone, email, cname);
      if (!customer && (cname || phone || email)) {
        const { data } = await db
          .from("customers")
          .insert({ org_id: orgId, name: cname || phone || email, phone, email, tags: ["imported"] })
          .select("id, name, phone, email, tags, notes")
          .single();
        if (data) { customer = data as C; index(customer); summary.customers_added++; }
      }
      const when = parseDate(col(row, "scheduled_at")[0], timezone);
      const status = parseStatus(col(row, "status")[0], when);
      const price = parseMoney(col(row, "price")[0]);
      const description = [...col(row, "description"), ...sheet.headers.map((h, i) => (sm.columns[h] === "notes" && row[i] ? `${h}: ${row[i]}` : "")).filter(Boolean)].join("\n") || null;
      const { error } = await db.from("jobs").insert({
        org_id: orgId,
        customer_id: customer?.id ?? null,
        title,
        description,
        status,
        scheduled_at: when,
        address: col(row, "address").join(", ") || null,
        price,
        source: "import",
      });
      if (!error) summary.jobs_added++;
      else summary.skipped.push({ sheet: sheet.name, row: r + 2, reason: error.message });
    }
  }
  return summary;
}

function parseDate(s: string | undefined, timezone: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  void timezone;
  return null;
}
function parseMoney(s: string | undefined): number {
  const n = Number((s ?? "").replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
}
function parseStatus(s: string | undefined, when: string | null): "lead" | "scheduled" | "in_progress" | "completed" | "cancelled" {
  const t = (s ?? "").toLowerCase();
  if (/cancel|lost|void/.test(t)) return "cancelled";
  if (/complete|done|paid|closed|won|finished|invoiced/.test(t)) return "completed";
  if (/progress|started|active|working/.test(t)) return "in_progress";
  if (/lead|new|quote|estimate|open|prospect|pending/.test(t)) return "lead";
  if (/schedul|booked|confirmed/.test(t)) return "scheduled";
  if (when) return new Date(when) < new Date() ? "completed" : "scheduled";
  return "lead";
}
