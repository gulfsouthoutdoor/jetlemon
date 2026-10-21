import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./auth-shell";

/** The operator named on the legal pages. Set LEGAL_ENTITY / LEGAL_ADDRESS in Vercel once decided. */
export const LEGAL = {
  entity: process.env.LEGAL_ENTITY ?? "JetLemon",
  address: process.env.LEGAL_ADDRESS ?? "",
  email: process.env.LEGAL_EMAIL ?? "hello@jetlemon.com",
  updated: "October 21, 2026",
};

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center">
          <Wordmark className="h-8" />
        </Link>
        <nav className="flex gap-4 text-sm text-slate-500">
          <Link href="/privacy" className="hover:text-slate-900">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-slate-900">
            Terms
          </Link>
          <Link href="/sms-terms" className="hover:text-slate-900">
            Texting
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-6">
        <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Last updated {LEGAL.updated}</p>
        <div className="prose-sm mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
        <p className="mt-12 border-t border-slate-100 pt-6 text-sm text-slate-500">
          Questions: <a href={`mailto:${LEGAL.email}`} className="text-indigo-600 hover:underline">{LEGAL.email}</a>
          {LEGAL.address ? ` · ${LEGAL.entity}, ${LEGAL.address}` : ""}
        </p>
      </main>
    </div>
  );
}
