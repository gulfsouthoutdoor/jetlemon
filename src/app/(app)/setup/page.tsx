import { Button, Card, ErrorNote, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { aiConfigured } from "@/lib/ai";
import { getContext } from "@/lib/org";
import { draftProfile, saveProfile, skipSetup, type Draft } from "./actions";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ draft?: string; error?: string }> }) {
  const { draft: encoded, error } = await searchParams;
  const { org } = await getContext();

  let draft: Draft | null = null;
  if (encoded) {
    try {
      draft = JSON.parse(Buffer.from(encoded, "base64url").toString()) as Draft;
    } catch {
      draft = null;
    }
  }

  if (!draft) {
    return (
      <>
        <PageHeader title={`Welcome, ${org.name}`} subtitle="Four quick questions and we'll set everything up for you. You can change any of it later." />
        <div className="max-w-xl space-y-6">
          <ErrorNote message={error} />
          <Card>
            <form action={draftProfile} className="space-y-4">
              <Field label="What kind of work do you do?">
                <Textarea name="what" required placeholder="Residential house cleaning, mostly biweekly, plus move-out deep cleans" />
              </Field>
              <Field label="Where do you serve?">
                <Input name="where" required placeholder="Shelby County and south Birmingham" />
              </Field>
              <Field label="What are your hours?">
                <Input name="hours" required placeholder="Mon–Fri 8–5, Saturdays by appointment" />
              </Field>
              <Field label="Website or Google Business link (optional)">
                <Input name="website" placeholder="brightpathclean.com" />
              </Field>
              <div className="flex items-center gap-3">
                <SubmitButton pendingLabel="Writing your setup…">{aiConfigured() ? "Set it up for me" : "Continue"}</SubmitButton>
                <button formAction={skipSetup} className="text-sm text-slate-500 hover:text-slate-900">
                  Skip for now
                </button>
              </div>
            </form>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Here's what we set up" subtitle="Read it over, change anything, and save." />
      <div className="max-w-2xl space-y-6">
        <ErrorNote message={error} />
        {draft.note && <p className="rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{draft.note}</p>}
        <form action={saveProfile} className="space-y-6">
          <Card title="Your business">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What you do" className="sm:col-span-2">
                <Textarea name="services" defaultValue={draft.services} rows={2} />
              </Field>
              <Field label="Service area">
                <Input name="service_area" defaultValue={draft.service_area} />
              </Field>
              <Field label="Hours">
                <Input name="hours" defaultValue={draft.hours} />
              </Field>
              <Field label="Phone">
                <Input name="phone" defaultValue={draft.phone} />
              </Field>
              <Field label="Website">
                <Input name="website" defaultValue={org.website ?? ""} />
              </Field>
              <Field label="Address (shown on invoices)" className="sm:col-span-2">
                <Input name="address" defaultValue={draft.address} />
              </Field>
            </div>
          </Card>

          <Card title="What customers will see">
            <div className="space-y-4">
              <Field label="First text a new lead gets">
                <Textarea name="auto_text_template" defaultValue={draft.auto_text_template} rows={2} />
              </Field>
              <p className="-mt-2 text-xs text-slate-500">{"{first_name}"} and {"{business}"} fill in automatically.</p>
              <Field label="Line above your lead form">
                <Input name="lead_form_intro" defaultValue={draft.lead_form_intro} />
              </Field>
              <Field label="Bottom of every invoice">
                <Input name="invoice_footer" defaultValue={draft.invoice_footer} />
              </Field>
              {draft.tags.length > 0 && (
                <p className="text-sm text-slate-600">
                  Tags you might use for customers: {draft.tags.map((t) => <span key={t} className="mr-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs">{t}</span>)}
                </p>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <SubmitButton name="next" value="dashboard" pendingLabel="Saving…">
              Save and go to dashboard
            </SubmitButton>
            <SubmitButton name="next" value="import" variant="secondary" pendingLabel="Saving…">
              Save, then import my customers
            </SubmitButton>
          </div>
        </form>
      </div>
    </>
  );
}
