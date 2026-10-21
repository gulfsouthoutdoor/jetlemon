import { createHash } from "node:crypto";

/** Email to customers goes out through Resend from JetLemon's domain, on behalf of the business. */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "hello@jetlemon.com";
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://jetlemon.com";

/** Signed link a customer can click to stop emails from one business. No login needed. */
export function unsubscribeToken(customerId: string) {
  return createHash("sha256").update(`${customerId}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex").slice(0, 32);
}
export function unsubscribeUrl(customerId: string) {
  return `${siteUrl()}/email/stop?c=${customerId}&t=${unsubscribeToken(customerId)}`;
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  /** Plain text. Line breaks become paragraphs in the HTML version. */
  text: string;
  fromName: string;
  replyTo?: string | null;
  /** Business footer: phone, address — shown under the message. */
  footer?: string | null;
  unsubscribe?: string | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function html(e: OutgoingEmail) {
  const paras = e.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.5">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:15px">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:24px">
${paras}
${e.footer ? `<p style="margin:18px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;color:#475569;font-size:13px;line-height:1.5">${esc(e.footer).replace(/\n/g, "<br>")}</p>` : ""}
</div>
${e.unsubscribe ? `<p style="max-width:560px;margin:12px auto 0;color:#94a3b8;font-size:12px;text-align:center">Don't want these emails? <a href="${e.unsubscribe}" style="color:#94a3b8">Stop them here</a>.</p>` : ""}
<p style="max-width:560px;margin:10px auto 0;color:#cbd5e1;font-size:11px;text-align:center"><img src="${siteUrl()}/logo-96.png" width="14" height="14" alt="" style="vertical-align:-2px;margin-right:4px">Sent with JetLemon</p>
</body></html>`;
}

/** Sends one email. Throws with a readable message when Resend rejects it. Returns the Resend id. */
export async function sendEmail(e: OutgoingEmail): Promise<string> {
  if (!emailConfigured()) throw new Error("Email is not switched on for this server yet.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${e.fromName.replace(/[<>"]/g, "")} <${FROM_ADDRESS}>`,
      to: [e.to],
      subject: e.subject,
      text: e.text + (e.footer ? `\n\n--\n${e.footer}` : "") + (e.unsubscribe ? `\n\nStop these emails: ${e.unsubscribe}` : ""),
      html: html(e),
      ...(e.replyTo ? { reply_to: e.replyTo } : {}),
      ...(e.unsubscribe ? { headers: { "List-Unsubscribe": `<${e.unsubscribe}>` } } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) throw new Error(data.message ?? data.name ?? `Resend error ${res.status}`);
  return data.id ?? "";
}
