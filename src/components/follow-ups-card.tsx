import { Button, ButtonLink, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { PLANS } from "@/lib/stripe";
import { SubmitButton } from "@/components/submit-button";
import { emailConfigured } from "@/lib/email";
import { MAX_STEPS, MERGE_FIELDS, SEND_HOUR, SEQUENCE_INFO, type Sequence } from "@/lib/sequences";
import type { Organization } from "@/lib/types";
import { resetSequence, saveSequence } from "@/app/(app)/settings/actions";

export function FollowUpsCard({ org, sequences, isOwner, texting }: { org: Organization; sequences: Sequence[]; isOwner: boolean; texting: boolean }) {
  return (
    <div id="followups">
      <Card title="Follow-ups">
        {!texting && (
          <div className="mb-4 rounded-md border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
            <p className="font-medium">Follow-ups are part of the Pro plan.</p>
            <p className="mt-1">Every new lead gets a text and an email right away and again on days 1, 3 and 7 — plus thank-you, review and unpaid-invoice follow-ups — ${PLANS.pro.price}/month. Unlimited emails, 500 texts included.</p>
            {isOwner && (
              <ButtonLink href="/billing" className="mt-3">
                Upgrade to Pro
              </ButtonLink>
            )}
          </div>
        )}
        <p className="mb-4 text-sm text-slate-600">
          Automatic texts and emails that go out on their own and stop on their own. Day 0 goes the moment the lead arrives; later days go at {SEND_HOUR} AM your time. Save with an empty row to add another step (up to {MAX_STEPS}).
          {!emailConfigured() && " Email isn't switched on for this server yet, so email steps will be skipped."}
        </p>
        <div className={`space-y-6 ${texting ? "" : "pointer-events-none opacity-50"}`}>
          {sequences.map((seq) => {
            const info = SEQUENCE_INFO[seq.key];
            const rows = [...seq.steps, ...(seq.steps.length < MAX_STEPS ? [null] : [])];
            return (
              <form key={seq.key} action={saveSequence.bind(null, seq.key)} className="rounded-lg border border-slate-200 p-4">
                <fieldset disabled={!isOwner} className="contents">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="enabled" defaultChecked={seq.enabled} className="h-4 w-4 rounded border-slate-300" />
                      <span className="text-sm font-semibold text-slate-900">{info.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${seq.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{seq.enabled ? "On" : "Off"}</span>
                    </label>
                    <p className="text-xs text-slate-500">
                      Starts when {info.trigger}. Stops when {info.stops}.
                    </p>
                  </div>

                  {seq.key === "after_job" && (
                    <Field label="Your review link (Google, Facebook…) — fills in {review_link}" className="mt-3">
                      <Input name="review_url" defaultValue={org.review_url ?? ""} placeholder="https://g.page/r/…/review" />
                    </Field>
                  )}

                  <div className="mt-3 space-y-3">
                    {rows.map((step, i) => (
                      <details key={i} open={Boolean(step)} className="rounded-md bg-slate-50 p-3 text-sm">
                        <summary className="cursor-pointer text-slate-700">
                          {step ? (
                            <>
                              <span className="font-medium">Day {step.day}</span> · {step.channel === "email" ? "Email" : "Text"}
                              {step.channel === "email" && step.subject ? ` · ${step.subject}` : ""}
                            </>
                          ) : (
                            <span className="text-slate-500">Add a step…</span>
                          )}
                        </summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[6rem_8rem_1fr]">
                          <Field label="Day">
                            <Input name={`step_${i}_day`} type="number" min={0} max={60} defaultValue={step?.day ?? ""} />
                          </Field>
                          <Field label="Send as">
                            <Select name={`step_${i}_channel`} defaultValue={step?.channel ?? "text"}>
                              <option value="text">Text</option>
                              <option value="email">Email</option>
                            </Select>
                          </Field>
                          <Field label="Email subject (emails only)">
                            <Input name={`step_${i}_subject`} defaultValue={step?.subject ?? ""} />
                          </Field>
                          <Field label="Message (leave empty to remove this step)" className="sm:col-span-3">
                            <Textarea name={`step_${i}_body`} defaultValue={step?.body ?? ""} rows={step?.channel === "email" ? 5 : 2} />
                          </Field>
                        </div>
                      </details>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">You can use {MERGE_FIELDS[seq.key].join(", ")}.</p>
                  {isOwner && (
                    <div className="mt-3 flex items-center gap-3">
                      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
                      {seq.custom && (
                        <Button type="submit" variant="ghost" formAction={resetSequence.bind(null, seq.key)}>
                          Back to the standard wording
                        </Button>
                      )}
                    </div>
                  )}
                </fieldset>
              </form>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
