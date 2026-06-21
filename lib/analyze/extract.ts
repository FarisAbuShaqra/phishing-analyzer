import type { ParsedInput } from "../types";

/** Matches http(s) URLs and bare www. URLs. */
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"')\]]+)/gi;

/** Markdown links: [text](href) */
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/** HTML anchors: <a href="...">text</a> */
const HTML_LINK_RE = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;

/** Strip a trailing punctuation that commonly clings to a URL in prose. */
function trimUrl(u: string): string {
  return u.replace(/[.,;:!?]+$/, "");
}

/** Normalise to a fully-qualified URL so the WHATWG URL parser accepts it. */
function ensureProtocol(u: string): string {
  if (/^https?:\/\//i.test(u)) return u;
  return "http://" + u.replace(/^\/\//, "");
}

/** Extract the registrable-ish hostname from a URL string, lowercased. */
export function hostnameOf(rawUrl: string): string | null {
  try {
    const url = new URL(ensureProtocol(trimUrl(rawUrl)));
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Best-effort registrable domain (last two labels), e.g.
 * "secure-login.paypal.com.evil.xyz" -> "evil.xyz".
 * Handles a small set of common two-part public suffixes (co.uk etc.).
 */
const TWO_PART_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "co.in",
  "co.jp",
  "com.au",
  "co.nz",
  "com.br",
  "co.za",
  "com.sg",
  "ae.org",
]);

export function registrableDomain(hostname: string): string {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;
  const lastTwo = parts.slice(-2).join(".");
  const lastThree = parts.slice(-3).join(".");
  if (TWO_PART_SUFFIXES.has(lastTwo)) return lastThree;
  return lastTwo;
}

function parseSender(raw: string): {
  senderDisplayName?: string;
  senderAddress?: string;
  senderDomain?: string;
} {
  // Look for an explicit "From:" header first, else fall back to the first
  // email-looking token in the text.
  const fromLine = raw
    .split(/\r?\n/)
    .find((l) => /^\s*from\s*:/i.test(l));

  const scope = fromLine ?? raw;

  // "Display Name <addr@domain>"
  const named = scope.match(/"?([^"<>\n]+?)"?\s*<\s*([^<>\s@]+@[^<>\s]+)\s*>/);
  if (named) {
    const address = named[2].trim().toLowerCase();
    return {
      senderDisplayName: named[1].trim(),
      senderAddress: address,
      senderDomain: address.split("@")[1],
    };
  }

  // bare address
  const bare = scope.match(/([^\s<>@"]+@[^\s<>"]+\.[^\s<>".,;]+)/);
  if (bare) {
    const address = bare[1].trim().toLowerCase().replace(/[.,;:]+$/, "");
    return {
      senderAddress: address,
      senderDomain: address.split("@")[1],
    };
  }

  return {};
}

export function parseInput(raw: string): ParsedInput {
  const links: Array<{ text: string; href: string }> = [];

  let m: RegExpExecArray | null;

  MD_LINK_RE.lastIndex = 0;
  while ((m = MD_LINK_RE.exec(raw)) !== null) {
    links.push({ text: m[1].trim(), href: trimUrl(m[2].trim()) });
  }

  HTML_LINK_RE.lastIndex = 0;
  while ((m = HTML_LINK_RE.exec(raw)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    links.push({ text, href: trimUrl(m[1].trim()) });
  }

  // Collect all URLs: bare ones plus the hrefs from links.
  const urlSet = new Set<string>();
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(raw)) !== null) {
    urlSet.add(trimUrl(m[1]));
  }
  for (const l of links) {
    if (/^(https?:\/\/|www\.)/i.test(l.href)) urlSet.add(l.href);
  }

  const urls = Array.from(urlSet);

  const sender = parseSender(raw);

  // Scrutinize the sender's domain too, not just URL hosts — a lookalike or
  // punycode *sender* domain is itself a strong signal.
  const domains = Array.from(
    new Set(
      [...urls.map(hostnameOf), sender.senderDomain ?? null].filter(
        (h): h is string => !!h,
      ),
    ),
  );

  return {
    raw,
    body: raw,
    urls,
    domains,
    links,
    ...sender,
  };
}
