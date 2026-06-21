import type { ParsedInput, Signal } from "../types";
import { BRANDS, SHORTENERS, RISKY_TLDS } from "./brands";
import { hostnameOf, registrableDomain } from "./extract";

/** Levenshtein edit distance. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

const CREDENTIAL_CONTEXT_RE =
  /\b(login|log-?in|sign-?in|verify|verification|account|password|secure|update|confirm|bank|wallet|credential|otp|2fa)\b/i;

/** The brand-name label of a hostname (second-level label). */
function brandLabel(hostname: string): string {
  const reg = registrableDomain(hostname);
  return reg.split(".")[0];
}

// --- Individual checks -----------------------------------------------------

export function punycodeCheck(input: ParsedInput): Signal {
  const base: Omit<Signal, "triggered" | "evidence"> = {
    id: "punycode-homograph",
    label: "Punycode / homograph domain",
    severity: "high",
    why: "Punycode and mixed-script domains can render as a trusted brand while pointing somewhere else entirely.",
  };

  const hits: string[] = [];
  for (const d of input.domains) {
    if (d.split(".").some((label) => label.startsWith("xn--"))) {
      hits.push(`${d} (punycode "xn--" label)`);
      continue;
    }
    // Mixed-script: Latin letters combined with Cyrillic/Greek lookalikes.
    const hasLatin = /[a-z]/i.test(d);
    const hasConfusable = /[Ѐ-ӿͰ-Ͽ]/.test(d);
    if (hasLatin && hasConfusable) {
      hits.push(`${d} (mixes Latin with Cyrillic/Greek lookalike characters)`);
    }
  }

  if (hits.length === 0) {
    return {
      ...base,
      triggered: false,
      evidence: "No punycode or mixed-script domains found.",
    };
  }
  return { ...base, triggered: true, evidence: hits.join("; ") };
}

export function lookalikeCheck(input: ParsedInput): Signal {
  const base: Omit<Signal, "triggered" | "evidence"> = {
    id: "lookalike-domain",
    label: "Lookalike / typosquat domain",
    severity: "high",
    why: "A domain that is one or two characters off a well-known brand is a classic impersonation tactic.",
  };

  const hits: string[] = [];
  for (const d of input.domains) {
    const label = brandLabel(d);
    if (!label) continue;
    if (BRANDS.includes(label)) continue; // exact brand label — legit-looking

    // Test the whole label and each hyphen/digit-separated token, so combos
    // like "paypa1-verify" or "micros0ft-billing" are caught, not just bare
    // typos like "paypa1".
    const tokens = Array.from(new Set([label, ...label.split(/[^a-z0-9]+/i)])).filter(
      (t) => t.length >= 3,
    );

    let matched: string | null = null;
    for (const token of tokens) {
      if (BRANDS.includes(token)) continue; // exact brand token — not a typo
      for (const brand of BRANDS) {
        const dist = editDistance(token, brand);
        if (dist > 0 && dist <= 2 && Math.abs(token.length - brand.length) <= 2) {
          matched =
            token === label
              ? `${d} ≈ "${brand}" (edit distance ${dist})`
              : `${d} contains "${token}" ≈ "${brand}" (edit distance ${dist})`;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) hits.push(matched);
  }

  if (hits.length === 0) {
    return {
      ...base,
      triggered: false,
      evidence: "No domains closely resemble a known brand.",
    };
  }
  return { ...base, triggered: true, evidence: hits.join("; ") };
}

export function linkMismatchCheck(input: ParsedInput): Signal {
  const base: Omit<Signal, "triggered" | "evidence"> = {
    id: "link-text-href-mismatch",
    label: "Link text vs. destination mismatch",
    severity: "high",
    why: "When the visible link text names one site but the href points to another, the link is disguising its true destination.",
  };

  const hits: string[] = [];
  for (const link of input.links) {
    // Does the displayed text itself look like a domain/URL?
    const textHost =
      hostnameOf(link.text) ??
      (/(?:[a-z0-9-]+\.)+[a-z]{2,}/i.exec(link.text)?.[0]
        ? hostnameOf(/(?:[a-z0-9-]+\.)+[a-z]{2,}/i.exec(link.text)![0])
        : null);
    const hrefHost = hostnameOf(link.href);
    if (!textHost || !hrefHost) continue;

    if (registrableDomain(textHost) !== registrableDomain(hrefHost)) {
      hits.push(
        `text shows "${textHost}" but link goes to "${hrefHost}"`,
      );
    }
  }

  if (hits.length === 0) {
    return {
      ...base,
      triggered: false,
      evidence: "No disguised links detected (or no rich links present).",
    };
  }
  return { ...base, triggered: true, evidence: hits.join("; ") };
}

export function urlStructureCheck(input: ParsedInput): Signal {
  const base: Omit<Signal, "triggered" | "evidence"> = {
    id: "url-structure",
    label: "Suspicious URL structure",
    severity: "medium",
    why: "Raw IP hosts, userinfo '@' tricks, shorteners, and deep subdomain stacking are common ways to hide a malicious destination.",
  };

  const hits: string[] = [];
  const credContext = CREDENTIAL_CONTEXT_RE.test(input.body);

  for (const url of input.urls) {
    const host = hostnameOf(url);
    if (!host) continue;
    const reg = registrableDomain(host);

    // Raw IP address host
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      hits.push(`${url} uses a raw IP address as the host`);
    }

    // userinfo "@" trick: anything before an @ in the authority
    const afterScheme = url.replace(/^https?:\/\//i, "");
    const authority = afterScheme.split(/[/?#]/)[0];
    if (authority.includes("@")) {
      hits.push(`${url} contains '@' — text before it is ignored by browsers`);
    }

    // Excessive subdomains (brand-looking labels stacked before the real domain)
    const labels = host.split(".");
    if (labels.length >= 5) {
      hits.push(`${host} stacks ${labels.length} subdomain levels`);
    } else if (
      labels.length >= 4 &&
      BRANDS.includes(labels[0]) &&
      !BRANDS.includes(reg.split(".")[0])
    ) {
      hits.push(
        `${host} puts a brand name ("${labels[0]}") in front of an unrelated domain ("${reg}")`,
      );
    }

    // Known shortener
    if (SHORTENERS.includes(reg)) {
      hits.push(`${reg} is a URL shortener that hides the real destination`);
    }

    // Risky TLD, amplified by credential context
    const tld = reg.split(".").pop()!;
    if (RISKY_TLDS.includes(tld)) {
      hits.push(
        credContext
          ? `${reg} uses a high-abuse ".${tld}" TLD alongside login/credential wording`
          : `${reg} uses a high-abuse ".${tld}" TLD`,
      );
    }
  }

  const unique = Array.from(new Set(hits));
  if (unique.length === 0) {
    return {
      ...base,
      triggered: false,
      evidence: "URLs use ordinary, well-formed structure.",
    };
  }
  return { ...base, triggered: true, evidence: unique.join("; ") };
}
