-- JetLemon — AI assist: smart import, setup conversation, lead summaries, daily brief.

-- ───────────────────────── Business profile (filled by the setup conversation) ─────────────────────────

alter table public.organizations
  add column services text,            -- "Residential and office cleaning, move-out deep cleans"
  add column service_area text,        -- "Shelby County and south Birmingham"
  add column hours text,               -- "Mon–Fri 8–5, Sat by appointment"
  add column website text,
  add column lead_form_intro text,     -- shown on the hosted lead form
  add column invoice_footer text,      -- printed at the bottom of every invoice
  add column setup_done boolean not null default false,
  add column daily_brief_enabled boolean not null default false,
  add column daily_brief_hour integer not null default 7 check (daily_brief_hour between 0 and 23),
  add column daily_brief_sent_on date;  -- last local date a brief went out (stops double sends)

grant update (services, service_area, hours, website, lead_form_intro, invoice_footer, setup_done, daily_brief_enabled, daily_brief_hour)
  on public.organizations to authenticated;

-- ───────────────────────── Lead summaries ─────────────────────────

alter table public.jobs add column ai_summary text;   -- one line: what the lead wants + suggested next step

-- ───────────────────────── Imports ─────────────────────────

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  filename text not null,
  status text not null default 'mapping' check (status in ('mapping', 'done', 'failed')),
  sheets jsonb not null default '[]',   -- [{name, headers:[...], rows:[[...]]}] (rows capped)
  mapping jsonb,                        -- AI/user column mapping, see src/lib/import.ts
  summary jsonb,                        -- {customers_added, customers_updated, jobs_added, skipped:[...]}
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.imports (org_id, created_at desc);
alter table public.imports enable row level security;
create policy "members manage imports" on public.imports
  for all using (public.is_member(org_id)) with check (public.is_member(org_id));
