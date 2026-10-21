import { NextResponse, type NextRequest } from "next/server";
import { dayKey, fromLocalInput, invoiceTotal, isOverdue, money, time } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBusinessText } from "@/lib/texting";
import { hasTexting } from "@/lib/stripe";
import type { Invoice, Job, Organization } from "@/lib/types";

// Runs every hour (vercel.json). For each business whose local clock just hit their brief hour,
// texts the owner a short rundown of the day. Plain template — no AI needed, so it never hallucinates.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orgs } = await admin
    .from("organizations")
    .select("*")
    .eq("daily_brief_enabled", true)
    .not("sms_number", "is", null)
    .not("notify_phone", "is", null);

  let sent = 0;
  const now = new Date();
  for (const org of (orgs ?? []) as Organization[]) {
    const today = dayKey(now, org.timezone);
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: org.timezone, hour: "numeric", hourCycle: "h23" }).format(now));
    if (hour !== org.daily_brief_hour || org.daily_brief_sent_on === today || !hasTexting(org)) continue;

    const start = fromLocalInput(`${today}T00:00`, org.timezone)!;
    const end = new Date(new Date(start).getTime() + 86_400_000).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000).toISOString();
    const [{ data: jobs }, { data: openInv }, { data: leads }] = await Promise.all([
      admin.from("jobs").select("*, customers(id, name)").eq("org_id", org.id).in("status", ["scheduled", "in_progress"]).gte("scheduled_at", start).lt("scheduled_at", end).order("scheduled_at"),
      admin.from("invoices").select("*, customers(id, name), invoice_items(quantity, unit_price)").eq("org_id", org.id).eq("status", "sent"),
      admin.from("jobs").select("id, title, created_at").eq("org_id", org.id).eq("status", "lead").gte("created_at", twoDaysAgo),
    ]);

    const todays = (jobs ?? []) as Job[];
    const overdue = ((openInv ?? []) as Invoice[]).filter(isOverdue);
    const overdueTotal = overdue.reduce((s, i) => s + invoiceTotal(i), 0);
    const newLeads = leads ?? [];

    const lines = [`${org.name} — ${now.toLocaleDateString("en-US", { timeZone: org.timezone, weekday: "short", month: "short", day: "numeric" })}`];
    lines.push(
      todays.length
        ? `Today: ${todays.slice(0, 4).map((j) => `${time(j.scheduled_at!, org.timezone)} ${j.customers?.name ?? j.title}`).join(", ")}${todays.length > 4 ? ` +${todays.length - 4} more` : ""}`
        : "Today: nothing scheduled",
    );
    if (overdue.length) lines.push(`Overdue: ${overdue.length} invoice${overdue.length === 1 ? "" : "s"}, ${money(overdueTotal)}`);
    if (newLeads.length) lines.push(`${newLeads.length} new lead${newLeads.length === 1 ? "" : "s"} waiting`);
    lines.push(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`);

    const r = await sendBusinessText(admin, org, { to: org.notify_phone!, body: lines.join("\n"), customerId: null, kind: "lead_alert" });
    await admin.from("organizations").update({ daily_brief_sent_on: today }).eq("id", org.id);
    if (r.ok) sent++;
  }

  return NextResponse.json({ checked: orgs?.length ?? 0, sent });
}
