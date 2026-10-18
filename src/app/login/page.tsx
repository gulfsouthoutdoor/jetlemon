import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { error, message, next } = await searchParams;
  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
            Start a free trial
          </Link>
        </>
      }
    >
      <form action={login} className="space-y-4">
        {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        <ErrorNote message={error} />
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" required autoComplete="current-password" />
        </Field>
        <Button className="w-full">Sign in</Button>
      </form>
    </AuthShell>
  );
}
