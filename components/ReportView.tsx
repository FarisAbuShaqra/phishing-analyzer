"use client";

import { useState } from "react";
import type { Report, Severity, Signal } from "@/lib/types";

const CATEGORY_STYLES: Record<
  Report["riskCategory"],
  { border: string; bg: string; text: string; stroke: string; label: string }
> = {
  Low: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    stroke: "stroke-emerald-500",
    label: "Low risk",
  },
  Medium: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    stroke: "stroke-amber-500",
    label: "Medium risk",
  },
  High: {
    border: "border-red-200",
    bg: "bg-red-50",
    text: "text-red-700",
    stroke: "stroke-red-500",
    label: "High risk",
  },
};

const SEVERITY_STYLES: Record<Severity, { dot: string; chip: string }> = {
  high: { dot: "bg-red-500", chip: "bg-red-100 text-red-800" },
  medium: { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800" },
  low: { dot: "bg-yellow-500", chip: "bg-yellow-100 text-yellow-800" },
  info: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
};

// Display-only ordering: most severe first. Does not touch scoring.
const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };

/**
 * The signature element: a single circular dial that makes the score the hero
 * of the report. Everything else stays flat and quiet so this reads first.
 */
function ScoreHeader({ report }: { report: Report }) {
  const s = CATEGORY_STYLES[report.riskCategory];
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, report.riskScore)) / 100;
  const dashOffset = circumference * (1 - pct);

  return (
    <div
      className={`flex flex-col items-center gap-6 rounded-2xl border ${s.border} ${s.bg} p-6 text-center sm:flex-row sm:gap-8 sm:p-8 sm:text-left`}
    >
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            strokeWidth="11"
            className="stroke-slate-200/80"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            strokeWidth="11"
            strokeLinecap="round"
            className={s.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-5xl font-bold tabular-nums leading-none ${s.text}`}>
            {report.riskScore}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            / 100
          </span>
        </div>
      </div>

      <div>
        <div className={`text-2xl font-bold tracking-tight ${s.text}`}>{s.label}</div>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-700">
          {report.recommendedAction}
        </p>
      </div>
    </div>
  );
}

/**
 * AI explanation — its own accent (the one non-semantic accent color), placed
 * right under the score. Clearly labeled, with the note that it only explains.
 */
function AIPanel({ report }: { report: Report }) {
  if (report.aiExplanation) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
            AI
          </span>
        </div>
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-indigo-950/90">
          {report.aiExplanation}
        </p>
        <p className="mt-3 text-xs text-indigo-700/70">
          The AI only explains the findings below. It never decides the verdict or changes the
          score. That part is all computed by the detection engine.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4">
      <h2 className="text-sm font-semibold text-slate-600">Plain-English summary is off</h2>
      <p className="mt-1 text-xs text-slate-500">
        The verdict and evidence stand on their own. Add an API key to switch on an AI summary that
        explains them.
      </p>
    </div>
  );
}

function AuthChip({ label, value }: { label: string; value?: string }) {
  const v = (value ?? "n/a").toLowerCase();
  const style =
    v === "pass"
      ? "bg-emerald-100 text-emerald-800"
      : v === "fail" || v === "softfail"
        ? "bg-red-100 text-red-800"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${style}`}>
      {label}: <span className="font-semibold capitalize">{value ?? "n/a"}</span>
    </span>
  );
}

function HeaderPanel({ report }: { report: Report }) {
  if (!report.emailAuth) return null;
  const { emailAuth } = report;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Parsed email headers
      </h2>
      {report.senderAddress && (
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Who really sent it:</span>{" "}
          <span className="break-all font-mono">{report.senderAddress}</span>
        </p>
      )}
      <div className="mt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Authentication
        </span>
        {emailAuth.available ? (
          <div className="mt-1.5 flex flex-wrap gap-2">
            <AuthChip label="SPF" value={emailAuth.spf} />
            <AuthChip label="DKIM" value={emailAuth.dkim} />
            <AuthChip label="DMARC" value={emailAuth.dmarc} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            No authentication results in this message. Treated as neutral, not a red flag.
          </p>
        )}
      </div>
      {emailAuth.available && (
        <p className="mt-2 text-xs text-slate-400">
          A pass confirms the email really came from the domain it claims. It does not prove that
          domain is trustworthy.
        </p>
      )}
    </div>
  );
}

