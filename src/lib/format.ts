export const money = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

export const dateTime = (iso: string | null, timeZone: string) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Unscheduled";

export const time = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });

/** Formats a plain YYYY-MM-DD date column. */
export const date = (d: string | null) =>
  d
    ? new Date(d.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export const statusLabel = (s: string) => s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase());

/** Wall-clock parts of an instant in a time zone. */
function zonedParts(d: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour,
    minute: +parts.minute,
    second: +parts.second,
  };
}

/** YYYY-MM-DD for an instant, as seen in the given time zone. */
export const dayKey = (d: Date, timeZone: string) => {
  const p = zonedParts(d, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

/** ISO timestamp → value for <input type="datetime-local"> in the business time zone. */
export const toLocalInput = (iso: string | null, timeZone: string) => {
  if (!iso) return "";
  const p = zonedParts(new Date(iso), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

/** "YYYY-MM-DDTHH:mm" wall-clock time in a time zone → UTC ISO string. */
export const fromLocalInput = (local: string | null, timeZone: string) => {
  if (!local) return null;
  const [d, t = "00:00"] = local.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const asUtc = Date.UTC(y, mo - 1, da, h, mi);
  // Offset of the zone at (approximately) that instant; second pass handles DST edges.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
    guess = asUtc - offset;
  }
  return new Date(guess).toISOString();
};

export const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

export const invoiceTotal = (inv: { invoice_items?: { quantity: number; unit_price: number }[] }) =>
  (inv.invoice_items ?? []).reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);

export const isOverdue = (inv: { status: string; due_on: string }) =>
  inv.status === "sent" && inv.due_on < new Date().toISOString().slice(0, 10);
