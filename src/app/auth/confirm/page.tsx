import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SubmitButton } from "@/components/submit-button";
import { confirmLink } from "./actions";

// Email links land here instead of being verified on open. Mail scanners (Microsoft, Gmail, etc.)
// open every link they see; a one-time token verified on open would already be spent by the time
// the person clicks. Nothing happens until the Continue button is pressed.
const COPY: Record<string, { title: string; body: string; button: string }> = {
  recovery: { title: "Reset your password", body: "Press the button to choose a new password.", button: "Continue" },
  signup: { title: "Confirm your email", body: "Press the button to finish creating your account.", button: "Confirm and continue" },
  invite: { title: "You're invited", body: "Press the button to accept the invitation.", button: "Accept invitation" },
  magiclink: { title: "Sign in", body: "Press the button to sign in.", button: "Sign in" },
  email_change: { title: "Confirm your new email", body: "Press the button to confirm the change.", button: "Confirm" },
};

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const { token_hash, type, next } = await searchParams;
  const copy = COPY[type ?? ""] ?? COPY.magiclink;
  const ok = Boolean(token_hash && type);
  return (
    <AuthShell
      title={copy.title}
      footer={
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {ok ? (
        <form action={confirmLink} className="space-y-4">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next ?? ""} />
          <p className="text-sm text-slate-600">{copy.body}</p>
          <SubmitButton className="w-full" pendingLabel="One moment…">
            {copy.button}
          </SubmitButton>
        </form>
      ) : (
        <p className="text-sm text-slate-600">This link is missing its code. Open the link from your email again, or request a new one.</p>
      )}
    </AuthShell>
  );
}
