"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";
import { str } from "@/lib/format";
import { normalizePhone } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBusinessText } from "@/lib/texting";
import { aiConfigured, askJson, businessContext } from "@/lib/ai";
import { dateTime } from "@/lib/format";

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

export async function suggestReplies(customerId: string): Promise<{ suggestions: string[]; error?: string }> {
  const { supabase, org } = await getContext();
  if (!aiConfigured()) return { suggestions: [], error: "AI assist is not set up on this server." };
  const [{ data: customer }, { data: messages }, { data: jobs }] = await Promise.all([
    supabase.from("customers").select("name, address, tags, notes").eq("id", customerId).eq("org_id", org.id).single(),
    supabase.from("messages").select("direction, body, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(12),
    supabase.from("jobs").select("title, status, scheduled_at, price, description").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(5),
  ]);
  if (!customer) return { suggestions: [], error: "Customer not found." };
  const thread = (messages ?? []).reverse().map((m) => `${m.direction === "in" ? "Customer" : "Us"} (${dateTime(m.created_at, org.timezone)}): ${m.body}`).join("\n");
  const system = `You draft text-message replies for a small business owner to send to a customer. Sound like a real person who runs the business: short, warm, plain. 1-2 sentences each, under 240 characters, no emojis, no sign-offs. Never promise a price, date, or time the thread doesn't already support — offer to confirm instead. Give three different options: one quick, one that asks a clarifying question, one that moves toward booking.
${businessContext(org)}
Return JSON: {"suggestions": ["...", "...", "..."]}`;
  const user = `Customer: ${customer.name}${customer.address ? ", " + customer.address : ""}${customer.tags?.length ? " [" + customer.tags.join(", ") + "]" : ""}
${customer.notes ? "Notes: " + customer.notes + "\n" : ""}Recent jobs: ${(jobs ?? []).map((j) => `${j.title} (${j.status}${j.scheduled_at ? ", " + dateTime(j.scheduled_at, org.timezone) : ""})`).join("; ") || "none"}
Text thread (oldest first):
${thread || "(no texts yet — write an opener)"}`;
  try {
    const r = await askJson<{ suggestions: string[] }>(system, user, 600);
    return { suggestions: (r.suggestions ?? []).map(String).slice(0, 3) };
  } catch (err) {
    return { suggestions: [], error: (err as Error).message };
  }
}

export async function deleteNote(customerId: string, noteId: string) {
  const { supabase } = await getContext();
  await supabase.from("notes").delete().eq("id", noteId);
  revalidatePath(`/customers/${customerId}`);
}
