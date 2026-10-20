"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { str } from "@/lib/format";
import { normalizePhone } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBusinessText } from "@/lib/texting";

function customerFields(fd: FormData) {
  return {
    name: str(fd, "name") ?? "Unnamed customer",
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    notes: str(fd, "notes"),
    tags: (str(fd, "tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

export async function createCustomer(fd: FormData) {
  const { supabase, org } = await getContext();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...customerFields(fd), org_id: org.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(id: string, fd: FormData) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("customers").update(customerFields(fd)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/customers");
  redirect("/customers");
}

export async function addNote(customerId: string, fd: FormData) {
  const { supabase, org, user } = await getContext();
  const body = str(fd, "body");
  if (!body) return;
  const { error } = await supabase.from("notes").insert({ org_id: org.id, customer_id: customerId, body, author_id: user.id });
  if (error) throw new Error(error.message);
  revalidatePath(`/customers/${customerId}`);
}

export async function sendText(customerId: string, fd: FormData) {
  const { supabase, org, user } = await getContext();
  const body = str(fd, "body");
  if (!body) return;
  const fail = (msg: string) => redirect(`/customers/${customerId}?error=${encodeURIComponent(msg)}`);
  if (!org.sms_number) fail("Your business has no texting number yet.");
  const { data: customer } = await supabase.from("customers").select("phone").eq("id", customerId).eq("org_id", org.id).single();
  const to = normalizePhone(customer?.phone);
  if (!to) fail("Add a phone number with area code first.");

  const result = await sendBusinessText(createAdminClient(), org, { to: to!, body, customerId, kind: "manual", sentBy: user.id });
  revalidatePath(`/customers/${customerId}`);
  if (!result.ok) fail(result.reason ?? "Text not sent.");
}

export async function deleteNote(customerId: string, noteId: string) {
  const { supabase } = await getContext();
  await supabase.from("notes").delete().eq("id", noteId);
  revalidatePath(`/customers/${customerId}`);
}
