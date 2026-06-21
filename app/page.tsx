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

export default function Home() {
  const [content, setContent] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function analyze() {
    if (!content.trim()) return;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
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
            onClick={analyze}
            disabled={state.status === "loading" || !content.trim()}
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
