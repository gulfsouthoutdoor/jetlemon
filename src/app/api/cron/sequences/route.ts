import { NextResponse, type NextRequest } from "next/server";
import { processDue } from "@/lib/sequences";
import { createAdminClient } from "@/lib/supabase/admin";

// Runs every hour (vercel.json). Sends every follow-up step that has come due.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processDue(createAdminClient(), { limit: 500 });
  return NextResponse.json(result);
}
