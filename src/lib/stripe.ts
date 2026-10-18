import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");

export const PLAN = {
  name: "Pro",
  price: Number(process.env.NEXT_PUBLIC_PLAN_PRICE ?? 29),
  priceId: process.env.STRIPE_PRICE_ID ?? "",
};
