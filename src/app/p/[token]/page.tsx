import { notFound } from "next/navigation";
import { Logo } from "@/components/auth-shell";
import { SubmitButton } from "@/components/submit-button";
import { date, money } from "@/lib/format";
import { depositAmount, isExpired, proposalTotal, syncDeposit } from "@/lib/proposals";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptProposal, declineProposal, payDeposit } from "./actions";
import { OptionPicker } from "./option-picker";

export const dynamic = "force-dynamic";

export type PublicProposal = {
  id: string;
  org_id: string;
  number: number;
  status: string;
  title: string;
  intro: string | null;
  terms: string | null;
  valid_until: string | null;
  deposit_percent: number;
  accepted_at: string | null;
  accepted_name: string | null;
  declined_at: string | null;
  deposit_paid_on: string | null;
  stripe_checkout_session_id: string | null;
  business_name: string;
  business_phone: string | null;
  business_email: string | null;
  business_address: string | null;
  business_website: string | null;
  pay_online: boolean;
  charges_enabled: boolean;
  stripe_account_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_address: string | null;
  items: { id: string; description: string; quantity: number; unit_price: number; optional: boolean; selected: boolean }[];
};

export default async function PublicProposalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string; paid?: string }> }) {
  const { token } = await params;
  const { error, paid } = await searchParams;
  const admin = createAdminClient();
  const { data } = await admin.rpc("proposal_by_token", { token });
  const p = (data as PublicProposal[] | null)?.[0];
  if (!p) notFound();
  if (p.status === "accepted" && p.deposit_percent > 0 && !p.deposit_paid_on && p.stripe_checkout_session_id) {
    p.deposit_paid_on = await syncDeposit(admin, p, p.stripe_account_id);
  }
  const expired = isExpired(p);
  const open = p.status === "sent" && !expired;
  const required = p.items.filter((it) => !it.optional);
  const options = p.items.filter((it) => it.optional);
  const acceptedTotal = proposalTotal(p.items);
  const deposit = depositAmount(p.items, p.deposit_percent);
  const canPayDeposit = p.status === "accepted" && p.deposit_percent > 0 && !p.deposit_paid_on && p.pay_online && p.charges_enabled;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">{p.business_name}</p>
              <p className="text-sm text-slate-500">{[p.business_phone, p.business_email].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p className="font-medium text-slate-700">Proposal #{p.number}</p>
              {p.valid_until && <p>Good until {date(p.valid_until)}</p>}
            </div>
          </div>

          <h1 className="mt-6 text-2xl font-semibold text-slate-900">{p.title || "Proposal"}</h1>
          {p.customer_name && <p className="mt-1 text-sm text-slate-500">Prepared for {p.customer_name}</p>}
          {p.intro && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{p.intro}</p>}

          <div className="mt-6">
            {p.status === "accepted" ? (
              <>
                <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  Accepted by {p.accepted_name} on {date(p.accepted_at!.slice(0, 10))} — total {money(acceptedTotal)}. Thank you!
                </p>
                <table className="mt-4 w-full text-sm">
                  <tbody>
                    {p.items
                      .filter((it) => !it.optional || it.selected)
                      .map((it) => (
                        <tr key={it.id} className="border-t border-slate-100">
                          <td className="py-2 text-slate-700">
                            {it.description}
                            {Number(it.quantity) !== 1 && <span className="text-slate-400"> × {Number(it.quantity)}</span>}
                          </td>
                          <td className="py-2 text-right text-slate-900">{money(Number(it.quantity) * Number(it.unit_price))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {p.deposit_percent > 0 && (
                  <div className="mt-5 rounded-md border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-800">
                      Deposit: {money(deposit)} ({p.deposit_percent}%)
                    </p>
                    {p.deposit_paid_on ? (
                      <p className="mt-1 text-sm text-emerald-700">Paid {date(p.deposit_paid_on)}.</p>
                    ) : canPayDeposit ? (
                      <form action={payDeposit.bind(null, token)} className="mt-3">
                        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                        {paid && <p className="mb-2 text-sm text-amber-700">Payment is still processing — refresh in a moment.</p>}
                        <SubmitButton className="w-full" pendingLabel="Opening secure checkout…">
                          Pay {money(deposit)} deposit by card
                        </SubmitButton>
                        <p className="mt-2 text-center text-xs text-slate-500">Secure checkout by Stripe.</p>
                      </form>
                    ) : (
                      <p className="mt-1 text-sm text-slate-600">{p.business_name} will be in touch about the deposit.</p>
                    )}
                  </div>
                )}
              </>
            ) : p.status === "declined" ? (
              <p className="rounded-md bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">You declined this proposal. Changed your mind? Call {p.business_name}{p.business_phone ? ` at ${p.business_phone}` : ""}.</p>
            ) : expired ? (
              <p className="rounded-md bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
                This proposal expired on {date(p.valid_until!)}. Call {p.business_name}
                {p.business_phone ? ` at ${p.business_phone}` : ""} for a fresh one.
              </p>
            ) : (
              <OptionPicker required={required} options={options} depositPercent={p.deposit_percent} accept={acceptProposal.bind(null, token)} decline={declineProposal.bind(null, token)} error={error} />
            )}
          </div>

          {p.terms && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Terms</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{p.terms}</p>
            </div>
          )}
          {open && <p className="mt-6 text-center text-xs text-slate-400">Questions? Reply to the text or email this came in, or call {p.business_phone ?? p.business_name}.</p>}
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          Sent with <Logo className="h-4 w-4" /> JetLemon
        </p>
      </div>
    </main>
  );
}
