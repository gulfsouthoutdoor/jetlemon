import { TimezoneSelect } from "@/components/timezone-select";
import { Button, ButtonLink, Card, ErrorNote, Field, Input, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/org";
import type { Member } from "@/lib/types";
import { cancelInvite, inviteMember, removeMember, updateBusiness } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const { supabase, org, user, role } = await getContext();
  const isOwner = role === "owner";
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.rpc("org_members", { target_org: org.id }),
    supabase.from("invitations").select("*").eq("org_id", org.id).order("created_at"),
  ]);

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
