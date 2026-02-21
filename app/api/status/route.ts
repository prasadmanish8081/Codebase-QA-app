import { NextResponse } from "next/server";
import { healthDb } from "@/lib/db";
import { llmHealthCheck } from "@/lib/llm";

export async function GET() {
  const db = await healthDb();
  const llm = await llmHealthCheck();

  return NextResponse.json({
    backend: { ok: true, detail: "API routes reachable" },
    database: db,
    llm,
    checkedAt: new Date().toISOString()
  });
}
