/**
 * Built-in brand list used for lookalike / typosquat detection.
 * Each entry is the bare second-level label of a well-known brand domain
 * (e.g. "paypal" for paypal.com). Kept deliberately small and high-signal.
 */
export const BRANDS: string[] = [
  "paypal",
  "microsoft",
  "office365",
  "outlook",
  "apple",
  "icloud",
  "amazon",
  "google",
  "gmail",
  "netflix",
  "instagram",
  "facebook",
  "whatsapp",
  "linkedin",
  "dhl",
  "fedex",
  "ups",
  "dpd",
  "emirates",
  "etisalat",
  "adcb",
  "enbd", // Emirates NBD
  "mashreq",
  "fab", // First Abu Dhabi Bank
  "coinbase",
  "binance",
  "chase",
  "wellsfargo",
  "hsbc",
  "dropbox",
  "docusign",
];

/** Known URL shorteners. */
export const SHORTENERS: string[] = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "rb.gy",
  "shorturl.at",
  "tiny.cc",
  "bit.do",
  "lnkd.in",
];

/**
 * TLDs that are disproportionately abused for phishing / malware.
 * Risk is amplified when paired with credential/login context.
 */
export const RISKY_TLDS: string[] = [
  "zip",
  "mov",
  "xyz",
  "top",
  "live",
  "click",
  "link",
  "country",
  "kim",
  "work",
  "gq",
  "ml",
  "cf",
  "tk",
  "rest",
  "fit",
  "lol",
];
