import { choice, noul, score, type Questions } from "@typesafe-ai/sdk";
import { createHash } from "node:crypto";

export type RequirementSpec = {
  kind: "requirement";
  key: string;
  question: string;
  label?: string;
  whenTrue: string;
  whenFalse: string;
};

export type DimensionSpec = {
  kind: "dimension";
  key: string;
  question: string;
  label?: string;
  levels: string[];
};

export type RoutingSpec = {
  kind: "routing";
  key: string;
  question: string;
  label?: string;
  options: Record<string, string>;
};

export type RubricItem = RequirementSpec | DimensionSpec | RoutingSpec;

export type Rubric = {
  rubricId: string;
  version: number;
  role: string;
  requirements: string[];
  items: RubricItem[];
};

export const INSUFFICIENT_SIGNAL = "insufficient_signal";
export const INSUFFICIENT_SIGNAL_DESCRIPTION =
  "The resume does not say enough to place this candidate";

const MIN_DIMENSION_LEVELS = 2;
const MIN_ROUTING_OPTIONS = 2;
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

export class RubricError extends Error {}

export function validate(rubric: Rubric): void {
  if (rubric.items.length === 0)
    throw new RubricError("a rubric needs at least one item");

  const seen = new Set<string>();

  for (const item of rubric.items) {
    if (!SNAKE_CASE.test(item.key))
      throw new RubricError(`key must be snake_case: ${item.key}`);
    if (seen.has(item.key)) throw new RubricError(`duplicate key: ${item.key}`);
    seen.add(item.key);

    if (
      item.kind === "dimension" &&
      item.levels.length < MIN_DIMENSION_LEVELS
    ) {
      throw new RubricError(
        `dimension ${item.key} needs at least ${MIN_DIMENSION_LEVELS} levels`,
      );
    }

    if (item.kind === "routing") {
      if (Object.keys(item.options).length < MIN_ROUTING_OPTIONS) {
        throw new RubricError(
          `routing ${item.key} needs at least ${MIN_ROUTING_OPTIONS} options`,
        );
      }
      if (INSUFFICIENT_SIGNAL in item.options) {
        throw new RubricError(`${INSUFFICIENT_SIGNAL} is added automatically`);
      }
    }
  }
}

export function toQuestions(rubric: Rubric): Questions {
  validate(rubric);

  const questions: Record<string, unknown> = {};

  for (const item of rubric.items) {
    switch (item.kind) {
      case "requirement":
        questions[item.key] = noul(item.question, {
          true: item.whenTrue,
          false: item.whenFalse,
        });
        break;

      case "dimension":
        questions[item.key] = score(
          item.question,
          item.levels as unknown as readonly [string, string, ...string[]],
        );
        break;

      case "routing":
        questions[item.key] = choice(item.question, {
          ...item.options,
          [INSUFFICIENT_SIGNAL]: INSUFFICIENT_SIGNAL_DESCRIPTION,
        });
        break;
    }
  }

  return questions as Questions;
}

export function digest(rubric: Rubric): string {
  return createHash("sha256")
    .update(canonicalJson(toQuestions(rubric)))
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`);

  return `{${entries.join(",")}}`;
}
