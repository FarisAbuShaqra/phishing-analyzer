import type { ParsedInput, Signal } from "../types";
import { BRANDS } from "./brands";
import { registrableDomain } from "./extract";

interface Pattern {
  re: RegExp;
  describe: (m: string) => string;
}

const URGENCY_PATTERNS: Pattern[] = [
  { re: /account (?:has been )?(?:suspended|locked|disabled|limited|restricted)/i, describe: (m) => `"${m}"` },
  { re: /verify (?:your account|your identity|within \d+\s*(?:hours?|hrs?))/i, describe: (m) => `"${m}"` },
  { re: /unusual (?:activity|sign-?in|login) (?:detected|noticed)/i, describe: (m) => `"${m}"` },
  { re: /immediate(?:ly)? (?:action|attention) (?:required|needed)/i, describe: (m) => `"${m}"` },
  { re: /within \d+\s*(?:hours?|hrs?|minutes?)/i, describe: (m) => `"${m}"` },
  { re: /(?:your )?(?:account|access) will be (?:closed|terminated|deleted|suspended)/i, describe: (m) => `"${m}"` },
  { re: /failure to (?:respond|act|verify|comply)/i, describe: (m) => `"${m}"` },
  { re: /final (?:notice|warning|reminder)/i, describe: (m) => `"${m}"` },
];

const CREDENTIAL_PATTERNS: Pattern[] = [
  { re: /\b(?:enter|confirm|update|provide|verify)\b[^.\n]{0,40}\b(?:password|pin|login credentials?)\b/i, describe: (m) => `"${m.trim()}"` },
  { re: /\b(?:one[- ]?time (?:password|code|pin)|otp|2fa|two[- ]?factor|verification code|security code)\b/i, describe: (m) => `asks for a code: "${m.trim()}"` },
  { re: /\b(?:gift ?cards?|google play|steam|itunes)\b[^.\n]{0,40}\b(?:code|card|purchase|buy)\b/i, describe: (m) => `gift-card request: "${m.trim()}"` },
  { re: /\b(?:wire transfer|bank transfer|routing number|account number|iban|swift)\b/i, describe: (m) => `bank-detail request: "${m.trim()}"` },
  { re: /\b(?:bitcoin|btc|ethereum|eth|usdt|crypto(?:currency)?\s*wallet|seed phrase)\b/i, describe: (m) => `crypto request: "${m.trim()}"` },
  { re: /\b(?:credit ?card|cvv|card number|expiry date)\b/i, describe: (m) => `payment-card request: "${m.trim()}"` },
];

const GENERIC_GREETING_RE =
  /\b(?:dear|hello|hi|greetings)\s+(?:valued\s+)?(?:customer|user|member|client|account holder|sir\/madam|sir or madam)\b/i;

function collectMatches(body: string, patterns: Pattern[]): string[] {
  const out: string[] = [];
  for (const p of patterns) {
    const m = body.match(p.re);
    if (m) out.push(p.describe(m[0]));
  }
  return out;
}

export function urgencyCheck(input: ParsedInput): Signal {
  const base = {
    id: "urgency-threat",
    label: "Urgency / threat language",
    severity: "medium",
    why: "Pressure and deadlines are used to rush you past your better judgement.",
  } as const;

  const hits = collectMatches(input.body, URGENCY_PATTERNS);
  if (hits.length === 0) {
    return { ...base, triggered: false, evidence: "No urgency or threat phrasing found." };
  }
  return { ...base, triggered: true, evidence: hits.join("; ") };
}

export function credentialAskCheck(input: ParsedInput): Signal {
  const base = {
    id: "credential-payment-ask",
    label: "Credential or payment request",
    severity: "high",
    why: "Legitimate providers do not ask you to send passwords, one-time codes, gift cards, or bank/crypto details over email or chat.",
  } as const;

  const hits = collectMatches(input.body, CREDENTIAL_PATTERNS);
  if (hits.length === 0) {
    return { ...base, triggered: false, evidence: "No request for passwords, codes, or payment details." };
  }
  return { ...base, triggered: true, evidence: hits.join("; ") };
}

export function genericGreetingCheck(input: ParsedInput): Signal {
  const base = {
    id: "generic-greeting",
    label: "Generic greeting",
    severity: "low",
    why: "Mass phishing rarely knows your name, so it falls back to impersonal greetings.",
  } as const;

  const m = input.body.match(GENERIC_GREETING_RE);
  if (!m) {
    return { ...base, triggered: false, evidence: "No generic mass-mailing greeting detected." };
  }
  return { ...base, triggered: true, evidence: `"${m[0]}"` };
}

export function senderMismatchCheck(input: ParsedInput): Signal {
  const base = {
    id: "sender-mismatch",
    label: "Sender name vs. address mismatch",
    severity: "high",
    why: "A display name impersonating a brand while the real address is unrelated is a direct sign of spoofing.",
  } as const;

  const { senderDisplayName, senderDomain, senderAddress } = input;
  if (!senderDisplayName || !senderDomain) {
    return {
      ...base,
      triggered: false,
      evidence: senderAddress
        ? `Sender ${senderAddress} has no brand-impersonating display name.`
        : "No sender header to evaluate.",
    };
  }

  const nameLower = senderDisplayName.toLowerCase();
  const claimedBrand = BRANDS.find((b) => nameLower.includes(b));
  if (!claimedBrand) {
    return {
      ...base,
      triggered: false,
      evidence: `Display name "${senderDisplayName}" does not claim to be a known brand.`,
    };
  }

  const reg = registrableDomain(senderDomain);
  const domainLabel = reg.split(".")[0];
  // If the address domain actually belongs to the claimed brand, it's fine.
  if (domainLabel === claimedBrand || reg.includes(claimedBrand)) {
    return {
      ...base,
      triggered: false,
      evidence: `Display name "${senderDisplayName}" matches its domain "${reg}".`,
    };
  }

  return {
    ...base,
    triggered: true,
    evidence: `Display name claims "${claimedBrand}" but the address is ${senderAddress} (domain "${reg}")`,
  };
}
