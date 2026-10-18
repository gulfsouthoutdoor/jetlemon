import { Button, Card, ErrorNote, PageHeader } from "@/components/ui";
import { getContext, hasActiveAccess } from "@/lib/org";
import { date } from "@/lib/format";
import { PLAN } from "@/lib/stripe";
import { openPortal, startCheckout } from "./actions";

const features = ["Unlimited customers & jobs", "Scheduling calendar", "Invoices with line items", "Unlimited team members", "Email support"];

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const { success, error } = await searchParams;
  const { org, role } = await getContext();
  const active = org.subscription_status === "active";
  const access = hasActiveAccess(org);

  return (
    <>
      <PageHeader title="Billing" />
      <div className="max-w-lg space-y-4">
        <ErrorNote message={error} />
        {success && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Thanks! Your subscription is being activated — refresh in a moment.</p>}
        {!access && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Your {org.subscription_status === "trialing" ? "free trial has ended" : "subscription is inactive"}. Subscribe to keep using ServiceDesk — your data is safe.
          </p>
        )}
        <Card>
          <p className="text-sm font-medium text-indigo-600">{PLAN.name} plan</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            ${PLAN.price}
            <span className="text-base font-normal text-slate-500">/month</span>
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
            {features.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-500">
            Status: <span className="font-medium text-slate-900">{org.subscription_status.replace("_", " ")}</span>
            {org.subscription_status === "trialing" && ` · trial ends ${date(org.trial_ends_at)}`}
          </p>
          {role === "owner" ? (
            <div className="mt-5">
              {org.stripe_subscription_id ? (
                <form action={openPortal}>
                  <Button variant="secondary">Manage subscription</Button>
                </form>
              ) : (
                <form action={startCheckout}>
                  <Button>{active ? "Manage" : "Subscribe now"}</Button>
                </form>
              )}
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">Ask your account owner to manage billing.</p>
          )}
        </Card>
      </div>
    </>
  );
}
