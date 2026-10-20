"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiConfigured } from "@/lib/ai";
import { parseUpload, proposeMapping, runImport, type Mapping, type Sheet } from "@/lib/import";
import { getContext } from "@/lib/org";

export async function uploadFile(fd: FormData) {
  const { supabase, org, user } = await getContext();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/import?error=Choose+a+file+first");
  if (file.size > 10 * 1024 * 1024) redirect("/import?error=That+file+is+over+10+MB");

  let sheets: Sheet[];
  try {
    sheets = parseUpload(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (err) {
    redirect(`/import?error=${encodeURIComponent("Could not read that file: " + (err as Error).message)}`);
  }
  if (!sheets.length) redirect("/import?error=No+rows+found+in+that+file");

  const mapping = await proposeMapping(sheets, aiConfigured());
  const { data, error } = await supabase
    .from("imports")
    .insert({ org_id: org.id, filename: file.name, sheets, mapping, created_by: user.id })
    .select("id")
    .single();
  if (error) redirect(`/import?error=${encodeURIComponent(error.message)}`);
  redirect(`/import/${data.id}`);
}

export async function confirmImport(id: string, fd: FormData) {
  const { supabase, org } = await getContext();
  const { data: imp } = await supabase.from("imports").select("*").eq("id", id).eq("org_id", org.id).single();
  if (!imp || imp.status !== "mapping") redirect("/import");

  // Apply the user's corrections from the review form.
  const mapping = imp.mapping as Mapping;
  for (const sm of mapping.sheets) {
    const kind = fd.get(`kind:${sm.sheet}`);
    if (kind === "customers" || kind === "jobs" || kind === "skip") sm.kind = kind;
    for (const h of Object.keys(sm.columns)) {
      const v = fd.get(`col:${sm.sheet}:${h}`);
      if (typeof v === "string" && v) sm.columns[h] = v;
    }
  }

  const summary = await runImport(supabase, org.id, imp.sheets as Sheet[], mapping, org.timezone);
  await supabase.from("imports").update({ mapping, summary, status: "done", sheets: [] }).eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/import/${id}`);
}

export async function discardImport(id: string) {
  const { supabase, org } = await getContext();
  await supabase.from("imports").delete().eq("id", id).eq("org_id", org.id);
  redirect("/import");
}
