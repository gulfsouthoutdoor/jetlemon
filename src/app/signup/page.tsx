import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { signup } from "../login/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell
      title="Start your 14-day free trial"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
          <br />
          <span className="text-xs">
            By signing up you agree to the{" "}
            <Link href="/terms" className="underline hover:text-slate-700">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-slate-700">
              privacy policy
            </Link>
            .
          </span>
        </>
      }
    >
      <form action={signup} className="space-y-4">
        <ErrorNote message={error} />
        <Field label="Work email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Button className="w-full">Create account</Button>
        <p className="text-xs text-slate-500">No credit card required.</p>
      </form>
    </AuthShell>
  );
}
