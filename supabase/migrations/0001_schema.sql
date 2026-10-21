-- JetLemon — full schema (applied to the production project on 2026-10-21).
-- Multi-tenant: every business row carries org_id, and RLS restricts access to org members.
-- Design notes:
--   * Platform-managed columns on organizations are protected by a trigger (protect_org_columns), not column grants.
--   * Facebook page tokens live in meta_page_tokens, which has RLS on and no policies, so only the service role reads them.
--   * Accepted invitations are marked, not removed, so the team list keeps history.

create extension if not exists "pgcrypto";

-- ───────────────────────── Organizations & membership ─────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  timezone text not null default 'America/New_York',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'trialing', -- trialing | active | past_due | canceled
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create or replace function public.is_member(target_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where org_id = target_org and user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(target_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where org_id = target_org and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into organizations (name) values (org_name) returning id into new_id;
  insert into memberships (org_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

-- Joins the caller to every org that invited their email; the invitation is marked accepted (kept for history).
create or replace function public.accept_invitations()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  user_email text := lower(auth.jwt() ->> 'email');
  joined integer;
begin
  if auth.uid() is null or user_email is null then
    return 0;
  end if;
  insert into memberships (org_id, user_id, role)
    select org_id, auth.uid(), 'member' from invitations where lower(email) = user_email and accepted_at is null
    on conflict do nothing;
  get diagnostics joined = row_count;
  update invitations set accepted_at = now() where lower(email) = user_email and accepted_at is null;
  return joined;
end;
$$;

create or replace function public.org_members(target_org uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from memberships m join auth.users u on u.id = m.user_id
  where m.org_id = target_org and public.is_member(target_org)
  order by m.created_at;
$$;

-- ───────────────────────── Business data ─────────────────────────

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);
create index on public.customers (org_id, name);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'scheduled'
    check (status in ('lead', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  duration_minutes integer not null default 60,
  address text,
  price numeric(12, 2) not null default 0,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.jobs (org_id, scheduled_at);
create index on public.jobs (customer_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  number integer not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  issued_on date not null default current_date,
  due_on date not null default (current_date + 14),
  paid_on date,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, number)
);
create index on public.invoices (org_id, status);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.invoice_items (invoice_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  body text not null,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.notes (customer_id, created_at desc);

-- Auto-number invoices per org, starting at 1001.
create or replace function public.set_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext(new.org_id::text));
    select coalesce(max(number), 1000) + 1 into new.number
    from public.invoices where org_id = new.org_id;
  end if;
  return new;
end;
$$;
create trigger invoices_set_number before insert on public.invoices
  for each row execute function public.set_invoice_number();

-- ───────────────────────── Row-level security (core) ─────────────────────────

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.notes enable row level security;

create policy "members read org" on public.organizations
  for select using (public.is_member(id));
create policy "owners update org" on public.organizations
  for update using (public.is_owner(id)) with check (public.is_owner(id));

create policy "members read memberships" on public.memberships
  for select using (public.is_member(org_id));
create policy "owners remove members" on public.memberships
  for delete using (public.is_owner(org_id) and user_id <> auth.uid());

create policy "members read invitations" on public.invitations
  for select using (public.is_member(org_id));
create policy "owners create invitations" on public.invitations
  for insert with check (public.is_owner(org_id));
create policy "owners cancel invitations" on public.invitations
  for delete using (public.is_owner(org_id));

do $$
declare t text;
begin
  foreach t in array array['customers', 'jobs', 'invoices', 'invoice_items', 'notes'] loop
    execute format(
      'create policy "members manage %1$s" on public.%1$I for all
         using (public.is_member(org_id)) with check (public.is_member(org_id))', t);
  end loop;
end $$;

-- ───────────────────────── Lead capture, texting, allowance, AI assist ─────────────────────────

alter table public.organizations
  add column inbound_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  add column sms_number text unique,                 -- the business's texting number (E.164), provisioned by JetLemon
  add column notify_phone text,                      -- owner's cell for alerts (E.164)
  add column auto_text_enabled boolean not null default false,
  add column auto_text_template text not null default
    'Hi {first_name}, this is {business}. We got your request — when is a good time to call you?',
  add column texts_included integer not null default 500,
  add column text_block_size integer not null default 250,
  add column text_block_price_cents integer not null default 1000,
  add column text_block_limit integer not null default 2,        -- owner's cap on extra blocks per month
  add column texting_paused boolean not null default false,
  add column services text,
  add column service_area text,
  add column hours text,
  add column website text,
  add column lead_form_intro text,
  add column invoice_footer text,
  add column setup_done boolean not null default false,
  add column daily_brief_enabled boolean not null default false,
  add column daily_brief_hour integer not null default 7 check (daily_brief_hour between 0 and 23),
  add column daily_brief_sent_on date;

-- Platform-managed columns: signed-in users can't change these; the server (service role) and
-- security-definer functions that set the jetlemon.allow_protected flag can.
create or replace function public.protect_org_columns()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'authenticated'
     and coalesce(current_setting('jetlemon.allow_protected', true), '') <> 'on' then
    new.trial_ends_at := old.trial_ends_at;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.subscription_status := old.subscription_status;
    new.created_at := old.created_at;
    new.inbound_token := old.inbound_token;
    new.sms_number := old.sms_number;
    new.texts_included := old.texts_included;
    new.text_block_size := old.text_block_size;
    new.text_block_price_cents := old.text_block_price_cents;
    new.daily_brief_sent_on := old.daily_brief_sent_on;
  end if;
  return new;
end;
$$;
create trigger organizations_protect before update on public.organizations
  for each row execute function public.protect_org_columns();

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
  perform set_config('jetlemon.allow_protected', 'on', true);
  update organizations set inbound_token = new_token where id = target_org;
  return new_token;
end;
$$;

alter table public.jobs
  add column source text,        -- 'facebook' | 'website' | 'zapier' | 'import' | …
  add column source_ref text,    -- provider id (e.g. Facebook leadgen_id) used to ignore duplicates
  add column ai_summary text;    -- one line: what the lead wants + next step
create unique index jobs_source_ref_unique on public.jobs (org_id, source, source_ref)
  where source_ref is not null;

create table public.meta_pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  page_id text not null unique,
  page_name text not null,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now()
);
create index on public.meta_pages (org_id);
alter table public.meta_pages enable row level security;
create policy "members read pages" on public.meta_pages
  for select using (public.is_member(org_id));
create policy "owners disconnect pages" on public.meta_pages
  for delete using (public.is_owner(org_id));

create table public.meta_page_tokens (
  page_id text primary key references public.meta_pages(page_id) on delete cascade,
  access_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.meta_page_tokens enable row level security;   -- no policies: service role only

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text not null,
  from_number text not null,
  to_number text not null,
  provider_sid text,
  status text not null default 'sent',   -- sent | received | failed: … | blocked: …
  kind text not null default 'manual',   -- manual | auto_text | lead_alert
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.messages (customer_id, created_at);
create index on public.messages (org_id, created_at desc);
create index messages_out_month on public.messages (org_id, created_at) where direction = 'out' and status = 'sent';
alter table public.messages enable row level security;
create policy "members manage messages" on public.messages
  for all using (public.is_member(org_id)) with check (public.is_member(org_id));

create table public.text_blocks (
  org_id uuid not null references public.organizations(id) on delete cascade,
  month text not null,                          -- 'YYYY-MM' in the business's time zone
  blocks integer not null default 0,
  stripe_invoice_item_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (org_id, month)
);
alter table public.text_blocks enable row level security;
create policy "members read text blocks" on public.text_blocks
  for select using (public.is_member(org_id));

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  filename text not null,
  status text not null default 'mapping' check (status in ('mapping', 'done', 'failed')),
  sheets jsonb not null default '[]',
  mapping jsonb,
  summary jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.imports (org_id, created_at desc);
alter table public.imports enable row level security;
create policy "members manage imports" on public.imports
  for all using (public.is_member(org_id)) with check (public.is_member(org_id));
