import { describe, expect, it } from "vitest";
import { GAP_RUBRIC } from "@/lib/gap";
import { screen, type ScreenOptions } from "@/lib/jev";
import { redact } from "@/lib/redact";

const RESUME = [
  "EXPERIENCE",
  "Junior Developer, small agency (2023-2025)",
  "Worked on internal tools. Familiar with Node and React.",
].join("\n");

const ANSWERS = {
  proves_core_skills: { type: "noul", noul: 0.4 },
  proves_scope: { type: "noul", noul: 0.4 },
  proves_domain: { type: "noul", noul: 0.2 },
  evidence_quality: { type: "score", score: 1, confidence: 0.9, legend: {}, probabilities: {} },
  coverage: { type: "score", score: 1, confidence: 0.9, legend: {}, probabilities: {} },
  biggest_gap: { type: "choice", choice: "domain_experience", confidence: 0.9, probabilities: {} },
};

function recordingClient(capture: { request?: Record<string, unknown> }) {
  return {
    systemOne: async (request: Record<string, unknown>) => {
      capture.request = request;
      return { model: "jev-latest", answers: ANSWERS, usage: { input_tokens: 10, output_tokens: 2 } };
    },
  } as unknown as NonNullable<ScreenOptions["client"]>;
}

describe("the options the API route actually passes", () => {
  it("accepts jobDescription and apiKey together", async () => {
    const capture: { request?: Record<string, unknown> } = {};

    const card = await screen(GAP_RUBRIC, redact(RESUME), {
      jobDescription: "Senior Backend Engineer, fintech",
      apiKey: "caller-supplied-key",
      client: recordingClient(capture),
    });

    expect(card.items).toHaveLength(GAP_RUBRIC.items.length);
  });

  it("puts the job description into state, where the rubric refers to it", async () => {
    const capture: { request?: Record<string, unknown> } = {};

    await screen(GAP_RUBRIC, redact(RESUME), {
      jobDescription: "Senior Backend Engineer, fintech",
      client: recordingClient(capture),
    });

    const state = capture.request?.state as Record<string, unknown>;
    expect(state.job_description).toBe("Senior Backend Engineer, fintech");
    expect(state.resume).toContain("Junior Developer");
  });

  it("omits job_description when there is none, rather than sending empty", async () => {
    const capture: { request?: Record<string, unknown> } = {};

    await screen(GAP_RUBRIC, redact(RESUME), { client: recordingClient(capture) });

    const state = capture.request?.state as Record<string, unknown>;
    expect(state).not.toHaveProperty("job_description");
  });
});
