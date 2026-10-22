"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiConfigured, askJson } from "@/lib/ai";
import { str } from "@/lib/format";
import { getContext } from "@/lib/org";
import { DEFAULT_STEPS } from "@/lib/sequences";

export type Draft = {
  services: string;
  service_area: string;
  hours: string;
  phone: string;
  address: string;
  auto_text_template: string;
  lead_form_intro: string;
  invoice_footer: string;
  tags: string[];
  note: string;
};

/** Pulls readable text from the business's website, if they gave one. Best effort, never fatal. */
async function siteText(url: string | null): Promise<string> {
  if (!url) return "";
  try {
    const full = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(full, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "JetLemonSetup/1.0" } });
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 6000);
  } catch {
    return "";
  }
}

/** Step 1: answers → AI drafts the profile. Draft is passed to step 2 through the URL (small) or saved straight if AI is off. */
export async function draftProfile(fd: FormData) {
  const { org } = await getContext();
  const answers = {
    what: str(fd, "what") ?? "",
    where: str(fd, "where") ?? "",
    hours: str(fd, "hours") ?? "",
    website: str(fd, "website"),
  };
  const site = await siteText(answers.website);

  let draft: Draft = {
    services: answers.what,
    service_area: answers.where,
    hours: answers.hours,
    phone: org.phone ?? "",
    address: org.address ?? "",
    auto_text_template: org.auto_text_template,
    lead_form_intro: `Tell us what you need and ${org.name} will get right back to you.`,
    invoice_footer: `Thank you for choosing ${org.name}.`,
    tags: [],
    note: "",
  };

  if (aiConfigured()) {
    const system = `You set up a CRM for a small business from a few plain answers (and their website text, if any). Write like a friendly local business owner, not a marketer. No emojis, no hype, no exclamation points.
Return JSON: {"services": one sentence of what they do, "service_area": short, "hours": short, "phone": "" unless found on the site, "address": "" unless found on the site,
"auto_text_template": the first text a new lead gets, under 160 characters, must include {first_name} and {business}, must end by asking when is a good time to call,
"lead_form_intro": one sentence shown above their lead form, "invoice_footer": one short line for the bottom of invoices (thanks + how to pay if the site says),
"tags": 3-6 short lowercase tags they could use for customers (e.g. "weekly", "commercial"), "note": one sentence to the owner about anything you guessed or couldn't find}`;
    try {
      const ai = await askJson<Partial<Draft>>(system, JSON.stringify({ business: org.name, answers, website_text: site || undefined }), 1200);
      draft = { ...draft, ...ai, tags: Array.isArray(ai.tags) ? ai.tags.map(String).slice(0, 8) : [] };
      if (!draft.auto_text_template.includes("{first_name}")) draft.auto_text_template = `Hi {first_name}, this is {business}. We got your request — when is a good time to call you?`;
    } catch (err) {
      draft.note = `AI could not draft this (${(err as Error).message}); fill in what you can.`;
    }
  }

  const encoded = Buffer.from(JSON.stringify(draft)).toString("base64url");
  redirect(`/setup?draft=${encoded}`);
}

/** Step 2: save what the owner approved. */
export async function saveProfile(fd: FormData) {
  const { supabase, org } = await getContext();
  const { error } = await supabase
    .from("organizations")
    .update({
      services: str(fd, "services"),
      service_area: str(fd, "service_area"),
      hours: str(fd, "hours"),
      website: str(fd, "website"),
      phone: str(fd, "phone") ?? org.phone,
      address: str(fd, "address") ?? org.address,
      auto_text_template: str(fd, "auto_text_template") ?? org.auto_text_template,
      lead_form_intro: str(fd, "lead_form_intro"),
      invoice_footer: str(fd, "invoice_footer"),
      setup_done: true,
    })
    .eq("id", org.id);
  if (error) redirect(`/setup?error=${encodeURIComponent(error.message)}`);

  // The instant text becomes day 0 of the "New lead" follow-up (unless the owner already customized it).
  const firstText = str(fd, "auto_text_template");
  if (firstText) {
    const { data: existing } = await supabase.from("sequences").select("id").eq("org_id", org.id).eq("key", "new_lead").maybeSingle();
    if (!existing) {
      const steps = DEFAULT_STEPS.new_lead.map((st, i) => (i === 0 ? { ...st, body: firstText } : st));
      await supabase.from("sequences").insert({ org_id: org.id, key: "new_lead", enabled: true, steps });
    }
  }
  revalidatePath("/", "layout");
  redirect(fd.get("next") === "import" ? "/import" : "/dashboard?welcome=1");
}

export async function skipSetup() {
  const { supabase, org } = await getContext();
  await supabase.from("organizations").update({ setup_done: true }).eq("id", org.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
