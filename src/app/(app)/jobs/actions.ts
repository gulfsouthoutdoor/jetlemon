"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { fromLocalInput, str } from "@/lib/format";
import { JOB_STATUSES, type JobStatus, type Organization } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { enroll, stopRuns } from "@/lib/sequences";

/** Keeps follow-up sequences in step with the job's status. Membership was already checked by getContext. */
async function syncFollowUps(org: Organization, jobId: string) {
  const admin = createAdminClient();
  const { data: job } = await admin.from("jobs").select("status, customer_id").eq("id", jobId).eq("org_id", org.id).maybeSingle();
  if (!job) return;
  if (job.status === "lead") await enroll(admin, org, "new_lead", { customerId: job.customer_id, jobId });
  else await stopRuns(admin, { jobId, key: "new_lead" }, `job moved to ${job.status.replace("_", " ")}`);
  if (job.status === "completed") await enroll(admin, org, "after_job", { customerId: job.customer_id, jobId });
  if (job.status === "cancelled") await stopRuns(admin, { jobId }, "job cancelled");
}

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
  await syncFollowUps(org, data.id);
  revalidatePath("/jobs");
  redirect(`/jobs/${data.id}`);
}

export async function updateJob(id: string, fd: FormData) {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("jobs").update(await jobFields(fd)).eq("id", id);
  if (error) throw new Error(error.message);
  await syncFollowUps(org, id);
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
}

export async function setJobStatus(id: string, status: JobStatus) {
  const { supabase, org } = await getContext();
  await supabase.from("jobs").update({ status }).eq("id", id);
  await syncFollowUps(org, id);
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
}

/** Stops one follow-up run by hand. */
export async function stopFollowUp(runId: string, jobId: string) {
  const { supabase } = await getContext();
  await supabase.from("sequence_runs").update({ status: "stopped", stop_reason: "stopped by you", next_at: null, updated_at: new Date().toISOString() }).eq("id", runId);
  revalidatePath(`/jobs/${jobId}`);
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
