import { NextResponse, type NextRequest } from "next/server";
import { createInboundLead } from "@/lib/leads";
import { fetchLead, mapLeadFields, verifyWebhookSignature } from "@/lib/meta";
import { createAdminClient } from "@/lib/supabase/admin";

// Facebook calls GET once to confirm the webhook, then POSTs each lead-form submission.

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

type LeadgenPayload = {
  entry?: { id: string; changes?: { field: string; value: { leadgen_id: string; page_id: string; form_id?: string } }[] }[];
};

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const payload = JSON.parse(raw) as LeadgenPayload;
  const admin = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const { leadgen_id, page_id } = change.value;
      const [{ data: page }, { data: tok }] = await Promise.all([
        admin.from("meta_pages").select("org_id, page_name").eq("page_id", page_id).maybeSingle(),
        admin.from("meta_page_tokens").select("access_token").eq("page_id", page_id).maybeSingle(),
      ]);
      if (!page || !tok) continue; // a page nobody connected

      try {
        const lead = await fetchLead(leadgen_id, tok.access_token);
        const f = mapLeadFields(lead);
        const extra = { ...f.extra };
        if (lead.ad_name) extra["Ad"] = lead.ad_name;
        extra["Page"] = page.page_name;
        await createInboundLead(admin, page.org_id, {
          name: f.name,
          phone: f.phone,
          email: f.email,
          address: f.address,
          source: "facebook",
          sourceRef: leadgen_id,
          extra,
        });
      } catch (err) {
        console.error("Facebook lead failed", leadgen_id, (err as Error).message);
      }
    }
  }

  // Always 200 so Facebook does not retry forever; failures are logged above.
  return NextResponse.json({ received: true });
}
