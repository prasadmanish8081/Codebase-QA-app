import { NextResponse } from "next/server";
import { clearQAs, getQAs } from "@/lib/db";

export async function GET() {
  try {
    const qas = await getQAs();
    return NextResponse.json({
      items: qas,
      count: qas.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load history" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearQAs();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear history" },
      { status: 500 }
    );
  }
}
