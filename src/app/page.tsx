import Link from "next/link";
import { Logo } from "@/components/auth-shell";
import { ButtonLink } from "@/components/ui";
import { PLANS } from "@/lib/stripe";

const features = [
  { title: "Customer database", body: "Every client's contact info, service address, gate codes and history in one place." },
  { title: "Drag-free scheduling", body: "A weekly calendar of every job. See who's booked, where, and when at a glance." },
  { title: "Job tracking", body: "Move work from lead → scheduled → in progress → completed with one click." },
  { title: "Invoices in seconds", body: "Turn a finished job into an invoice instantly. Print, PDF or email it to your customer." },
  { title: "Get paid faster", body: "Every invoice has a pay-by-card link. Automatic reminders chase the unpaid ones so you don't have to." },
  { title: "Built for teams", body: "Invite your crew, assign jobs, and keep everyone on the same page." },
];

export default function LandingPage() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Logo /> JetLemon
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
          <ButtonLink href="/signup">Start free trial</ButtonLink>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <p className="mb-4 inline-block rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">For cleaning, delivery & field service businesses</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">The simple CRM that runs your service business</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Customers, scheduling, jobs and invoicing — in one place. Stop juggling spreadsheets, texts and sticky notes.
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
