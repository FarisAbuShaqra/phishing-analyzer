import type { Report } from "./types";

/**
 * Phase 3 (AI explanation) — STUB.
 *
 * The deterministic engine produces the verdict. This optional layer only
 * EXPLAINS those facts in plain English; it never decides the score.
 *
 * Returns null when no API key is configured, so the app is fully functional
 * and demoable with no key set. No secrets are ever exposed to the client —
 * this runs server-side only, from within the /api/analyze route.
 */
export async function explain(
  report: Report,
  rawContent: string,
): Promise<string | null> {
  const hasKey =
    !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasKey) return null;

  // TODO (Phase 3): send rawContent + report.signals to the LLM and return a
  // plain-English explanation that (a) summarizes the concrete evidence,
  // (b) explicitly notes where signals conflict or are inconclusive, and
  // (c) restates the recommended action. The model must be instructed that it
  // is explaining, not deciding — report.riskScore/riskCategory are authoritative.
  void report;
  void rawContent;
  return null;
}
