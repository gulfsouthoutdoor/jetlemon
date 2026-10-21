"use server";

import { redirect } from "next/navigation";
import { createInvoiceCheckout } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

/** Customer pressed "Pay by card": open Stripe Checkout on the business's own account. */
export async function payInvoice(token: string) {
  const admin = createAdminClient();
  const { data } = await admin.rpc("invoice_by_pay_token", { token });
  const inv = (data as { id: string; org_id: string; number: number; status: string; customer_email: string | null; items: { description: string; quantity: number; unit_price: number }[]; pay_online: boolean; charges_enabled: boolean }[] | null)?.[0];
  if (!inv || inv.status !== "sent" || !inv.pay_online || !inv.charges_enabled) redirect(`/pay/${token}`);
  const { data: org } = await admin.from("organizations").select("id, name, stripe_account_id").eq("id", inv.org_id).single();
  if (!org) redirect(`/pay/${token}`);
  let url: string;
  try {
    url = await createInvoiceCheckout(admin, org, inv, token);
  } catch (err) {
    redirect(`/pay/${token}?error=${encodeURIComponent((err as Error).message)}`);
  }
  redirect(url);
}
