import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ErrorNote, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { sendReset } from "@/app/login/actions";

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams;
  return (
    <AuthShell
      title="Reset your password"
      footer={
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">If that email has an account, a reset link is on its way. Check your inbox (and spam).</p>
      ) : (
        <form action={sendReset} className="space-y-4">
          <ErrorNote message={error} />
          <p className="text-sm text-slate-600">Enter your email and we&apos;ll send you a link to set a new password.</p>
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Sending…">
            Send reset link
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