function SignalCard({ signal, passed }: { signal: Signal; passed?: boolean }) {
  const sev = SEVERITY_STYLES[signal.severity];
  return (
    <div
      className={`flex h-full flex-col rounded-xl border border-slate-200 p-4 ${
        passed ? "bg-slate-50/70" : "bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${passed ? "bg-slate-300" : sev.dot}`}
            aria-hidden
          />
          <h3 className="font-medium text-slate-900">{signal.label}</h3>
        </div>
        {passed ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <span aria-hidden>✓</span> Passed
          </span>
        ) : (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${sev.chip}`}
          >
            {signal.severity}
          </span>
        )}
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence</dt>
          <dd className="mt-0.5 break-words font-mono text-[13px] text-slate-800">
            {signal.evidence}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Why it matters
          </dt>
          <dd className="mt-0.5 text-slate-600">{signal.why}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function ReportView({ report }: { report: Report }) {
  const [showPassed, setShowPassed] = useState(false);
  const [showUrls, setShowUrls] = useState(false);

  const triggered = report.signals
    .filter((s) => s.triggered)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const passed = report.signals.filter((s) => !s.triggered);

  return (
    <div className="animate-fade-in space-y-6">
      <ScoreHeader report={report} />

      {/* AI explanation sits right under the score, with its own accent. */}
      <AIPanel report={report} />

      {/* Parsed .eml header summary (real sender + SPF/DKIM/DMARC). */}
      <HeaderPanel report={report} />

      {/* Triggered signals — the reasons for the score, worst first. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {triggered.length > 0
            ? `Why it scored ${report.riskScore} — ${triggered.length} signal${
                triggered.length === 1 ? "" : "s"
              } tripped`
            : "Nothing tripped a risk check"}
        </h2>
        {triggered.length > 0 ? (
          <div className="grid items-stretch gap-3 sm:grid-cols-2">
            {triggered.map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            None of the checks flagged a problem. Stay alert anyway — a clean scan is not a
            guarantee.
          </p>
        )}
      </section>

      {/* Passed checks — quiet reassurance, collapsed by default. */}
      {passed.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            aria-expanded={showPassed}
          >
            <span>What we checked and cleared ({passed.length})</span>
            <span className="text-slate-400">{showPassed ? "▲" : "▼"}</span>
          </button>
          {showPassed && (
            <div className="mt-3 grid items-stretch gap-3 sm:grid-cols-2">
              {passed.map((s) => (
                <SignalCard key={s.id} signal={s} passed />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Evidence trail: sender domain + extracted URLs (collapsed, not a result). */}
      {(report.senderDomain || report.extractedUrls.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          {report.senderDomain && (
            <p className="text-slate-600">
              <span className="font-medium text-slate-800">Sender domain:</span>{" "}
              <span className="font-mono">{report.senderDomain}</span>
            </p>
          )}
          {report.extractedUrls.length > 0 && (
            <div className={report.senderDomain ? "mt-2" : ""}>
              <button
                type="button"
                onClick={() => setShowUrls((v) => !v)}
                className="text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-slate-800 hover:underline"
                aria-expanded={showUrls}
              >
                {showUrls
                  ? "Hide extracted URLs"
                  : `Show extracted URLs (${report.extractedUrls.length})`}
              </button>
              {showUrls && (
                <ul className="mt-1.5 space-y-0.5">
                  {report.extractedUrls.map((u) => (
                    <li key={u} className="break-all font-mono text-[12px] text-slate-600">
                      {u}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
