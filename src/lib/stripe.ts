import Stripe from "stripe";
import type { Organization } from "@/lib/types";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");

export type PlanKey = "starter" | "pro";

export const PLANS: Record<PlanKey, { key: PlanKey; name: string; price: number; priceId: string; blurb: string; features: string[] }> = {
  starter: {
    key: "starter",
    name: "Starter",
    price: Number(process.env.NEXT_PUBLIC_PLAN_PRICE ?? 29),
    priceId: process.env.STRIPE_PRICE_ID ?? "",
    blurb: "Everything you need to run the office.",
    features: [
      "Unlimited customers, jobs and invoices",
      "Weekly schedule",
      "Lead address, hosted lead form and Facebook lead ads",
      "Smart import from any spreadsheet",
      "AI setup, lead summaries and reply drafts",
      "Unlimited team members",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    price: Number(process.env.NEXT_PUBLIC_PRO_PRICE ?? 49),
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    blurb: "Starter plus texting, so leads hear back in seconds.",
    features: [
      "Everything in Starter",
      "Your own texting number",
      "Automatic text to every new lead",
      "Two-way texting from the customer page",
      "New-lead alerts and a daily rundown to your phone",
      "500 texts a month included, then $10 per 250",
    ],
  },
};

/** Which plan a Stripe price belongs to. */
export function planForPrice(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  if (priceId === PLANS.pro.priceId) return "pro";
  if (priceId === PLANS.starter.priceId) return "starter";
  return null;
}

/** Trials get the full product so people can try texting; after that the paid plan decides. */
export function effectivePlan(org: Pick<Organization, "plan" | "subscription_status">): PlanKey {
  if (org.subscription_status === "trialing") return "pro";
  return org.plan === "pro" ? "pro" : "starter";
}

/** Active with no Stripe subscription behind it = an account JetLemon gave away (the owner's own, a partner, a friend). */
export const isComplimentary = (org: Pick<Organization, "subscription_status" | "stripe_subscription_id">) =>
  org.subscription_status === "active" && !org.stripe_subscription_id;

export const hasTexting = (org: Pick<Organization, "plan" | "subscription_status">) => effectivePlan(org) === "pro";

/** Kept for older imports. */
export const PLAN = PLANS.starter;
