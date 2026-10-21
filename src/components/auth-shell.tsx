import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <Wordmark className="h-10" />
        </Link>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-5 text-lg font-semibold text-slate-900">{title}</h1>
          {children}
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">{footer}</p>
      </div>
    </main>
  );
}

/** The lemon-and-jet mark on its own. */
export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="" className={`${className} shrink-0 object-contain`} />;
}

/** Mark plus the JetLemon name. */
export function Wordmark({ className = "h-8" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/wordmark.png" alt="JetLemon" className={`${className} w-auto object-contain`} />;
}
