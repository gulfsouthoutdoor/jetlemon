import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getContext } from "@/lib/org";

// Same shell as the app, but without the subscription gate so expired accounts can pay.
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { org, user } = await getContext();
  return (
    <AppShell org={org} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
