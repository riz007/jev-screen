import { describe, expect, it } from "vitest";
import { INSUFFICIENT_SIGNAL, RubricError, digest, toQuestions, validate, type Rubric } from "@/lib/rubric";

const RUBRIC: Rubric = {
  rubricId: "r1",
  version: 1,
  role: "Senior Backend Engineer",
  requirements: ["5+ yrs production backend"],
  items: [
    {
      kind: "requirement",
      key: "ships_production_backend",
      question: "Has this person shipped and operated backend services in production?",
      whenTrue: "Shipped and operated services real users depended on",
      whenFalse: "Coursework, tutorials, or frontend-only work",
    },
    {
      kind: "dimension",
      key: "distributed_systems_depth",
      question: "Rate the depth of distributed systems experience evidenced here.",
      levels: ["No exposure", "Consumed an internal API", "Built and shipped a service"],
    },
    {
      kind: "routing",
      key: "track",
      question: "Which track does this experience fit best?",
      options: { platform: "Infrastructure and tooling", product: "User-facing features" },
    },
  ],
};

describe("rubrics", () => {
  it("builds one question per item", () => {
    const q = toQuestions(RUBRIC) as Record<string, { type: string }>;
    expect(Object.keys(q).sort()).toEqual(
      ["distributed_systems_depth", "ships_production_backend", "track"],
    );
    expect(q.ships_production_backend?.type).toBe("noul");
    expect(q.distributed_systems_depth?.type).toBe("score");
    expect(q.track?.type).toBe("choice");
  });

  it("always adds an escape hatch to routing questions", () => {
    const q = toQuestions(RUBRIC) as Record<string, { criteria: Record<string, string> }>;
    expect(q.track?.criteria).toHaveProperty(INSUFFICIENT_SIGNAL);
  });

  it("digest is stable across key reordering but changes with content", () => {
    const reordered: Rubric = { ...RUBRIC, items: [...RUBRIC.items].reverse() };
    expect(digest(reordered)).toBe(digest(RUBRIC));

    const edited: Rubric = {
      ...RUBRIC,
      items: RUBRIC.items.map((i) =>
        i.kind === "dimension" ? { ...i, levels: [...i.levels, "Ran an incident-critical system"] } : i,
      ),
    };
    expect(digest(edited)).not.toBe(digest(RUBRIC));
  });

  it("rejects rubrics that would produce bad questions", () => {
    const bad = (items: Rubric["items"]) => () => validate({ ...RUBRIC, items });

    expect(bad([])).toThrow(RubricError);
    expect(bad([{ kind: "dimension", key: "d", question: "q", levels: ["only one"] }])).toThrow(RubricError);
    expect(bad([{ kind: "requirement", key: "Bad-Key", question: "q", whenTrue: "a", whenFalse: "b" }])).toThrow(RubricError);
    expect(
      bad([
        { kind: "routing", key: "t", question: "q", options: { a: "a", [INSUFFICIENT_SIGNAL]: "no" } },
      ]),
    ).toThrow(RubricError);
  });

  it("rejects duplicate keys", () => {
    const dup = [RUBRIC.items[0]!, RUBRIC.items[0]!];
    expect(() => validate({ ...RUBRIC, items: dup })).toThrow(RubricError);
  });
});
