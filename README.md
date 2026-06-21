# Phishing Triage Analyzer

Paste a suspicious email, message, or URL and get an **explainable threat report**: an overall risk score (0–100), a signal-by-signal breakdown of *why* it's risky, and a recommended action.

The distinctive angle is **transparency**. This is not a black-box "phishing: yes/no" tool — every verdict is backed by concrete, named evidence (a domain either *is* punycode or it isn't), and the report is honest about uncertainty.

- The **deterministic checks are facts.** They run server-side with no AI and produce the score.
- The optional **AI layer only explains** those facts in plain English. It never decides the verdict.
- This is a **triage and education tool, not a replacement for enterprise email security.**

## What it checks

**URLs & domains**
- Punycode (`xn--`) and mixed-script / homograph domains
- Lookalike / typosquat domains (edit-distance match against a built-in brand list: PayPal, Microsoft, Apple, Amazon, Google, DHL, FedEx, Emirates, ADCB, Emirates NBD, and more)
- Link text vs. href mismatch (disguised markdown/HTML links)
- Suspicious URL structure: raw-IP hosts, `@` userinfo trick, excessive subdomain stacking, known URL shorteners, and high-abuse TLDs (`.zip`, `.xyz`, `.top`, …) in a credential context
- **Domain age** via free RDAP (`rdap.org`) — flags domains younger than ~90 days. Best-effort: wrapped in a short timeout and try/catch, so a failed or slow lookup degrades to an informational "domain age unavailable" signal and never crashes or hangs the request.

**Language & content**
- Urgency / threat phrasing ("account suspended", "verify within 24 hours", "unusual activity detected")
- Credential or payment asks (password, OTP/2FA code, gift card, wire transfer, crypto, bank details)
- Generic greeting ("Dear Customer/User/Member")
- Sender mismatch: display name impersonates a brand but the real address domain is unrelated

Each signal carries a severity weight (high = 30, medium = 15, low = 7, info = 0). Triggered weights are summed and capped at 100: **0–29 Low, 30–64 Medium, 65–100 High.** The report also lists key checks that *passed*, so you can see what was examined.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. **No API key is required** — the app is fully functional and demoable without one.

## Try these inputs

**1. Crafted phishing email → expect High**
```
From: PayPal Support <security@paypa1-verify.xyz>
Subject: Your account has been suspended

Dear Customer,

We detected unusual activity on your account. Your account has been suspended.
You must verify within 24 hours or it will be permanently closed.

Confirm your password and one-time code here: http://paypal.com.secure-login.xyz/verify

PayPal Security Team
```
Triggers lookalike domain, suspicious URL structure, sender mismatch, urgency, credential ask, and generic greeting.

**2. Disguised link → expect Medium/High**
```
Your invoice is ready. View it here: [https://www.microsoft.com/account](http://micros0ft-billing.top/login)
```
Triggers link text vs. href mismatch, lookalike domain, and a risky TLD.

**3. Plain benign message → expect Low**
```
Hi Sam, thanks for the notes from today's meeting. I'll send over the
final deck tomorrow morning. Have a good evening!
```
No signals trigger.

## Enabling the AI explanation layer (Phase 3)

The AI layer is a clean, key-optional stub today (`lib/ai.ts`). With no key set, `aiExplanation` is `null` and the UI shows a small muted note. To enable it later, create `.env.local`:

```bash
# either one enables the layer
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
```

The call runs **server-side only** inside `/api/analyze`. No secret ever reaches client code. When implemented, the layer will summarize the evidence, explicitly call out where signals conflict or are inconclusive, and restate the recommended action — while the deterministic score remains authoritative.

## Limitations (honest)

- The deterministic checks are reliable for the patterns they cover, but **no rule set catches every phishing technique.** A Low score is not a guarantee of safety.
- The optional AI layer is probabilistic and only *explains* — do not treat it as a verdict.
- This tool does **not** replace enterprise email filtering, link sandboxing, or attachment scanning.
- Domain-age lookups depend on a free third-party RDAP service and may be unavailable.

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind CSS.**
- All analysis runs server-side in `/api/analyze` (needed for the RDAP lookup and, later, the LLM call). No secrets in client code.
- Stateless — no database. Paste in, report out.
- Signal engine lives in `lib/analyze/` as small pure functions, each returning a typed `Signal`.
