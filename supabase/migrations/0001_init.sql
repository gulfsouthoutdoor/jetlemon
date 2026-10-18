-- ServiceDesk CRM — initial schema
-- Multi-tenant: every business row carries org_id, and RLS restricts access to org members.

create extension if not exists "pgcrypto";

-- ───────────────────────── Organizations & membership ─────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  timezone text not null default 'America/New_York',
  -- Billing
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
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

-- Helper used by every RLS policy. SECURITY DEFINER avoids recursive RLS on memberships.
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

-- Creates a business and makes the caller its owner.
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

-- Joins the caller to every org that invited their email address.
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
    select org_id, auth.uid(), 'member' from invitations where lower(email) = user_email
    on conflict do nothing;
  get diagnostics joined = row_count;
  delete from invitations where lower(email) = user_email;
  return joined;
end;
$$;

-- Lists teammates (with emails) for an org the caller belongs to.
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


-- ───────────────────────── Row-level security ─────────────────────────

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.notes enable row level security;

-- Organizations: members read; owners update profile fields. Billing columns are
-- only written by the Stripe webhook (service role), enforced by column grants below.
create policy "members read org" on public.organizations
  for select using (public.is_member(id));
create policy "owners update org" on public.organizations
  for update using (public.is_owner(id)) with check (public.is_owner(id));
revoke update on public.organizations from authenticated;
grant update (name, phone, email, address, timezone) on public.organizations to authenticated;

create policy "members read memberships" on public.memberships
  for select using (public.is_member(org_id));
create policy "owners remove members" on public.memberships
  for delete using (public.is_owner(org_id) and user_id <> auth.uid());

create policy "members read invitations" on public.invitations
  for select using (public.is_member(org_id));
create policy "owners create invitations" on public.invitations
  for insert with check (public.is_owner(org_id));
create policy "owners delete invitations" on public.invitations
  for delete using (public.is_owner(org_id));

-- Same "members have full access" policy for each business table.
do $$
declare t text;
begin
  foreach t in array array['customers', 'jobs', 'invoices', 'invoice_items', 'notes'] loop
    execute format(
      'create policy "members manage %1$s" on public.%1$I for all
         using (public.is_member(org_id)) with check (public.is_member(org_id))', t);
  end loop;
end $$;
