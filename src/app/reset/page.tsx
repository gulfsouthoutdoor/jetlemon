import { AuthShell } from "@/components/auth-shell";
import { ErrorNote, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { setNewPassword } from "@/app/login/actions";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Choose a new password" footer={null}>
      <form action={setNewPassword} className="space-y-4">
        <ErrorNote message={error} />
        <Field label="New password">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label="Type it again">
          <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <SubmitButton className="w-full" pendingLabel="Saving…">
          Save password
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
