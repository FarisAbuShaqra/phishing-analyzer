"use client";

import { useState } from "react";
import type { Report, Severity, Signal } from "@/lib/types";

const CATEGORY_STYLES: Record<
  Report["riskCategory"],
  { ring: string; text: string; bg: string; label: string }
> = {
  Low: { ring: "ring-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Low risk" },
  Medium: { ring: "ring-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Medium risk" },
  High: { ring: "ring-red-500", text: "text-red-700", bg: "bg-red-50", label: "High risk" },
};

const SEVERITY_STYLES: Record<Severity, { dot: string; chip: string }> = {
  high: { dot: "bg-red-500", chip: "bg-red-100 text-red-800" },
  medium: { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800" },
  low: { dot: "bg-yellow-500", chip: "bg-yellow-100 text-yellow-800" },
  info: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
};

function RiskGauge({ report }: { report: Report }) {
  const s = CATEGORY_STYLES[report.riskCategory];
  return (
    <div className={`flex items-center gap-5 rounded-xl border border-slate-200 ${s.bg} p-5`}>
      <div
        className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full bg-white ring-4 ${s.ring}`}
      >
        <span className={`text-3xl font-bold ${s.text}`}>{report.riskScore}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">/ 100</span>
      </div>
      <div>
        <div className={`text-xl font-semibold ${s.text}`}>{s.label}</div>
        <p className="mt-1 max-w-xl text-sm text-slate-600">{report.recommendedAction}</p>
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const sev = SEVERITY_STYLES[signal.severity];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${sev.dot}`} aria-hidden />
          <h3 className="font-medium text-slate-900">{signal.label}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${sev.chip}`}>
          {signal.severity}
        </span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence</dt>
          <dd className="mt-0.5 break-words font-mono text-[13px] text-slate-800">{signal.evidence}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why it matters</dt>
          <dd className="mt-0.5 text-slate-600">{signal.why}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function ReportView({ report }: { report: Report }) {
  const [showPassed, setShowPassed] = useState(false);

  const triggered = report.signals.filter((s) => s.triggered);
  const passed = report.signals.filter((s) => !s.triggered);

  return (
    <div className="space-y-6">
      <RiskGauge report={report} />

      {/* Metadata */}
      {(report.senderDomain || report.extractedUrls.length > 0) && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          {report.senderDomain && (
            <p className="text-slate-600">
              <span className="font-medium text-slate-800">Sender domain:</span>{" "}
              <span className="font-mono">{report.senderDomain}</span>
            </p>
          )}
          {report.extractedUrls.length > 0 && (
            <div className="mt-2">
              <span className="font-medium text-slate-800">URLs found ({report.extractedUrls.length}):</span>
              <ul className="mt-1 space-y-0.5">
                {report.extractedUrls.map((u) => (
                  <li key={u} className="break-all font-mono text-[12px] text-slate-600">
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* AI explanation (Phase 3) */}
      {report.aiExplanation ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <h2 className="text-sm font-semibold text-indigo-900">AI explanation</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-indigo-900/90">{report.aiExplanation}</p>
          <p className="mt-2 text-xs text-indigo-700/70">
            The AI layer only explains the deterministic findings above — it does not change the score.
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          AI explanation disabled — add an API key to enable.
        </p>
      )}

      {/* Triggered signals */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {triggered.length > 0
            ? `Why this scored ${report.riskScore} — ${triggered.length} signal${triggered.length === 1 ? "" : "s"} triggered`
            : "No risk signals triggered"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {triggered.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      </section>

      {/* Passed checks */}
      {passed.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            aria-expanded={showPassed}
          >
            <span>What was checked and passed ({passed.length})</span>
            <span className="text-slate-400">{showPassed ? "▲" : "▼"}</span>
          </button>
          {showPassed && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {passed.map((s) => (
                <SignalCard key={s.id} signal={s} />
              ))}
            </div>
          )}
        </section>
      )}

      <p className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        {report.disclaimer}
      </p>
    </div>
  );
}
