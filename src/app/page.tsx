import Link from "next/link";
import { Wordmark } from "@/components/auth-shell";
import { ButtonLink } from "@/components/ui";
import { PLANS } from "@/lib/stripe";

const features = [
  { title: "Every customer, one place", body: "Contact info, addresses, notes, every text and email, every job and invoice — all on one page." },
  { title: "Leads that never go cold", body: "Leads from your website and Facebook land in JetLemon and get a text and an email in seconds, then follow-ups until they answer." },
  { title: "Proposals they accept on their phone", body: "Send a priced proposal with optional add-ons. They tick what they want, type their name, pay the deposit." },
  { title: "Schedule and jobs", body: "A weekly calendar of the work. Move it from lead → scheduled → done with one click." },
  { title: "Get paid faster", body: "Every invoice has a pay-by-card link. Automatic reminders chase the unpaid ones so you don't have to." },
  { title: "Built for small teams", body: "Invite your people, assign work, and keep everyone on the same page. No per-seat fees." },
];

export default function LandingPage() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center">
          <Wordmark className="h-9" />
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
          <ButtonLink href="/signup">Start free trial</ButtonLink>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <p className="mb-4 inline-block rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">Built for small business</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">The simple CRM for small business</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Leads, customers, proposals, scheduling, invoices and follow-ups — in one place, without the 40-item menu. Stop juggling spreadsheets, texts and sticky notes.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/signup" className="px-5 py-3 text-base">
            Start your 14-day free trial
          </ButtonLink>
        </div>
        <p className="mt-3 text-sm text-slate-500">No credit card required.</p>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Two plans. No add-on menu.</h2>
        <p className="mt-2 text-slate-600">Unlimited users on both. Cancel anytime.</p>
        <div className="mt-8 grid gap-6 text-left sm:grid-cols-2">
          {(["starter", "pro"] as const).map((key) => {
            const p = PLANS[key];
            return (
              <div key={key} className={`rounded-xl border p-8 shadow-sm ${key === "pro" ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"}`}>
                <p className={`text-sm font-semibold ${key === "pro" ? "text-indigo-600" : "text-slate-700"}`}>{p.name}</p>
                <p className="mt-1 text-5xl font-bold text-slate-900">
                  ${p.price}
                  <span className="text-lg font-normal text-slate-500">/month</span>
                </p>
                <p className="mt-2 text-slate-600">{p.blurb}</p>
                <ul className="mt-5 space-y-1.5 text-sm text-slate-600">
                  {p.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                <ButtonLink href="/signup" variant={key === "pro" ? "primary" : "secondary"} className="mt-6 w-full py-3">
                  Try it free for 14 days
                </ButtonLink>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-slate-500">Every trial includes Pro. No credit card required.</p>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} JetLemon ·{" "}
        <Link href="/privacy" className="hover:text-slate-900">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="hover:text-slate-900">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/sms-terms" className="hover:text-slate-900">
          Texting
        </Link>
      </footer>
    </div>
  );
}
