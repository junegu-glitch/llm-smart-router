import { NextResponse } from "next/server";
import { detectAllCLIs } from "@/lib/cli-provider";

/** Returns CLI mode status so the frontend can skip API key checks */
export async function GET() {
  const cliMode = process.env.USE_CLI === "true";

  if (!cliMode) {
    return NextResponse.json({ cliMode: false, providers: [] });
  }

  const statuses = await detectAllCLIs();
  const providers: string[] = [];

  for (const [, status] of Object.entries(statuses)) {
    if (status.installed) {
      providers.push(...status.config.servesProviders);
    }
  }

  return NextResponse.json({ cliMode: true, providers });
}
