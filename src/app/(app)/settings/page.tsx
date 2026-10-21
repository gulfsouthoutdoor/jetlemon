import { CopyField } from "@/components/copy-field";
import { TimezoneSelect } from "@/components/timezone-select";
import { Button, ButtonLink, Card, ErrorNote, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { dateTime } from "@/lib/format";
import { metaConfigured } from "@/lib/meta";
import { getContext } from "@/lib/org";
import { smsConfigured } from "@/lib/sms";
import { getTextUsage } from "@/lib/texting";
import { hasTexting } from "@/lib/stripe";
import type { Member, MetaPage } from "@/lib/types";
import { cancelInvite, disconnectPage, inviteMember, regenerateLeadAddress, removeMember, updateBusiness, updateTexting } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const { supabase, org, user, role } = await getContext();
  const isOwner = role === "owner";
  const [{ data: members }, { data: invites }, { data: pages }, usage] = await Promise.all([
    supabase.rpc("org_members", { target_org: org.id }),
    supabase.from("invitations").select("*").eq("org_id", org.id).is("accepted_at", null).order("created_at"),
    supabase.from("meta_pages").select("id, org_id, page_id, page_name, connected_at").eq("org_id", org.id).order("connected_at"),
    getTextUsage(supabase, org),
  ]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const leadAddress = `${siteUrl}/api/leads/${org.inbound_token}`;
  const leadForm = `${siteUrl}/lead/${org.inbound_token}`;

  return (
    <>
      <PageHeader title="Settings" actions={<ButtonLink variant="secondary" href="/billing">Billing</ButtonLink>} />
      <div className="max-w-2xl space-y-6">
        <ErrorNote message={error} />
        {saved && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>}

        <Card title="Business profile">
          <form action={updateBusiness} className="grid gap-4 sm:grid-cols-2">
            <fieldset disabled={!isOwner} className="contents">
              <Field label="Business name" className="sm:col-span-2">
                <Input name="name" defaultValue={org.name} required />
              </Field>
              <Field label="Phone">
                <Input name="phone" defaultValue={org.phone ?? ""} />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" defaultValue={org.email ?? ""} />
              </Field>
              <Field label="Address (shown on invoices)" className="sm:col-span-2">
                <Input name="address" defaultValue={org.address ?? ""} />
              </Field>
              <Field label="Time zone" className="sm:col-span-2">
                <TimezoneSelect name="timezone" defaultValue={org.timezone} />
              </Field>
              <Field label="What you do" className="sm:col-span-2">
                <Textarea name="services" defaultValue={org.services ?? ""} rows={2} />
              </Field>
              <Field label="Service area">
                <Input name="service_area" defaultValue={org.service_area ?? ""} />
              </Field>
              <Field label="Hours">
                <Input name="hours" defaultValue={org.hours ?? ""} />
              </Field>
              <Field label="Website" className="sm:col-span-2">
                <Input name="website" defaultValue={org.website ?? ""} />
              </Field>
              <Field label="Line above your lead form" className="sm:col-span-2">
                <Input name="lead_form_intro" defaultValue={org.lead_form_intro ?? ""} />
              </Field>
              <Field label="Bottom of every invoice" className="sm:col-span-2">
                <Input name="invoice_footer" defaultValue={org.invoice_footer ?? ""} />
              </Field>
              {isOwner && (
                <div>
                  <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
                </div>
              )}
            </fieldset>
          </form>
        </Card>

        <Card title="Lead capture">
          <div className="space-y-5 text-sm">
            <div>
              <p className="mb-1 font-medium text-slate-700">Facebook &amp; Instagram lead ads</p>
              {(pages as MetaPage[])?.length ? (
                <ul className="mb-3 divide-y divide-slate-100">
                  {(pages as MetaPage[]).map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2">
                      <span>
                        {p.page_name} <span className="text-slate-400">· connected {dateTime(p.connected_at, org.timezone)}</span>
                      </span>
                      {isOwner && (
                        <form action={disconnectPage.bind(null, p.id)}>
                          <button className="text-slate-400 hover:text-red-600">Disconnect</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-slate-500">Leads from your Facebook and Instagram lead forms land here the moment someone submits.</p>
              )}
              {isOwner && metaConfigured() && (
                <ButtonLink href="/api/meta/connect" variant="secondary">
                  {(pages as MetaPage[])?.length ? "Connect another page" : "Connect Facebook"}
                </ButtonLink>
              )}
              {isOwner && !metaConfigured() && <p className="text-xs text-slate-500">Facebook connection is not switched on for this server yet.</p>}
            </div>

            <div>
              <p className="mb-1 font-medium text-slate-700">Your lead address</p>
              <p className="mb-2 text-slate-500">
                Point a website form, Zapier, or Make at this address and every submission becomes a lead. Send fields named name, phone, email, address, and
                message.
              </p>
              <CopyField value={leadAddress} label="Lead address" />
              <p className="mt-3 mb-1 font-medium text-slate-700">Ready-made form</p>
              <p className="mb-2 text-slate-500">A simple hosted form you can link to from anywhere.</p>
              <CopyField value={leadForm} label="Hosted lead form" />
              {isOwner && (
                <form action={regenerateLeadAddress} className="mt-2">
                  <button className="text-xs text-slate-400 hover:text-red-600">Reset address (old links stop working)</button>
                </form>
              )}
            </div>
          </div>
        </Card>

        <Card title="Texting">
          {!hasTexting(org) && (
            <div className="mb-4 rounded-md border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
              <p className="font-medium">Texting is part of the Pro plan.</p>
              <p className="mt-1">Your own number, an automatic text to every new lead, two-way texting, lead alerts and a daily rundown — $49/month, 500 texts included.</p>
              {isOwner && (
                <ButtonLink href="/billing" className="mt-3">
                  Upgrade to Pro
                </ButtonLink>
              )}
            </div>
          )}
          <form action={updateTexting} className={`space-y-4 text-sm ${hasTexting(org) ? "" : "pointer-events-none opacity-50"}`}>
            <fieldset disabled={!isOwner} className="contents">
              <div>
                <p className="mb-1 font-medium text-slate-700">Your texting number</p>
                {org.sms_number ? (
                  <p className="text-slate-900">{org.sms_number}</p>
                ) : (
                  <p className="text-slate-500">No number yet. {smsConfigured() ? "Contact support to get one assigned." : "Texting is not switched on for this server yet."}</p>
                )}
              </div>
              {org.sms_number && (
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-700">This month</p>
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-900">{usage.used}</span> of {usage.allowance} texts
                      {usage.blocks > 0 && ` · ${usage.blocks} extra block${usage.blocks === 1 ? "" : "s"} bought`}
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full ${usage.capReached ? "bg-red-500" : usage.used > usage.included ? "bg-amber-500" : "bg-indigo-500"}`}
                      style={{ width: `${Math.min(100, (usage.used / Math.max(1, usage.allowance)) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {usage.included} texts are included. After that, extra texts are added in blocks of {usage.blockSize} for ${(usage.blockPriceCents / 100).toFixed(0)} each,
                    billed on your next invoice — never past the cap below.
                  </p>
                  {usage.capReached && <p className="mt-1 text-xs font-medium text-red-700">Cap reached — texting is stopped until next month or until you raise the cap.</p>}
                </div>
              )}
              <Field label="Monthly cap: stop after this many extra blocks (0 = never buy extra)">
                <Input name="text_block_limit" type="number" min={0} max={50} defaultValue={org.text_block_limit} className="w-28" />
              </Field>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="texting_paused" defaultChecked={org.texting_paused} className="h-4 w-4 rounded border-slate-300" />
                <span className="font-medium text-slate-700">Pause all texting</span>
                <span className="text-slate-500">— nothing goes out, nothing is billed</span>
              </label>
              <Field label="Text me when a new lead comes in (your cell)">
                <Input name="notify_phone" defaultValue={org.notify_phone ?? ""} placeholder="205-555-0142" />
              </Field>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="auto_text_enabled" defaultChecked={org.auto_text_enabled} className="h-4 w-4 rounded border-slate-300" />
                <span className="font-medium text-slate-700">Auto-text new leads right away</span>
              </label>
              <Field label="Auto-text message">
                <Textarea name="auto_text_template" defaultValue={org.auto_text_template} />
              </Field>
              <p className="text-xs text-slate-500">You can use {"{first_name}"}, {"{name}"} and {"{business}"}. Needs a texting number and the lead&apos;s phone.</p>
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="daily_brief_enabled" defaultChecked={org.daily_brief_enabled} className="h-4 w-4 rounded border-slate-300" />
                  <span className="font-medium text-slate-700">Text me a daily rundown</span>
                </label>
                <label className="flex items-center gap-2 text-slate-600">
                  at
                  <Input name="daily_brief_hour" type="number" min={0} max={23} defaultValue={org.daily_brief_hour} className="w-20" />
                  o&apos;clock (24-hour)
                </label>
              </div>
              <p className="-mt-2 text-xs text-slate-500">Today&apos;s jobs, overdue invoices, and leads waiting — sent to the alert number above. Counts as one text.</p>
              {isOwner && (
                <div>
                  <Button>Save</Button>
                </div>
              )}
            </fieldset>
          </form>
        </Card>

        <Card title="Team">
          <ul className="divide-y divide-slate-100 text-sm">
            {((members ?? []) as Member[]).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between py-2.5">
                <span>
                  {m.email} <span className="text-slate-400">· {m.role}</span>
                </span>
                {isOwner && m.user_id !== user.id && (
                  <form action={removeMember.bind(null, m.user_id)}>
                    <button className="text-slate-400 hover:text-red-600">Remove</button>
                  </form>
                )}
              </li>
            ))}
            {(invites ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2.5 text-slate-500">
                <span>
                  {i.email} <span className="text-slate-400">· invited</span>
                </span>
                {isOwner && (
                  <form action={cancelInvite.bind(null, i.id)}>
                    <button className="text-slate-400 hover:text-red-600">Cancel</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <form action={inviteMember} className="mt-4 flex gap-2">
              <Input name="email" type="email" placeholder="teammate@example.com" required />
              <Button variant="secondary">Invite</Button>
            </form>
          )}
          <p className="mt-2 text-xs text-slate-500">Invited teammates join automatically when they sign up or sign in with that email.</p>
        </Card>
      </div>
    </>
  );
}
