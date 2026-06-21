import { NextResponse } from "next/server";
import { analyze } from "@/lib/analyze";
import { explain } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INPUT = 50_000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const content =
    typeof body === "object" && body !== null && "content" in body
      ? (body as { content: unknown }).content
      : undefined;

  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "Provide a non-empty 'content' string to analyze." },
      { status: 400 },
    );
  }

  const trimmed = content.slice(0, MAX_INPUT);

  try {
    const report = await analyze(trimmed);
    // Optional AI layer — returns null with no API key, never load-bearing.
    report.aiExplanation = await explain(report, trimmed);
    return NextResponse.json(report);
  } catch (err) {
    console.error("analyze failed:", err);
    return NextResponse.json(
      { error: "Analysis failed unexpectedly. Please try again." },
      { status: 500 },
    );
  }
}
