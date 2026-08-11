import { NextResponse } from "next/server";
import { getStatusSummary } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await getStatusSummary();
  return NextResponse.json(summary);
}
