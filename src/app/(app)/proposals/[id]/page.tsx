import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyField } from "@/components/copy-field";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { aiConfigured } from "@/lib/ai";
import { date, dateTime, money } from "@/lib/format";
import { getContext } from "@/lib/org";
import { depositAmount, isExpired, proposalMax, proposalTotal, proposalUrl, syncDeposit } from "@/lib/proposals";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Proposal, ProposalItem } from "@/lib/types";
import { addProposalItem, deleteProposal, draftProposal, proposalToInvoice, proposalToJob, removeProposalItem, setProposalStatus, updateProposal } from "../actions";

export default async function ProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const { supabase, org } = await getContext();
  const [{ data }, { data: customers }] = await Promise.all([
    supabase.from("proposals").select("*, customers(id, name, email, phone, address), proposal_items(*)").eq("id", id).maybeSingle(),
    supabase.from("customers").select("id, name").order("name"),
  ]);
  if (!data) notFound();
  const p = data as Proposal;
  const items = ([...(p.proposal_items ?? [])] as ProposalItem[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (p.status === "accepted" && p.deposit_percent > 0 && !p.deposit_paid_on && p.stripe_checkout_session_id) {
    p.deposit_paid_on = await syncDeposit(createAdminClient(), p, org.stripe_account_id);
  }
  const editable = p.status === "draft";
  const expired = isExpired(p);
  const total = proposalTotal(items);
  const max = proposalMax(items);
  const link = proposalUrl(p.pay_token);
  const deposit = depositAmount(items, p.deposit_percent);

  const mailto =
    p.customers?.email &&
    `mailto:${p.customers.email}?subject=${encodeURIComponent(`Proposal from ${org.name}${p.title ? `: ${p.title}` : ""}`)}&body=${encodeURIComponent(
      `Hi ${p.customers.name},\n\nHere's the proposal we talked about${p.title ? ` for ${p.title}` : ""} — ${money(total)}.\n\nReview and accept it here: ${link}\n\nReply with any questions.\n${org.name}`,
    )}`;

  return (
    <>
      <PageHeader
        title={p.title ? `#${p.number} · ${p.title}` : `Proposal #${p.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge status={expired ? "expired" : p.status} />
            {p.customers && (
              <Link href={`/customers/${p.customers.id}`} className="text-indigo-600 hover:underline">
                {p.customers.name}
              </Link>
            )}
            {p.accepted_at && (
              <span className="text-emerald-700">
                · accepted {dateTime(p.accepted_at, org.timezone)} by {p.accepted_name}
              </span>
            )}
            {p.declined_at && <span className="text-red-700">· declined {dateTime(p.declined_at, org.timezone)}{p.decline_reason ? `: “${p.decline_reason}”` : ""}</span>}
          </span>
        }
        actions={
          <>
            {p.status === "draft" && (
              <form action={setProposalStatus.bind(null, p.id, "sent")}>
                <SubmitButton pendingLabel="…">Mark as sent</SubmitButton>
              </form>
            )}
            {(p.status === "sent" || p.status === "expired" || p.status === "declined") && (
              <form action={setProposalStatus.bind(null, p.id, "draft")}>
                <Button variant="secondary">Edit again</Button>
              </form>
            )}
            {p.status === "accepted" && (
              <>
                <form action={proposalToJob.bind(null, p.id)}>
                  <SubmitButton pendingLabel="…">{p.job_id ? "Open job" : "Create job"}</SubmitButton>
                </form>
                <form action={proposalToInvoice.bind(null, p.id)}>
                  <SubmitButton variant="secondary" pendingLabel="…">
                    {p.invoice_id ? "Open invoice" : "Create invoice"}
                  </SubmitButton>
                </form>
              </>
            )}
            {mailto && p.status !== "draft" && (
              <a href={mailto} className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                Email customer
              </a>
            )}
          </>
        }
      />
      <ErrorNote message={error} />
      {saved && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{saved}</p>}

      {p.status !== "draft" && (
        <div className="mb-6 rounded-md border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Customer link — they review, pick options and accept here</p>
          <CopyField value={link} />
          {p.status === "accepted" && p.deposit_percent > 0 && (
            <p className="mt-2 text-sm text-slate-600">
              Deposit {p.deposit_percent}% = {money(deposit)} — {p.deposit_paid_on ? <span className="font-medium text-emerald-700">paid {date(p.deposit_paid_on)}</span> : "not paid yet"}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Lines">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Description</th>
                  <th className="w-16 py-2 text-right">Qty</th>
                  <th className="w-24 py-2 text-right">Price</th>
                  <th className="w-24 py-2 text-right">Amount</th>
                  {editable && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className={`border-b border-slate-100 ${it.optional && !it.selected && p.status === "accepted" ? "text-slate-400 line-through" : ""}`}>
                    <td className="py-2.5 text-slate-800">
                      {it.description}
                      {it.optional && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 no-underline">optional</span>}
                    </td>
                    <td className="py-2.5 text-right">{Number(it.quantity)}</td>
                    <td className="py-2.5 text-right">{money(it.unit_price)}</td>
                    <td className="py-2.5 text-right">{money(Number(it.quantity) * Number(it.unit_price))}</td>
                    {editable && (
                      <td className="text-right">
                        <form action={removeProposalItem.bind(null, p.id, it.id)}>
                          <button className="text-slate-400 hover:text-red-600" aria-label="Remove line">
                            ×
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      No lines yet.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-slate-900">
                  <td className="pt-3" colSpan={3}>
                    {p.status === "accepted" ? "Accepted total" : "Total"}
                    {max !== total && p.status !== "accepted" && <span className="ml-2 text-xs font-normal text-slate-500">up to {money(max)} with every option</span>}
                  </td>
                  <td className="pt-3 text-right">{money(total)}</td>
                </tr>
              </tfoot>
            </table>

            {editable && (
              <form action={addProposalItem.bind(null, p.id)} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_4rem_6rem_auto_auto]">
                <Input name="description" placeholder="Describe the work or part" required />
                <Input name="quantity" type="number" step="0.25" min="0.25" defaultValue={1} aria-label="Quantity" />
                <Input name="unit_price" type="number" step="0.01" min="0" placeholder="Price" aria-label="Price" />
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" name="optional" className="h-4 w-4 rounded border-slate-300" /> Optional
                </label>
                <SubmitButton variant="secondary" pendingLabel="…">
                  Add
                </SubmitButton>
              </form>
            )}
          </Card>

          {editable && aiConfigured() && (
            <Card title="Draft it with AI">
              <form action={draftProposal.bind(null, p.id)} className="flex flex-col gap-2 sm:flex-row">
                <Input name="brief" placeholder="e.g. replace 50-gal gas water heater, haul away the old one, permit" required />
                <SubmitButton variant="secondary" pendingLabel="Writing…">
                  Draft lines + intro
                </SubmitButton>
              </form>
              <p className="mt-2 text-xs text-slate-500">Writes the line items and a short intro in plain words. It never guesses prices — you fill those in.</p>
            </Card>
          )}

          <Card title="Details">
            <form action={updateProposal.bind(null, p.id)} className="space-y-4">
              <fieldset disabled={!editable} className="contents">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Customer">
                    <Select name="customer_id" defaultValue={p.customer_id ?? ""}>
                      <option value="">— None —</option>
                      {(customers ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Title">
                    <Input name="title" defaultValue={p.title} />
                  </Field>
                </div>
                <Field label="Intro — what you'll do, in a few friendly sentences">
                  <Textarea name="intro" defaultValue={p.intro ?? ""} rows={3} />
                </Field>
                <Field label="Terms (payment, scheduling, warranty — optional)">
                  <Textarea name="terms" defaultValue={p.terms ?? ""} rows={3} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Good until">
                    <Input name="valid_until" type="date" defaultValue={p.valid_until ?? ""} />
                  </Field>
                  <Field label="Deposit on acceptance (% of total, 0 = none)">
                    <Input name="deposit_percent" type="number" min={0} max={100} defaultValue={p.deposit_percent} />
                  </Field>
                </div>
                {!org.stripe_charges_enabled && (
                  <p className="text-xs text-slate-500">
                    Deposits are collected by card only after you{" "}
                    <Link href="/settings#payments" className="text-indigo-600 hover:underline">
                      connect Stripe
                    </Link>
                    .
                  </p>
                )}
                {editable && (
                  <SubmitButton variant="secondary" pendingLabel="Saving…">
                    Save details
                  </SubmitButton>
                )}
              </fieldset>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="How it works">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Add the lines. Mark add-ons as optional so the customer can tick them.</li>
              <li>Mark as sent, then email or text the customer their link.</li>
              <li>They review it on their phone and accept by typing their name{p.deposit_percent > 0 ? `, then pay the ${p.deposit_percent}% deposit` : ""}.</li>
              <li>You get a text and email. One click makes the job and the invoice.</li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">While it&apos;s sent and unanswered, the &ldquo;Proposal sent&rdquo; follow-ups (Settings → Follow-ups) nudge them for you.</p>
          </Card>
          {(p.status === "sent" || p.status === "expired") && (
            <Card title="Other actions">
              <div className="flex flex-wrap gap-2">
                {p.status === "sent" && (
                  <form action={setProposalStatus.bind(null, p.id, "expired")}>
                    <Button variant="secondary">Mark expired</Button>
                  </form>
                )}
              </div>
            </Card>
          )}
          {p.status !== "accepted" && (
            <form action={deleteProposal.bind(null, p.id)}>
              <Button variant="danger" className="w-full">
                Delete proposal
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
