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

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Phishing Triage Analyzer
        </h1>
        <p className="mt-2 text-slate-600">
          Paste a suspicious email, message, or URL to get an{" "}
          <span className="font-medium text-slate-800">explainable</span> threat report —
          every verdict is backed by concrete, named evidence.
        </p>
      </header>

      {/* Input mode tabs */}
      <div className="mb-3 inline-flex rounded-lg border border-slate-300 bg-white p-1 text-sm">
        {(["paste", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-4 py-1.5 font-medium transition ${
              mode === m
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {m === "paste" ? "Paste text" : "Upload .eml"}
          </button>
        ))}
      </div>

      {mode === "paste" ? (
        <div className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste a suspicious email, message, or URL…"
            rows={10}
            className="w-full resize-y rounded-lg border border-slate-300 bg-white p-4 font-mono text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runAnalyze}
              disabled={!canAnalyze}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.status === "loading" ? "Analyzing…" : "Analyze"}
            </button>
            <button
              type="button"
              onClick={() => setContent(SAMPLE)}
              className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              Load sample phishing email
            </button>
            {content && (
              <button
                type="button"
                onClick={() => {
                  setContent("");
                  setState({ status: "idle" });
                }}
                className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
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
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-10 text-center transition hover:border-slate-400 hover:bg-slate-50"
          >
            <input
              type="file"
              accept=".eml,message/rfc822"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm font-medium text-slate-700">
              {file ? file.name : "Choose a .eml file"}
            </span>
            <span className="text-xs text-slate-400">
              Parses real headers — sender, Reply-To, and SPF/DKIM/DMARC
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runAnalyze}
              disabled={!canAnalyze}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.status === "loading" ? "Analyzing…" : "Analyze .eml"}
            </button>
            {file && (
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setState({ status: "idle" });
                }}
                className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Tutorial */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              aria-expanded={showHelp}
            >
              <span>How do I get an .eml file?</span>
              <span className="text-slate-400">{showHelp ? "▲" : "▼"}</span>
            </button>
            {showHelp && (
              <ul className="space-y-1.5 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                <li>
                  <span className="font-medium text-slate-800">Gmail (web):</span> open the
                  email → ⋮ menu → “Download message”.
                </li>
                <li>
                  <span className="font-medium text-slate-800">Outlook (web):</span> open the
                  email → ⋮ menu → “Save as” (or drag the email to your desktop).
                </li>
                <li>
                  <span className="font-medium text-slate-800">Apple Mail:</span> select the
                  email → File → “Save As” → Raw Message Source.
                </li>
                <li>
                  <span className="font-medium text-slate-800">Outlook (desktop):</span> open
                  the email → File → Save As → choose .eml.
                </li>
              </ul>
            )}
          </div>
        </div>
      )}

      <section className="mt-8">
        {state.status === "idle" && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
            Your report will appear here.
          </p>
        )}

        {state.status === "loading" && (
          <div className="space-y-3" aria-busy="true">
            <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-32 animate-pulse rounded-lg bg-slate-200" />
              <div className="h-32 animate-pulse rounded-lg bg-slate-200" />
            </div>
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.message}
          </div>
        )}

        {state.status === "result" && <ReportView report={state.report} />}
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-slate-400">
        Explainable triage &amp; education tool — not a replacement for enterprise email
        security. Deterministic checks report verifiable facts; the optional AI layer only
        explains them and never decides the verdict.
      </footer>
    </main>
  );
}
