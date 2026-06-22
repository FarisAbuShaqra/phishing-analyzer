export type Severity = "info" | "low" | "medium" | "high";

export interface Signal {
  id: string;
  label: string; // e.g. "Lookalike domain"
  severity: Severity;
  triggered: boolean;
  evidence: string; // the concrete thing found, e.g. "paypa1.com (digit '1' for 'l')"
  why: string; // one sentence on why it matters
}

/** SPF / DKIM / DMARC results parsed from an Authentication-Results header. */
export interface AuthVerdict {
  spf?: string;
  dkim?: string;
  dmarc?: string;
  available: boolean; // false when no Authentication-Results header was present
}

export interface Report {
  riskScore: number; // 0–100
  riskCategory: "Low" | "Medium" | "High";
  signals: Signal[]; // include both triggered and key not-triggered checks
  extractedUrls: string[];
  senderDomain?: string;
  senderAddress?: string; // real From address when parsed from an .eml
  emailAuth?: AuthVerdict; // present only when an .eml was parsed
  aiExplanation: string | null; // null when no API key (Phase 3 stub)
  recommendedAction: string;
  disclaimer: string;
}

/** Header fields extracted from an uploaded .eml, fed into the engine. */
export interface ParsedHeaders {
  fromAddress?: string;
  fromName?: string;
  fromDomain?: string;
  replyToAddress?: string;
  replyToDomain?: string;
  returnPathAddress?: string;
  returnPathDomain?: string;
  /** All Authentication-Results header values (may be empty). */
  authResultsLines: string[];
}

/** Parsed view of the pasted content, shared by all signal checks. */
export interface ParsedInput {
  raw: string;
  body: string;
  urls: string[];
  /** domains extracted from URLs, lowercased, de-duplicated */
  domains: string[];
  /** markdown / HTML links: displayed text + the href it actually points to */
  links: Array<{ text: string; href: string }>;
  senderDisplayName?: string;
  senderAddress?: string;
  senderDomain?: string;
}
