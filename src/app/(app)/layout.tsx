import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getContext, hasActiveAccess } from "@/lib/org";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { org, user } = await getContext();
  if (!hasActiveAccess(org)) redirect("/billing");
  return (
    <AppShell org={org} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
