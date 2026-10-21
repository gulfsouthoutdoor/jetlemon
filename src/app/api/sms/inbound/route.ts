import { NextResponse, type NextRequest } from "next/server";
import { normalizePhone, verifyTwilioSignature } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { stopRuns } from "@/lib/sequences";

// Twilio posts here when a customer texts a business's number. Reply shows up on the customer's page.
export async function POST(request: NextRequest) {
  const fd = await request.formData();
  const params = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/sms/inbound`;
  if (!verifyTwilioSignature(url, params, request.headers.get("x-twilio-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const to = normalizePhone(params.To);
  const from = normalizePhone(params.From);
  const body = (params.Body ?? "").trim();
  const twiml = new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", { headers: { "Content-Type": "text/xml" } });
  if (!to || !from || !body) return twiml;

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("id").eq("sms_number", to).maybeSingle();
  if (!org) return twiml;

  let { data: customer } = await admin.from("customers").select("id").eq("org_id", org.id).eq("phone", from).limit(1).maybeSingle();
  if (!customer) {
    const { data: created } = await admin
      .from("customers")
      .insert({ org_id: org.id, name: `Unknown ${from}`, phone: from, tags: ["texted-in"] })
      .select("id")
      .single();
    customer = created;
  }

  if (customer) {
    // A reply ends any running follow-up; STOP/UNSUBSCRIBE opts them out of texts (Twilio blocks sends too).
    await stopRuns(admin, { customerId: customer.id }, "customer replied");
    if (/^\s*(stop|stopall|unsubscribe|cancel|end|quit)\b/i.test(body)) await admin.from("customers").update({ text_opt_out: true }).eq("id", customer.id);
    else if (/^\s*(start|unstop|yes)\b/i.test(body)) await admin.from("customers").update({ text_opt_out: false }).eq("id", customer.id);
  }

  await admin.from("messages").insert({
    org_id: org.id,
    customer_id: customer?.id ?? null,
    direction: "in",
    body,
    from_number: from,
    to_number: to,
    provider_sid: params.MessageSid ?? null,
    status: "received",
    kind: "manual",
  });

  return twiml;
}
