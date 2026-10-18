"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { str } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/types";

export async function createInvoice(fd: FormData) {
  const { supabase, org } = await getContext();
  const { data, error } = await supabase
    .from("invoices")
    .insert({ org_id: org.id, customer_id: str(fd, "customer_id") })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/invoices/${data.id}`);
}

export async function updateInvoice(id: string, fd: FormData) {
  const { supabase } = await getContext();
  const { error } = await supabase
    .from("invoices")
    .update({
      customer_id: str(fd, "customer_id"),
      issued_on: str(fd, "issued_on"),
      due_on: str(fd, "due_on"),
      notes: str(fd, "notes"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/invoices/${id}`);
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus) {
  const { supabase } = await getContext();
  await supabase
    .from("invoices")
    .update({ status, paid_on: status === "paid" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
}

export async function addItem(invoiceId: string, fd: FormData) {
  const { supabase, org } = await getContext();
  const description = str(fd, "description");
  if (!description) return;
  const { error } = await supabase.from("invoice_items").insert({
    org_id: org.id,
    invoice_id: invoiceId,
    description,
    quantity: Number(str(fd, "quantity") ?? 1),
    unit_price: Number(str(fd, "unit_price") ?? 0),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function removeItem(invoiceId: string, itemId: string) {
  const { supabase } = await getContext();
  await supabase.from("invoice_items").delete().eq("id", itemId);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function deleteInvoice(id: string) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
  redirect("/invoices");
}
