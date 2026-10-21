export type Organization = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  trial_ends_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  plan: "starter" | "pro";
  inbound_token: string;
  sms_number: string | null;
  notify_phone: string | null;
  auto_text_enabled: boolean;
  auto_text_template: string;
  texts_included: number;
  text_block_size: number;
  text_block_price_cents: number;
  text_block_limit: number;
  texting_paused: boolean;
  services: string | null;
  service_area: string | null;
  hours: string | null;
  website: string | null;
  lead_form_intro: string | null;
  invoice_footer: string | null;
  setup_done: boolean;
  daily_brief_enabled: boolean;
  daily_brief_hour: number;
  daily_brief_sent_on: string | null;
  review_url: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  pay_online: boolean;
};

export type MetaPage = { id: string; org_id: string; page_id: string; page_name: string; connected_at: string };

export type Message = {
  id: string;
  org_id: string;
  customer_id: string | null;
  direction: "in" | "out";
  channel: "sms" | "email";
  body: string;
  from_number: string;
  to_number: string;
  status: string;
  kind: string;
  created_at: string;
};

export type Customer = {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tags: string[];
  notes: string | null;
  text_opt_out: boolean;
  email_opt_out: boolean;
  created_at: string;
};

export const JOB_STATUSES = ["lead", "scheduled", "in_progress", "completed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type Job = {
  id: string;
  org_id: string;
  customer_id: string | null;
  title: string;
  description: string | null;
  status: JobStatus;
  scheduled_at: string | null;
  duration_minutes: number;
  address: string | null;
  price: number;
  assigned_to: string | null;
  source: string | null;
  source_ref: string | null;
  ai_summary: string | null;
  created_at: string;
  customers?: { id: string; name: string } | null;
};

export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type Invoice = {
  id: string;
  org_id: string;
  customer_id: string | null;
  job_id: string | null;
  number: number;
  status: InvoiceStatus;
  issued_on: string;
  due_on: string;
  paid_on: string | null;
  notes: string | null;
  pay_token: string;
  stripe_checkout_session_id: string | null;
  paid_via: string | null;
  created_at: string;
  customers?: { id: string; name: string; email: string | null; address: string | null } | null;
  invoice_items?: { quantity: number; unit_price: number }[];
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

export type Member = { user_id: string; email: string; role: string; created_at: string };

export const PROPOSAL_STATUSES = ["draft", "sent", "accepted", "declined", "expired"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type Proposal = {
  id: string;
  org_id: string;
  customer_id: string | null;
  job_id: string | null;
  invoice_id: string | null;
  number: number;
  status: ProposalStatus;
  title: string;
  intro: string | null;
  terms: string | null;
  valid_until: string | null;
  deposit_percent: number;
  pay_token: string;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_name: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  stripe_checkout_session_id: string | null;
  deposit_paid_on: string | null;
  created_at: string;
  customers?: { id: string; name: string; email: string | null; phone: string | null; address: string | null } | null;
  proposal_items?: ProposalItem[];
};

export type ProposalItem = {
  id: string;
  proposal_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  optional: boolean;
  selected: boolean;
  created_at: string;
};
