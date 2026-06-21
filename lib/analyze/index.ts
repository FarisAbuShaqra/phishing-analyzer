import type { Report } from "../types";
import { parseInput, registrableDomain } from "./extract";
import {
  punycodeCheck,
  lookalikeCheck,
  linkMismatchCheck,
  urlStructureCheck,
} from "./urlChecks";
import { domainAgeCheck } from "./domainAge";
import {
  urgencyCheck,
  credentialAskCheck,
  genericGreetingCheck,
  senderMismatchCheck,
} from "./languageChecks";
import { scoreSignals, recommendedAction, DISCLAIMER } from "./score";

/**
 * Run the full deterministic engine. Pure except for the best-effort,
 * timeout-guarded domain-age RDAP lookup.
 */
export async function analyze(raw: string): Promise<Report> {
  const input = parseInput(raw);

  // Synchronous deterministic checks.
  const syncSignals = [
    punycodeCheck(input),
    lookalikeCheck(input),
    linkMismatchCheck(input),
    urlStructureCheck(input),
    senderMismatchCheck(input),
    urgencyCheck(input),
    credentialAskCheck(input),
    genericGreetingCheck(input),
  ];

  // Async, network-bound check — guarded internally, never throws.
  const ageSignal = await domainAgeCheck(input);

  const signals = [...syncSignals, ageSignal];

  const { riskScore, riskCategory } = scoreSignals(signals);

  return {
    riskScore,
    riskCategory,
    signals,
    extractedUrls: input.urls,
    senderDomain: input.senderDomain
      ? registrableDomain(input.senderDomain)
      : undefined,
    aiExplanation: null, // filled in by the API route via the AI stub
    recommendedAction: recommendedAction(riskCategory),
    disclaimer: DISCLAIMER,
  };
}
