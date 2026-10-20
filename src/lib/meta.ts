import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

export const metaConfigured = () => Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);

/** Permissions needed to list a user's pages and pull their lead-form submissions. */
export const META_SCOPES = ["pages_show_list", "pages_manage_metadata", "pages_manage_ads", "pages_read_engagement", "leads_retrieval"].join(",");

type GraphError = { error?: { message?: string } };

async function graph<T>(path: string, params: Record<string, string>, init?: RequestInit): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, init);
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Facebook error ${res.status}`);
  return json;
}

/** Login code → long-lived user token. */
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const short = await graph<{ access_token: string }>("/oauth/access_token", {
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });
  const long = await graph<{ access_token: string }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: short.access_token,
  });
  return long.access_token;
}

/** Pages the user granted, each with its own (never-expiring, when from a long-lived user token) page token. */
export async function listPages(userToken: string): Promise<{ id: string; name: string; access_token: string }[]> {
  const res = await graph<{ data: { id: string; name: string; access_token: string }[] }>("/me/accounts", {
    access_token: userToken,
    fields: "id,name,access_token",
    limit: "100",
  });
  return res.data;
}

/** Tells Facebook to send this page's lead-form submissions to our webhook. */
export async function subscribePage(pageId: string, pageToken: string) {
  await graph<{ success: boolean }>(`/${pageId}/subscribed_apps`, { access_token: pageToken, subscribed_fields: "leadgen" }, { method: "POST" });
}

export async function unsubscribePage(pageId: string, pageToken: string) {
  await graph<{ success: boolean }>(`/${pageId}/subscribed_apps`, { access_token: pageToken }, { method: "DELETE" });
}

export type MetaLead = {
  id: string;
  created_time: string;
  ad_name?: string;
  form_id?: string;
  field_data: { name: string; values: string[] }[];
};

/** Pulls the answers for one lead-form submission. */
export async function fetchLead(leadgenId: string, pageToken: string): Promise<MetaLead> {
  return graph<MetaLead>(`/${leadgenId}`, { access_token: pageToken, fields: "id,created_time,ad_name,form_id,field_data" });
}

/** Splits Facebook's answers into the fields JetLemon stores plus everything else. */
export function mapLeadFields(lead: MetaLead) {
  const out: { name?: string; phone?: string; email?: string; address?: string; extra: Record<string, string> } = { extra: {} };
  let first = "";
  let last = "";
  for (const f of lead.field_data ?? []) {
    const key = f.name.toLowerCase();
    const value = (f.values ?? []).join(", ");
    if (!value) continue;
    if (key === "full_name" || key === "name") out.name = value;
    else if (key === "first_name") first = value;
    else if (key === "last_name") last = value;
    else if (key === "phone_number" || key === "phone") out.phone = value;
    else if (key === "email") out.email = value;
    else if (key === "street_address" || key === "address") out.address = value;
    else out.extra[f.name.replaceAll("_", " ")] = value;
  }
  if (!out.name && (first || last)) out.name = [first, last].filter(Boolean).join(" ");
  return out;
}

/** Facebook signs webhook bodies with the app secret (X-Hub-Signature-256). */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = header.slice("sha256=".length);
  return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}
