import { NextResponse, type NextRequest } from "next/server";
import { createInboundLead } from "@/lib/leads";
import { createAdminClient } from "@/lib/supabase/admin";

// Each business's private lead address. Accepts JSON or a plain HTML form post:
//   name, phone, email, address, message, source (optional, defaults to "website"), plus any other fields.
// Works with Zapier/Make ("Webhooks → POST"), website forms, or anything that can send a request.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("id").eq("inbound_token", token).maybeSingle();
  if (!org) return NextResponse.json({ error: "Unknown lead address" }, { status: 404, headers: cors });

  let fields: Record<string, string> = {};
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(body)) if (v != null && typeof v !== "object") fields[k] = String(v);
    } else {
      const fd = await request.formData();
      fields = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string") as [string, string][]);
    }
  } catch {
    return NextResponse.json({ error: "Could not read the request body" }, { status: 400, headers: cors });
  }

  const take = (...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(fields).find((f) => f.toLowerCase().replace(/[\s_-]/g, "") === k);
      if (hit) {
        const v = fields[hit];
        delete fields[hit];
        return v;
      }
    }
    return null;
  };

  const name = take("name", "fullname", "firstname");
  const lastName = take("lastname");
  const lead = {
    name: [name, lastName].filter(Boolean).join(" ") || null,
    phone: take("phone", "phonenumber", "mobile", "cell"),
    email: take("email", "emailaddress"),
    address: take("address", "streetaddress"),
    message: take("message", "notes", "comments", "details"),
    source: (take("source") ?? "website").toLowerCase().slice(0, 40),
    sourceRef: take("sourceref", "id", "leadid"),
    extra: fields,
  };
  if (!lead.name && !lead.phone && !lead.email) {
    return NextResponse.json({ error: "Send at least a name, phone, or email" }, { status: 422, headers: cors });
  }

  try {
    const result = await createInboundLead(admin, org.id, lead);
    const wantsHtml = request.headers.get("accept")?.includes("text/html") && !type.includes("application/json");
    if (wantsHtml) {
      const back = fields.redirect || request.headers.get("referer");
      if (back) return NextResponse.redirect(back, { status: 303 });
      return new NextResponse("<!doctype html><p style='font-family:system-ui;padding:40px'>Thanks — we got your request and will be in touch shortly.</p>", {
        headers: { "Content-Type": "text/html" },
      });
    }
    return NextResponse.json({ ok: true, ...result }, { headers: cors });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500, headers: cors });
  }
}
