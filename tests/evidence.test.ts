import { describe, expect, it } from "vitest";
import { CONFIDENCE_FLOOR, buildCard, verdictFor, type EvidenceCard } from "@/lib/evidence";
import { INSUFFICIENT_SIGNAL, type Rubric } from "@/lib/rubric";

const RUBRIC: Rubric = {
  rubricId: "r1",
  version: 1,
  role: "Senior Backend Engineer",
  requirements: [],
  items: [
    { kind: "requirement", key: "ships_backend", question: "Shipped backend?", whenTrue: "yes", whenFalse: "no" },
    {
      kind: "dimension",
      key: "depth",
      question: "Depth?",
      label: "How deep?",
      levels: ["None", "Some", "Deep"],
    },
    { kind: "routing", key: "track", question: "Track?", options: { platform: "infra", product: "features" } },
  ],
};

const meta = { model: "jev-latest", latencyMs: 1400, usage: { input_tokens: 900, output_tokens: 20 } };

const answers = (over: Record<string, Record<string, unknown>> = {}) => ({
  ships_backend: { type: "noul", noul: 0.94 },
  depth: { type: "score", score: 2.0, confidence: 0.91, legend: {}, probabilities: {} },
  track: { type: "choice", choice: "platform", confidence: 0.88, probabilities: { platform: 0.88, product: 0.12 } },
  ...over,
});

const card = (over = {}) => buildCard(RUBRIC, "digest", answers(over), meta);

describe("evidence cards", () => {
  it("has no aggregate score, rank, or outcome", () => {
    const c: EvidenceCard = card();
    for (const banned of ["totalScore", "score", "rank", "outcome", "recommendation", "fit"]) {
      expect(c).not.toHaveProperty(banned);
    }
  });

  it("shows the rubric's own words for the level reached", () => {
    const depth = card().items.find((i) => i.key === "depth");
    expect(depth).toMatchObject({ level: 2, levelText: "Deep" });
  });

  it("keeps the raw probability rather than a bool", () => {
    const req = card().items.find((i) => i.key === "ships_backend");
    expect(req).toMatchObject({ probability: 0.94, verdict: "yes" });
  });

  it("calls the middle band unclear instead of guessing", () => {
    expect(verdictFor(0.5)).toBe("unclear");
    expect(verdictFor(0.34)).toBe("no");
    expect(verdictFor(0.66)).toBe("yes");

    const c = card({ ships_backend: { type: "noul", noul: 0.5 } });
    expect(c.needsHumanRead).toBe(true);
    expect(c.reasons.join()).toContain("unclear");
  });

  it("flags low confidence for a human", () => {
    const c = card({ depth: { type: "score", score: 1, confidence: 0.4, legend: {}, probabilities: {} } });
    expect(c.needsHumanRead).toBe(true);
    expect(c.reasons.join()).toContain("confidence");
  });

  it("surfaces insufficient signal rather than a low-confidence pick", () => {
    const c = card({
      track: { type: "choice", choice: INSUFFICIENT_SIGNAL, confidence: 0.9, probabilities: {} },
    });
    const track = c.items.find((i) => i.key === "track");
    expect(track).toMatchObject({ insufficientSignal: true });
    expect(c.reasons.join()).toContain("not enough");
  });

  it("is clean when every answer is confident", () => {
    const c = card();
    expect(c.needsHumanRead).toBe(false);
    expect(c.reasons).toEqual([]);
    expect(c.rubricDigest).toBe("digest");
  });

  it("clamps an out-of-range score into the levels the author wrote", () => {
    const high = card({ depth: { type: "score", score: 99, confidence: 0.9, legend: {}, probabilities: {} } });
    expect(high.items.find((i) => i.key === "depth")).toMatchObject({ level: 2, levelText: "Deep" });

    const low = card({ depth: { type: "score", score: -4, confidence: 0.9, legend: {}, probabilities: {} } });
    expect(low.items.find((i) => i.key === "depth")).toMatchObject({ level: 0, levelText: "None" });
  });

  it("flags a missing answer instead of dropping it silently", () => {
    const partial = buildCard(RUBRIC, "digest", { ships_backend: { type: "noul", noul: 0.9 } }, meta);
    expect(partial.needsHumanRead).toBe(true);
    expect(partial.reasons.join()).toContain("no answer");
  });

  it("uses the documented confidence floor", () => {
    expect(CONFIDENCE_FLOOR).toBe(0.8);
  });
});

describe("user-facing labels", () => {
  it("shows the label rather than the instruction written for Jev", () => {
    const depth = card().items.find((i) => i.key === "depth");
    expect(depth).toMatchObject({ label: "How deep?", question: "Depth?" });
  });

  it("falls back to the question when no label is written", () => {
    const req = card().items.find((i) => i.key === "ships_backend");
    expect(req).toMatchObject({ label: "Shipped backend?" });
  });

  it("carries the rubric's top level so a score can be read as a share", () => {
    const depth = card().items.find((i) => i.key === "depth");
    expect(depth).toMatchObject({ level: 2, maxLevel: 2 });
  });
});
