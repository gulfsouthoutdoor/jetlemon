import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/login/actions";
import { isAdminEmail } from "@/lib/admin";
import { Logo } from "./auth-shell";
import { NavLinks } from "./nav-links";
import type { Organization } from "@/lib/types";

export function AppShell({ org, email, children }: { org: Organization; email: string; children: ReactNode }) {
  const trialDaysLeft = Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86_400_000);
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="border-b border-slate-200 bg-white md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col md:border-b-0 md:border-r print:hidden">
        <div className="flex items-center gap-2 px-4 py-4">
          <Logo className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{org.name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
        </div>
        <div className="px-3 pb-3 md:flex-1">
          <NavLinks />
        </div>
        <div className="hidden space-y-2 border-t border-slate-100 p-4 md:block">
          {org.subscription_status === "trialing" && (
            <Link href="/billing" className="block rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 hover:bg-amber-100">
              {trialDaysLeft > 0 ? `${trialDaysLeft} days left in trial` : "Trial ended"} · <span className="font-medium">Upgrade</span>
            </Link>
          )}
          {isAdminEmail(email) && (
            <Link href="/admin" className="block text-sm font-medium text-slate-700 hover:text-slate-900">
              Admin
            </Link>
          )}
          <form action={logout}>
            <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:ml-60 md:px-8 md:py-8 print:m-0 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
