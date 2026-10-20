-- JetLemon — lead capture (inbound address + Facebook Lead Ads) and texting.

-- ───────────────────────── Organizations: lead + texting settings ─────────────────────────

alter table public.organizations
  add column inbound_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  add column sms_number text unique,                 -- the business's texting number (E.164), provisioned by JetLemon
  add column notify_phone text,                      -- owner's cell for "new lead" alerts (E.164)
  add column auto_text_enabled boolean not null default false,
  add column auto_text_template text not null default
    'Hi {first_name}, this is {business}. We got your request — when is a good time to call you?';

-- Owners may edit the texting preferences; the token and number are managed by the platform.
grant update (notify_phone, auto_text_enabled, auto_text_template) on public.organizations to authenticated;

-- Lets an owner rotate the inbound address if it leaks.
create or replace function public.regenerate_inbound_token(target_org uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare new_token text;
begin
  if not public.is_owner(target_org) then
    raise exception 'not allowed';
  end if;
  new_token := encode(gen_random_bytes(16), 'hex');
  update organizations set inbound_token = new_token where id = target_org;
  return new_token;
end;
$$;

-- ───────────────────────── Jobs: where a lead came from ─────────────────────────

alter table public.jobs
  add column source text,        -- 'facebook' | 'website' | 'zapier' | 'manual' | anything the sender names
  add column source_ref text;    -- provider id (e.g. Facebook leadgen_id) used to drop duplicates

create unique index jobs_source_ref_unique on public.jobs (org_id, source, source_ref)
  where source_ref is not null;

-- ───────────────────────── Facebook pages connected to a business ─────────────────────────

create table public.meta_pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  page_id text not null unique,
  page_name text not null,
  access_token text not null,           -- long-lived page token; server-only (see column grants)
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now()
);
create index on public.meta_pages (org_id);

alter table public.meta_pages enable row level security;
create policy "members read pages" on public.meta_pages
  for select using (public.is_member(org_id));
create policy "owners disconnect pages" on public.meta_pages
  for delete using (public.is_owner(org_id));
-- Members can list pages but never read the token; only the service role (webhook) can.
revoke select on public.meta_pages from authenticated;
grant select (id, org_id, page_id, page_name, connected_by, connected_at) on public.meta_pages to authenticated;
grant delete on public.meta_pages to authenticated;

-- ───────────────────────── Text messages ─────────────────────────

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text not null,
  from_number text not null,
  to_number text not null,
  provider_sid text,
  status text not null default 'sent',   -- queued | sent | delivered | failed | received
  kind text not null default 'manual',   -- manual | auto_text | lead_alert
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.messages (customer_id, created_at);
create index on public.messages (org_id, created_at desc);

alter table public.messages enable row level security;
create policy "members manage messages" on public.messages
  for all using (public.is_member(org_id)) with check (public.is_member(org_id));
