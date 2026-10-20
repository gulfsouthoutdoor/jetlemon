import { CopyField } from "@/components/copy-field";
import { TimezoneSelect } from "@/components/timezone-select";
import { Button, ButtonLink, Card, ErrorNote, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { metaConfigured } from "@/lib/meta";
import { getContext } from "@/lib/org";
import { smsConfigured } from "@/lib/sms";
import type { Member, MetaPage } from "@/lib/types";
import { cancelInvite, disconnectPage, inviteMember, regenerateLeadAddress, removeMember, updateBusiness, updateTexting } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const { supabase, org, user, role } = await getContext();
  const isOwner = role === "owner";
  const [{ data: members }, { data: invites }, { data: pages }] = await Promise.all([
    supabase.rpc("org_members", { target_org: org.id }),
    supabase.from("invitations").select("*").eq("org_id", org.id).order("created_at"),
    supabase.from("meta_pages").select("id, org_id, page_id, page_name, connected_at").eq("org_id", org.id).order("connected_at"),
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
              {isOwner && (
                <div>
                  <Button>Save</Button>
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
          <form action={updateTexting} className="space-y-4 text-sm">
            <fieldset disabled={!isOwner} className="contents">
              <div>
                <p className="mb-1 font-medium text-slate-700">Your texting number</p>
                {org.sms_number ? (
                  <p className="text-slate-900">{org.sms_number}</p>
                ) : (
                  <p className="text-slate-500">No number yet. {smsConfigured() ? "Contact support to get one assigned." : "Texting is not switched on for this server yet."}</p>
                )}
              </div>
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
