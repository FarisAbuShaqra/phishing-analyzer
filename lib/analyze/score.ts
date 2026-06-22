import type { Report, Severity, Signal } from "../types";

const WEIGHTS: Record<Severity, number> = {
  high: 30,
  medium: 15,
  low: 7,
  info: 0,
};

export function scoreSignals(signals: Signal[]): {
  riskScore: number;
  riskCategory: Report["riskCategory"];
} {
  const sum = signals
    .filter((s) => s.triggered)
    .reduce((acc, s) => acc + WEIGHTS[s.severity], 0);

  const riskScore = Math.min(100, sum);

  let riskCategory: Report["riskCategory"];
  if (riskScore <= 29) riskCategory = "Low";
  else if (riskScore <= 64) riskCategory = "Medium";
  else riskCategory = "High";

  return { riskScore, riskCategory };
}

export function recommendedAction(category: Report["riskCategory"]): string {
  switch (category) {
    case "Low":
      return "No strong phishing signals were found. This looks likely safe, but stay cautious. Never enter credentials unless you navigated to the site yourself.";
    case "Medium":
      return "Treat this as suspicious. Do not click any links or download attachments. Verify the sender through a known, independent channel (e.g. the official app or a number you already trust) before acting.";
    case "High":
      return "Do not interact with this message. Do not click links, open attachments, or reply. Report it to your IT/security team or the impersonated provider, then delete it.";
  }
}

export const DISCLAIMER =
  "This is an explainable triage and education tool, not a replacement for enterprise email security. The deterministic checks report verifiable facts; they cannot catch every phishing technique, and a Low score is not a guarantee of safety.";
