import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { TimezoneSelect } from "@/components/timezone-select";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/format";

async function createBusiness(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("create_organization", { org_name: str(formData, "name") ?? "My Business" });
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  const timezone = str(formData, "timezone");
  if (timezone) await supabase.from("organizations").update({ timezone }).eq("id", orgId);
  redirect("/dashboard");
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("accept_invitations");
  const { count } = await supabase.from("memberships").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  if (count) redirect("/dashboard");

  const { error } = await searchParams;
  return (
    <AuthShell title="Set up your business" footer="You can change these later in Settings.">
      <form action={createBusiness} className="space-y-4">
        <ErrorNote message={error} />
        <Field label="Business name">
          <Input name="name" required placeholder="e.g. Sparkle Cleaning Co." />
        </Field>
        <Field label="Time zone">
          <TimezoneSelect name="timezone" />
        </Field>
        <Button className="w-full">Continue</Button>
      </form>
    </AuthShell>
  );
}
