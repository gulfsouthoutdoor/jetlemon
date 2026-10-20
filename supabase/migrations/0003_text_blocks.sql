-- JetLemon — texting allowance, overage blocks (auto-billed), spending cap, and pause.

alter table public.organizations
  add column texts_included integer not null default 500,        -- texts per month in the plan
  add column text_block_size integer not null default 250,       -- texts per overage block
  add column text_block_price_cents integer not null default 1000, -- $10 per block
  add column text_block_limit integer not null default 2,        -- max extra blocks per month; 0 = never buy blocks
  add column texting_paused boolean not null default false;

-- Owners control the cap and the pause switch; the plan's allowance and block price are set by the platform.
grant update (text_block_limit, texting_paused) on public.organizations to authenticated;

-- One row per business per month: how many extra blocks were bought and billed.
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

-- Outbound texts sent this month, counted the same way billing counts them.
create index messages_out_month on public.messages (org_id, created_at) where direction = 'out' and status = 'sent';
