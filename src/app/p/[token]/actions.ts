"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { str } from "@/lib/format";
import { createDepositCheckout, depositAmount, isExpired, recordAcceptance } from "@/lib/proposals";
import { stopRuns } from "@/lib/sequences";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProposalItem } from "@/lib/types";
import type { PublicProposal } from "./page";

async function load(token: string) {
  const admin = createAdminClient();
  const { data } = await admin.rpc("proposal_by_token", { token });
  return { admin, p: (data as PublicProposal[] | null)?.[0] };
}

export async function acceptProposal(token: string, fd: FormData) {
  const { admin, p } = await load(token);
  if (!p || p.status !== "sent" || isExpired(p)) redirect(`/p/${token}`);
  const name = str(fd, "name");
  if (!name || name.length < 2) redirect(`/p/${token}?error=${encodeURIComponent("Please type your full name to accept.")}`);
  const picked = fd.getAll("option").map(String);
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await recordAcceptance(admin, { ...p, customer_name: p.customer_name, pay_token: token }, name, ip, picked, p.items as unknown as ProposalItem[]);
  redirect(`/p/${token}`);
}

export async function declineProposal(token: string, fd: FormData) {
  const { admin, p } = await load(token);
  if (!p || p.status !== "sent") redirect(`/p/${token}`);
  await admin.from("proposals").update({ status: "declined", declined_at: new Date().toISOString(), decline_reason: str(fd, "reason") }).eq("id", p.id).eq("status", "sent");
  await stopRuns(admin, { proposalId: p.id }, "proposal declined");
  redirect(`/p/${token}`);
}

export async function payDeposit(token: string) {
  const { admin, p } = await load(token);
  if (!p || p.status !== "accepted" || p.deposit_paid_on || !p.charges_enabled || !p.pay_online) redirect(`/p/${token}`);
  const amount = depositAmount(p.items as unknown as ProposalItem[], p.deposit_percent);
  let url: string;
  try {
    url = await createDepositCheckout(admin, { id: p.org_id, name: p.business_name, stripe_account_id: p.stripe_account_id }, { ...p, pay_token: token }, amount);
  } catch (err) {
    redirect(`/p/${token}?error=${encodeURIComponent((err as Error).message)}`);
  }
  redirect(url);
}
