import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { date, money } from "@/lib/format";
import { syncInvoicePayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { payInvoice } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  org_id: string;
  number: number;
  status: string;
  issued_on: string;
  due_on: string;
  paid_on: string | null;
  notes: string | null;
  business_name: string;
  business_phone: string | null;
  business_email: string | null;
  business_address: string | null;
  invoice_footer: string | null;
  pay_online: boolean;
  charges_enabled: boolean;
  customer_name: string | null;
  customer_email: string | null;
  items: { description: string; quantity: number; unit_price: number }[];
};

// The customer's view of an invoice, from the private pay link. No login.
export default async function PayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string; error?: string }> }) {
  const { token } = await params;
  const { paid, error } = await searchParams;
  const admin = createAdminClient();
  const { data } = await admin.rpc("invoice_by_pay_token", { token });
  const inv = (data as Row[] | null)?.[0];
  if (!inv) notFound();

  // Coming back from Stripe, or just checking: did a started checkout get paid?
  const { data: raw } = await admin.from("invoices").select("id, status, stripe_checkout_session_id, organizations(stripe_account_id)").eq("id", inv.id).single();
  const acct = (raw?.organizations as unknown as { stripe_account_id: string | null } | null)?.stripe_account_id ?? null;
  const status = raw ? await syncInvoicePayment(admin, raw, acct) : inv.status;
  const total = inv.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const canPay = status === "sent" && inv.pay_online && inv.charges_enabled && total > 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">{inv.business_name}</p>
              <p className="text-sm text-slate-500">{[inv.business_phone, inv.business_email].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">Invoice #{inv.number}</p>
              <p className="text-xs text-slate-500">
                {date(inv.issued_on)} · due {date(inv.due_on)}
              </p>
            </div>
          </div>
          {inv.customer_name && <p className="mt-4 text-sm text-slate-600">For {inv.customer_name}</p>}

          <table className="mt-4 w-full text-sm">
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2 text-slate-700">
                    {it.description}
                    {Number(it.quantity) !== 1 && <span className="text-slate-400"> × {Number(it.quantity)}</span>}
                  </td>
                  <td className="py-2 text-right text-slate-900">{money(Number(it.quantity) * Number(it.unit_price))}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="py-2 text-slate-900">Total</td>
                <td className="py-2 text-right text-slate-900">{money(total)}</td>
              </tr>
            </tbody>
          </table>
          {inv.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{inv.notes}</p>}

          <div className="mt-6">
            {status === "paid" ? (
              <p className="rounded-md bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
                Paid{inv.paid_on ? ` on ${date(inv.paid_on)}` : ""}. Thank you!
              </p>
            ) : status === "void" ? (
              <p className="rounded-md bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">This invoice has been cancelled.</p>
            ) : canPay ? (
              <form action={payInvoice.bind(null, token)}>
                {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                {paid && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Payment is still processing — refresh in a moment.</p>}
                <SubmitButton className="w-full" pendingLabel="Opening secure checkout…">
                  Pay {money(total)} by card
                </SubmitButton>
                <p className="mt-2 text-center text-xs text-slate-500">Secure checkout by Stripe. Your card details never touch this page.</p>
              </form>
            ) : (
              <p className="rounded-md bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
                {inv.business_phone ? `To pay, call ${inv.business_name} at ${inv.business_phone}.` : `Contact ${inv.business_name} to arrange payment.`}
              </p>
            )}
          </div>
          {inv.invoice_footer && <p className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">{inv.invoice_footer}</p>}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Sent with JetLemon</p>
      </div>
    </main>
  );
}
