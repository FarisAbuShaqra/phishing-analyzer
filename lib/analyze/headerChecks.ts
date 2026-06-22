import type { AuthVerdict, ParsedHeaders, Signal } from "../types";
import { registrableDomain } from "./extract";

/**
 * Parse SPF / DKIM / DMARC results out of one or more Authentication-Results
 * header values. Returns available:false when no header was present — absence
 * is neutral, never a red flag.
 */
export function parseAuthResults(lines: string[]): AuthVerdict {
  if (!lines.length) return { available: false };
  const joined = lines.join("; ").toLowerCase();
  const grab = (mech: string): string | undefined => {
    // e.g. "spf=pass", "dkim=fail", "dmarc=pass" (allow whitespace around '=')
    const m = joined.match(new RegExp(`\\b${mech}\\s*=\\s*([a-z]+)`));
    return m?.[1];
  };
  return {
    spf: grab("spf"),
    dkim: grab("dkim"),
    dmarc: grab("dmarc"),
    available: true,
  };
}

/**
 * Grade authentication results.
 * - any spf/dkim/dmarc = fail  -> high, TRIGGERED
 * - pass / neutral / none      -> reassuring info, NOT triggered (does not lower score)
 * - header absent              -> neutral info, NOT triggered ("not available")
 */
export function authResultsCheck(verdict: AuthVerdict): Signal {
  const base = {
    id: "email-authentication",
    label: "Email authentication (SPF / DKIM / DMARC)",
    why: "SPF, DKIM, and DMARC confirm an email truly came from the domain it claims; a failure means it was likely spoofed. A pass only proves origin — not that the sending domain is trustworthy.",
  } as const;

  if (!verdict.available) {
    return {
      ...base,
      severity: "info",
      triggered: false,
      evidence: "email authentication results not available",
    };
  }

  const summary =
    [
      verdict.spf ? `SPF=${verdict.spf}` : null,
      verdict.dkim ? `DKIM=${verdict.dkim}` : null,
      verdict.dmarc ? `DMARC=${verdict.dmarc}` : null,
    ]
      .filter(Boolean)
      .join(", ") || "no SPF/DKIM/DMARC tokens found";

  const failed = (["spf", "dkim", "dmarc"] as const).filter(
    (k) => verdict[k] === "fail",
  );

  if (failed.length > 0) {
    return {
      ...base,
      severity: "high",
      triggered: true,
      evidence: `${failed.map((f) => `${f.toUpperCase()}=fail`).join(", ")} — full results: ${summary}`,
    };
  }

  return {
    ...base,
    severity: "info",
    triggered: false,
    evidence: `${summary} — origin confirmed, but this is not proof of safety`,
  };
}

/**
 * Flag a Reply-To or Return-Path whose registrable domain differs from the
 * From domain — a common way to silently route replies/bounces to an attacker.
 */
export function replyToCheck(h: ParsedHeaders): Signal {
  const base = {
    id: "reply-to-mismatch",
    label: "Reply-To / Return-Path mismatch",
    severity: "medium",
    why: "A reply address or bounce path on a different domain than the visible sender can route your response to an attacker.",
  } as const;

  if (!h.fromDomain) {
    return {
      ...base,
      triggered: false,
      evidence: "No From domain available to compare against.",
    };
  }

  const fromReg = registrableDomain(h.fromDomain);
  const hits: string[] = [];

  if (h.replyToDomain) {
    const reg = registrableDomain(h.replyToDomain);
    if (reg !== fromReg) {
      hits.push(`Reply-To ${h.replyToAddress} (${reg}) ≠ From domain ${fromReg}`);
    }
  }
  if (h.returnPathDomain) {
    const reg = registrableDomain(h.returnPathDomain);
    if (reg !== fromReg) {
      hits.push(
        `Return-Path ${h.returnPathAddress} (${reg}) ≠ From domain ${fromReg}`,
      );
    }
  }

  if (hits.length === 0) {
    return {
      ...base,
      triggered: false,
      evidence: "Reply-To / Return-Path align with the sender domain.",
    };
  }
  return { ...base, triggered: true, evidence: hits.join("; ") };
}
