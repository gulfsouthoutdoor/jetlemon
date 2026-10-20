import { createHmac } from "node:crypto";

/** "(205) 555-0142" → "+12055550142". Returns null if it can't be made into a US/international number. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.length >= 8 ? digits : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export const smsConfigured = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

/** Sends one text through Twilio. Returns the message SID, or throws with Twilio's error text. */
export async function sendSms(from: string, to: string, body: string): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Texting is not set up on this server.");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  });
  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok || !json.sid) throw new Error(json.message ?? `Twilio error ${res.status}`);
  return json.sid;
}

/** Checks Twilio's X-Twilio-Signature on an inbound webhook (HMAC-SHA1 of URL + sorted form fields). */
export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", token).update(data).digest("base64");
  return expected === signature;
}

/** Fills {first_name}, {name}, {business} in a message template. */
export function fillTemplate(template: string, vars: { name: string; business: string }) {
  const first = vars.name.trim().split(/\s+/)[0] || "there";
  return template.replaceAll("{first_name}", first).replaceAll("{name}", vars.name).replaceAll("{business}", vars.business);
}
