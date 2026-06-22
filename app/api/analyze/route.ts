import { NextResponse } from "next/server";
import { simpleParser, type ParsedMail } from "mailparser";
import { analyze } from "@/lib/analyze";
import { explain } from "@/lib/ai";
import type { ParsedHeaders, Report } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INPUT = 50_000;
const MAX_EML_BYTES = 5_000_000; // 5 MB

function domainOf(addr?: string): string | undefined {
  if (!addr) return undefined;
  const at = addr.lastIndexOf("@");
  if (at < 0) return undefined;
  return addr
    .slice(at + 1)
    .toLowerCase()
    .replace(/[>\s]+$/, "")
    .trim();
}

function extractHeaders(parsed: ParsedMail): ParsedHeaders {
  const fromVal = parsed.from?.value?.[0];
  const replyVal = Array.isArray(parsed.replyTo)
    ? parsed.replyTo[0]?.value?.[0]
    : parsed.replyTo?.value?.[0];

  const returnPathRaw = parsed.headers.get("return-path");
  const returnPathAddr =
    typeof returnPathRaw === "string"
      ? returnPathRaw.replace(/[<>]/g, "").trim() || undefined
      : undefined;

  const authResultsLines = parsed.headerLines
    .filter((l) => l.key === "authentication-results")
    .map((l) => l.line.replace(/^authentication-results:/i, "").trim());

  const fromAddress = fromVal?.address?.toLowerCase();
  const replyToAddress = replyVal?.address?.toLowerCase();

  return {
    fromAddress,
    fromName: fromVal?.name || undefined,
    fromDomain: domainOf(fromAddress),
    replyToAddress,
    replyToDomain: domainOf(replyToAddress),
    returnPathAddress: returnPathAddr,
    returnPathDomain: domainOf(returnPathAddr),
    authResultsLines,
  };
}

async function handleEml(req: Request): Promise<Response> {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Upload a .eml file in the 'file' field." },
      { status: 400 },
    );
  }
  if (file.size > MAX_EML_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 5 MB)." },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const parsed = await simpleParser(buf);
  const headers = extractHeaders(parsed);

  // Run the existing engine over the message body (text + html), so all
  // language + URL checks apply unchanged; headers add the new signals.
  const body = [parsed.text, parsed.html].filter(Boolean).join("\n").slice(0, MAX_INPUT);

  const report: Report = await analyze(body, headers);
  report.aiExplanation = await explain(report, body);
  return NextResponse.json(report);
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  // --- .eml upload path ---
  if (contentType.includes("multipart/form-data")) {
    try {
      return await handleEml(req);
    } catch (err) {
      console.error("eml analyze failed:", err);
      return NextResponse.json(
        { error: "Could not parse that .eml file. Is it a valid email export?" },
        { status: 400 },
      );
    }
  }

  // --- paste-text path (unchanged) ---
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
