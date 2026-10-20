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
  inbound_token: string;
  sms_number: string | null;
  notify_phone: string | null;
  auto_text_enabled: boolean;
  auto_text_template: string;
};

export type MetaPage = { id: string; org_id: string; page_id: string; page_name: string; connected_at: string };

export type Message = {
  id: string;
  org_id: string;
  customer_id: string | null;
  direction: "in" | "out";
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
