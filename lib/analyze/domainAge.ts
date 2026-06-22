import type { ParsedInput, Signal } from "../types";
import { registrableDomain, hostnameOf } from "./extract";
import { SHORTENERS } from "./brands";

const RDAP_TIMEOUT_MS = 3500;
const YOUNG_DOMAIN_DAYS = 90;

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

/** Pick the primary domain to age-check: prefer a non-shortener URL host. */
function primaryDomain(input: ParsedInput): string | null {
  for (const url of input.urls) {
    const host = hostnameOf(url);
    if (!host) continue;
    const reg = registrableDomain(host);
    if (!SHORTENERS.includes(reg) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return reg;
    }
  }
  // fall back to the sender domain
  return input.senderDomain ? registrableDomain(input.senderDomain) : null;
}

async function lookupRegistrationDate(domain: string): Promise<Date | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RDAP_TIMEOUT_MS);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json" },
    });
    if (!res.ok) return null;
    const data: { events?: RdapEvent[] } = await res.json();
    const reg = data.events?.find(
      (e) => e.eventAction === "registration" && e.eventDate,
    );
    if (!reg?.eventDate) return null;
    const d = new Date(reg.eventDate);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Best-effort domain-age check. Degrades gracefully: any failure or timeout
 * yields a non-triggered info signal rather than crashing the request.
 */
export async function domainAgeCheck(input: ParsedInput): Promise<Signal> {
  const base = {
    id: "domain-age",
    label: "Newly registered domain",
    why: "Phishing infrastructure is often registered days before a campaign; a very young domain impersonating a brand is a strong red flag.",
  } as const;

  const domain = primaryDomain(input);
  if (!domain) {
    return {
      ...base,
      severity: "info",
      triggered: false,
      evidence: "No domain available to check.",
    };
  }

  const regDate = await lookupRegistrationDate(domain);
  if (!regDate) {
    return {
      ...base,
      severity: "info",
      triggered: false,
      evidence: `domain age unavailable (${domain})`,
    };
  }

  const ageDays = Math.floor((Date.now() - regDate.getTime()) / 86_400_000);
  const dateStr = regDate.toISOString().slice(0, 10);

  if (ageDays < YOUNG_DOMAIN_DAYS) {
    return {
      ...base,
      severity: "high",
      triggered: true,
      evidence: `${domain} was registered ${dateStr} (only ${ageDays} day(s) ago)`,
    };
  }

  return {
    ...base,
    severity: "info",
    triggered: false,
    evidence: `${domain} registered ${dateStr} (${ageDays} days old)`,
  };
}
