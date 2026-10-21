import { Button, ErrorNote, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getContext, hasActiveAccess } from "@/lib/org";
import { date } from "@/lib/format";
import { PLANS, effectivePlan, isComplimentary } from "@/lib/stripe";
import { choosePlan, openPortal } from "./actions";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const { success, error } = await searchParams;
  const { org, role } = await getContext();
  const access = hasActiveAccess(org);
  const paying = Boolean(org.stripe_subscription_id) && org.subscription_status !== "canceled";
  const current = effectivePlan(org);
  const trialing = org.subscription_status === "trialing";
  const comped = isComplimentary(org);

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle={
          <>
            Status: <span className="font-medium text-slate-900">{org.subscription_status.replace("_", " ")}</span>
            {trialing && ` · Pro trial ends ${date(org.trial_ends_at)}`}
            {paying && ` · ${PLANS[current].name} plan`}
            {comped && ` · ${PLANS[current].name} plan, complimentary`}
          </>
        }
      />
      <div className="max-w-3xl space-y-4">
        <ErrorNote message={error} />
        {success && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Done — your plan is updating. Refresh in a moment if it hasn&apos;t changed yet.</p>}
        {!access && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Your {org.subscription_status === "trialing" ? "free trial has ended" : "subscription is inactive"}. Pick a plan to keep using JetLemon — your data is safe.
          </p>
        )}
        {comped && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            This account is complimentary — {PLANS[current].name} plan, nothing to pay. The plans below are what subscribers see.
          </p>
        )}
        {trialing && (
          <p className="rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
            Your trial includes everything in Pro. Pick the plan you want when the trial ends — or now, if you&apos;d like to lock it in.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {(["starter", "pro"] as const).map((key) => {
            const p = PLANS[key];
            const isCurrent = (paying || comped) && current === key;
            const highlight = key === "pro";
            return (
              <section key={key} className={`rounded-xl border bg-white p-6 shadow-sm ${highlight ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"}`}>
                <div className="flex items-baseline justify-between">
                  <p className={`text-sm font-semibold ${highlight ? "text-indigo-600" : "text-slate-700"}`}>{p.name}</p>
                  {isCurrent && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Current plan</span>}
                </div>
                <p className="mt-1 text-3xl font-semibold text-slate-900">
                  ${p.price}
                  <span className="text-base font-normal text-slate-500">/month</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">{p.blurb}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                  {p.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                {role === "owner" && !comped && (
                  <form action={choosePlan} className="mt-5">
                    <input type="hidden" name="plan" value={key} />
                    {isCurrent ? (
                      <Button type="button" variant="secondary" disabled className="w-full">
                        You&apos;re on {p.name}
                      </Button>
                    ) : (
                      <SubmitButton pendingLabel="One moment…" variant={highlight ? "primary" : "secondary"} className="w-full">
                        {paying ? (key === "pro" ? "Upgrade to Pro" : "Switch to Starter") : `Choose ${p.name}`}
                      </SubmitButton>
                    )}
                  </form>
                )}
              </section>
            );
          })}
        </div>

        {role === "owner" ? (
          paying && (
            <form action={openPortal}>
              <Button variant="secondary">Update card, see invoices, or cancel</Button>
            </form>
          )
        ) : (
          <p className="text-sm text-slate-500">Ask your account owner to manage billing.</p>
        )}
        <p className="text-xs text-slate-500">Switching plans is prorated — you only pay the difference for the rest of the month. Text blocks are added to the next invoice, never past the cap you set.</p>
      </div>
    </>
  );
}
