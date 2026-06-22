import Anthropic from "@anthropic-ai/sdk";
import type { Report } from "./types";

/**
 * Phase 3 — AI explanation layer.
 *
 * The deterministic engine produces the verdict. This optional layer only
 * EXPLAINS those facts in plain English; it never decides the score.
 *
 * Runs server-side only (called from the /api/analyze route). The key is read
 * from process.env and never reaches the client. Returns null when no API key
 * is configured, so the app stays fully functional and demoable with no key.
 *
 * Graceful degradation: any API error or timeout falls back to null — the
 * deterministic report still renders fully.
 */

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 600;
const TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT = `You are the explanation layer of an explainable phishing-triage tool.

A deterministic engine has already analyzed a message and produced an authoritative verdict (risk score and category) backed by concrete, named signals. Your ONLY job is to explain that result in plain English for a non-expert.

Rules:
- The deterministic verdict is final. You explain it; you do NOT re-decide it.
- Use ONLY the signals you are given. Do NOT invent new signals, evidence, or technical findings that are not in the provided data.
- Write 3 to 5 sentences, plain and concrete. No headings, no bullet lists, no markdown.
- Write in plain prose with a clear, professional tone. Do NOT use em-dashes or en-dashes; use commas, periods, or parentheses instead.
- (a) Synthesize WHY this verdict was reached, referencing the actual triggered evidence.
- (b) Explicitly note where the signals conflict or are inconclusive (e.g. authentication passed but the sender is a lookalike, or a check could not be completed). If nothing conflicts, say the signals are consistent.
- (c) End with one clear, actionable recommendation appropriate to the risk level.`;

function buildUserPrompt(report: Report, rawContent: string): string {
  const triggered = report.signals.filter((s) => s.triggered);
  const passed = report.signals.filter((s) => !s.triggered);

  const triggeredText =
    triggered.length > 0
      ? triggered
          .map((s) => `- [${s.severity}] ${s.label}: ${s.evidence}`)
          .join("\n")
      : "(none triggered)";

  const passedText =
    passed.length > 0
      ? passed.map((s) => `- ${s.label}`).join("\n")
      : "(none)";

  // Keep the raw content bounded so a huge paste can't blow up the request.
  const content = rawContent.slice(0, 8000);

  return `OVERALL VERDICT (authoritative — do not change):
Risk score: ${report.riskScore}/100
Risk category: ${report.riskCategory}
Recommended action: ${report.recommendedAction}

TRIGGERED SIGNALS (the reasons for the score):
${triggeredText}

CHECKS THAT PASSED (examined, not a problem):
${passedText}

ORIGINAL MESSAGE CONTENT:
"""
${content}
"""

Explain this verdict following your rules.`;
}

export async function explain(
  report: Report,
  rawContent: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(report, rawContent) }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return text.length > 0 ? text : null;
  } catch (err) {
    // Never let the AI layer break the request — the deterministic report stands.
    console.error("AI explanation failed:", err);
    return null;
  }
}
