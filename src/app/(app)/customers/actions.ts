"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { str } from "@/lib/format";
import { normalizePhone, sendSms } from "@/lib/sms";

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
  if (!org.sms_number) redirect(`/customers/${customerId}?error=${encodeURIComponent("Your business has no texting number yet.")}`);
  const { data: customer } = await supabase.from("customers").select("phone").eq("id", customerId).single();
  const to = normalizePhone(customer?.phone);
  if (!to) redirect(`/customers/${customerId}?error=${encodeURIComponent("Add a phone number with area code first.")}`);

  let sid: string | null = null;
  let status = "sent";
  try {
    sid = await sendSms(org.sms_number, to, body);
  } catch (err) {
    status = `failed: ${(err as Error).message}`.slice(0, 200);
  }
  await supabase.from("messages").insert({
    org_id: org.id,
    customer_id: customerId,
    direction: "out",
    body,
    from_number: org.sms_number,
    to_number: to,
    provider_sid: sid,
    status,
    kind: "manual",
    sent_by: user.id,
  });
  revalidatePath(`/customers/${customerId}`);
  if (status !== "sent") redirect(`/customers/${customerId}?error=${encodeURIComponent("Text not sent — " + status.replace("failed: ", ""))}`);
}

export async function deleteNote(customerId: string, noteId: string) {
  const { supabase } = await getContext();
  await supabase.from("notes").delete().eq("id", noteId);
  revalidatePath(`/customers/${customerId}`);
}
