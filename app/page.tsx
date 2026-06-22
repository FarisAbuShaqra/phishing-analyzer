"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";
import ReportView from "@/components/ReportView";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "result"; report: Report }
  | { status: "error"; message: string };

const SAMPLE = `From: PayPal Support <security@paypa1-verify.xyz>
Subject: Your account has been suspended

Dear Customer,

We detected unusual activity on your account. Your account has been suspended.
You must verify within 24 hours or it will be permanently closed.

Confirm your password and one-time code here: http://paypal.com.secure-login.xyz/verify

PayPal Security Team`;

type Mode = "paste" | "upload";

const DISCLAIMER =
  "Disclaimer: An explainable triage and education tool, not a replacement for enterprise email security. Checks report verifiable facts and the AI only explains them; a Low score is not a guarantee of safety.";

export default function Home() {
  const [mode, setMode] = useState<Mode>("paste");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  const canAnalyze =
    state.status !== "loading" &&
    (mode === "paste" ? content.trim().length > 0 : file !== null);

  // Shared by the file picker and drag-and-drop, so both behave identically.
  function pickFile(f: File | null) {
    setFile(f);
    setState({ status: "idle" });
  }

  async function runAnalyze() {
    if (!canAnalyze) return;
    setState({ status: "loading" });
    try {
      const res =
        mode === "paste"
          ? await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            })
          : await (() => {
              const fd = new FormData();
              fd.append("file", file as File);
              // No explicit Content-Type — the browser sets the multipart boundary.
              return fetch("/api/analyze", { method: "POST", body: fd });
            })();

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const report: Report = await res.json();
      setState({ status: "result", report });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  const tabClass = (m: Mode) =>
    `rounded-md px-4 py-1.5 font-medium transition ${
      mode === m ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
    }`;

  const primaryBtn =
    "rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";
  const linkBtn =
    "text-sm font-medium text-slate-500 underline-offset-2 transition hover:text-slate-800 hover:underline";

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Is this email trying to scam you?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Paste a suspicious email, message, or URL. You get a clear verdict and the exact evidence
          behind it — no black box, no guessing.
        </p>
      </header>

      {/* Input mode tabs */}
      <div className="mb-3 inline-flex rounded-lg border border-slate-300 bg-white p-1 text-sm">
        {(["paste", "upload"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={tabClass(m)}>
            {m === "paste" ? "Paste text" : "Upload .eml"}
          </button>
        ))}
      </div>

      {mode === "paste" ? (
        <div className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste the email, message, or link that looks off…"
            rows={10}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm text-slate-900 transition focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={runAnalyze} disabled={!canAnalyze} className={primaryBtn}>
              {state.status === "loading" ? "Analyzing…" : "Analyze"}
            </button>
            <button type="button" onClick={() => setContent(SAMPLE)} className={linkBtn}>
              Try a sample phish
            </button>
            {content && (
              <button
                type="button"
                onClick={() => {
                  setContent("");
                  setState({ status: "idle" });
                }}
                className={linkBtn}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label
            onDragOver={(e) => {
              // Stop the browser from navigating to / opening the dropped file.
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-12 text-center transition hover:border-slate-400 hover:bg-slate-50"
          >
            <input
              type="file"
              accept=".eml,message/rfc822"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm font-medium text-slate-700">
              {file ? file.name : "Drop a .eml here, or click to choose"}
            </span>
            <span className="text-xs text-slate-400">
              We read the real headers: sender, Reply-To, and SPF/DKIM/DMARC.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={runAnalyze} disabled={!canAnalyze} className={primaryBtn}>
              {state.status === "loading" ? "Analyzing…" : "Analyze .eml"}
            </button>
            {file && (
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setState({ status: "idle" });
                }}
                className={linkBtn}
              >
                Clear
              </button>
            )}
          </div>

          {/* Tutorial — collapsed by default, quiet. */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              aria-expanded={showHelp}
            >
              <span>How do I get an .eml file?</span>
              <span className="text-slate-400">{showHelp ? "▲" : "▼"}</span>
            </button>
            {showHelp && (
              <ul className="space-y-1.5 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                <li>
                  <span className="font-medium text-slate-800">Gmail (web):</span> open the email →
                  ⋮ menu → “Download message”.
                </li>
                <li>
                  <span className="font-medium text-slate-800">Outlook (web):</span> open the email
                  → ⋮ menu → “Save as” (or drag the email to your desktop).
                </li>
                <li>
                  <span className="font-medium text-slate-800">Apple Mail:</span> select the email →
                  File → “Save As” → Raw Message Source.
                </li>
                <li>
                  <span className="font-medium text-slate-800">Outlook (desktop):</span> open the
                  email → File → Save As → choose .eml.
                </li>
              </ul>
            )}
          </div>
        </div>
      )}

      <section className="mt-8">
        {state.status === "idle" && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            Nothing analyzed yet. Paste something that looks off and we&apos;ll break it down.
          </p>
        )}

        {state.status === "loading" && (
          <div className="animate-fade-in space-y-3" aria-busy="true">
            <p className="text-center text-sm text-slate-500">
              Reading the headers, tracing the links, checking the story…
            </p>
            <div className="h-36 animate-pulse rounded-2xl bg-slate-200" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
            </div>
          </div>
        )}

        {state.status === "error" && (
          <div className="animate-fade-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="font-medium">Couldn&apos;t analyze that.</span> {state.message}
          </div>
        )}

        {state.status === "result" && <ReportView report={state.report} />}
      </section>

      <footer className="mt-14 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-400">
        {DISCLAIMER}
      </footer>
    </main>
  );
}
