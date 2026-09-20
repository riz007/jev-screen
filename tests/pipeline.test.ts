import { describe, expect, it } from "vitest";
import { redact } from "@/lib/redact";
import { screen, ScreenError } from "@/lib/jev";
import { SAMPLE_RUBRIC } from "@/lib/sample-rubric";

const RESUME = `Jane Q. Candidate
jane.candidate@example.com | +1 (415) 555-0142 | San Francisco, CA 94110

EXPERIENCE
Staff Engineer, Stripe (2021-2025)
  Owned the payouts ledger; on-call for it through two Black Fridays.
`;

function fakeClient(answers: unknown, capture: { state?: unknown } = {}) {
  return {
    systemOne: async (request: { state: unknown }) => {
      capture.state = request.state;
      return { model: "jev-latest", answers, usage: { input_tokens: 900, output_tokens: 20 } };
    },
  } as never;
}

const GOOD = {
  ships_production_backend: { type: "noul", noul: 0.95 },
  owned_a_service: { type: "noul", noul: 0.91 },
  distributed_systems_depth: { type: "score", score: 4, confidence: 0.9, legend: {}, probabilities: {} },
  track: { type: "choice", choice: "platform", confidence: 0.93, probabilities: { platform: 0.93 } },
};

describe("pipeline", () => {
  it("never sends unredacted text to Jev", async () => {
    const capture: { state?: { resume: string } } = {};
    await screen(SAMPLE_RUBRIC, redact(RESUME), { client: fakeClient(GOOD, capture) });

    const sent = capture.state!.resume;
    for (const secret of ["jane.candidate@example.com", "555-0142", "Jane Q. Candidate"]) {
      expect(sent).not.toContain(secret);
    }
    expect(sent).toContain("Stripe");
    expect(sent).toContain("payouts ledger");
    expect(sent).toContain("2021-2025");
  });

  it("produces a card tied to the rubric digest", async () => {
    const card = await screen(SAMPLE_RUBRIC, redact(RESUME), { client: fakeClient(GOOD) });
    expect(card.items).toHaveLength(SAMPLE_RUBRIC.items.length);
    expect(card.rubricDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(card.needsHumanRead).toBe(false);
  });

  it("keeps the API's explanation when Jev rejects the request", async () => {
    const client = {
      systemOne: async () => {
        throw Object.assign(new Error("Unprocessable Entity"), {
          name: "UnprocessableEntityError",
          status: 422,
          error: { detail: [{ loc: ["body", "questions", "track", "criteria"], msg: "Field required" }] },
        });
      },
    } as never;

    await expect(screen(SAMPLE_RUBRIC, redact(RESUME), { client })).rejects.toMatchObject({
      kind: "rejected",
    });

    const error = await screen(SAMPLE_RUBRIC, redact(RESUME), { client }).then(
      () => null,
      (e: ScreenError) => e,
    );
    expect(error?.detail).toContain("track");
  });

  it("classifies auth and timeout distinctly", async () => {
    const fail = (name: string, status?: number) =>
      ({ systemOne: async () => { throw Object.assign(new Error(name), { name, status }); } }) as never;

    const kinds = await Promise.all(
      [["AuthenticationError", 401], ["APITimeoutError", undefined], ["APIConnectionError", undefined]].map(
        ([name, status]) =>
          screen(SAMPLE_RUBRIC, redact(RESUME), { client: fail(name as string, status as number) })
            .catch((e: ScreenError) => e.kind),
      ),
    );
    expect(kinds).toEqual(["auth", "timeout", "transport"]);
  });
});
