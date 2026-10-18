"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { fromLocalInput, str } from "@/lib/format";
import { JOB_STATUSES, type JobStatus } from "@/lib/types";

async function jobFields(fd: FormData) {
  const { supabase, org } = await getContext();
  const customerId = str(fd, "customer_id");
  let address = str(fd, "address");
  // Default the job address to the customer's service address.
  if (!address && customerId) {
    const { data } = await supabase.from("customers").select("address").eq("id", customerId).maybeSingle();
    address = data?.address ?? null;
  }
  const status = str(fd, "status") as JobStatus | null;
  return {
    title: str(fd, "title") ?? "Untitled job",
    description: str(fd, "description"),
    customer_id: customerId,
    assigned_to: str(fd, "assigned_to"),
    status: status && JOB_STATUSES.includes(status) ? status : "scheduled",
    scheduled_at: fromLocalInput(str(fd, "scheduled_at"), org.timezone),
    duration_minutes: Number(str(fd, "duration_minutes") ?? 60),
    price: Number(str(fd, "price") ?? 0),
    address,
  };
}

export async function createJob(fd: FormData) {
  const { supabase, org } = await getContext();
  const { data, error } = await supabase
    .from("jobs")
    .insert({ ...(await jobFields(fd)), org_id: org.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/jobs");
  redirect(`/jobs/${data.id}`);
}

export async function updateJob(id: string, fd: FormData) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("jobs").update(await jobFields(fd)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
}

export async function setJobStatus(id: string, status: JobStatus) {
  const { supabase } = await getContext();
  await supabase.from("jobs").update({ status }).eq("id", id);
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
}

export async function deleteJob(id: string) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/jobs");
  redirect("/jobs");
}

/** Creates a draft invoice pre-filled from the job's title and price. */
export async function invoiceJob(id: string) {
  const { supabase, org } = await getContext();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) throw new Error("Job not found");
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({ org_id: org.id, customer_id: job.customer_id, job_id: job.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from("invoice_items")
    .insert({ org_id: org.id, invoice_id: invoice.id, description: job.title, quantity: 1, unit_price: job.price });
  redirect(`/invoices/${invoice.id}`);
}
