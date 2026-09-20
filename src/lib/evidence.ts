import { INSUFFICIENT_SIGNAL, type Rubric } from "./rubric";

export const CONFIDENCE_FLOOR = 0.8;
export const UNCLEAR_BAND = { low: 0.35, high: 0.65 } as const;

export type Verdict = "yes" | "no" | "unclear";

export type RequirementEvidence = {
  kind: "requirement";
  key: string;
  question: string;
  label: string;
  probability: number;
  verdict: Verdict;
};

export type DimensionEvidence = {
  kind: "dimension";
  key: string;
  question: string;
  label: string;
  score: number;
  level: number;
  maxLevel: number;
  levelText: string;
  confidence: number;
};

export type RoutingEvidence = {
  kind: "routing";
  key: string;
  question: string;
  label: string;
  selected: string;
  confidence: number;
  probabilities: Record<string, number>;
  insufficientSignal: boolean;
};

export type Evidence =
  | RequirementEvidence
  | DimensionEvidence
  | RoutingEvidence;

export type EvidenceCard = {
  role: string;
  rubricDigest: string;
  model: string;
  latencyMs: number;
  usage: { input_tokens: number; output_tokens: number };
  items: Evidence[];
  needsHumanRead: boolean;
  reasons: string[];
};

export function verdictFor(probability: number): Verdict {
  if (probability < UNCLEAR_BAND.low) return "no";
  if (probability > UNCLEAR_BAND.high) return "yes";
  return "unclear";
}

type RawAnswers = Record<string, Record<string, unknown>>;

export function buildCard(
  rubric: Rubric,
  rubricDigest: string,
  answers: RawAnswers,
  meta: { model: string; latencyMs: number; usage: EvidenceCard["usage"] },
): EvidenceCard {
  const items: Evidence[] = [];
  const reasons: string[] = [];

  for (const item of rubric.items) {
    const answer = answers[item.key];

    if (!answer) {
      reasons.push(`no answer for "${item.key}"`);
      continue;
    }

    switch (item.kind) {
      case "requirement": {
        const probability = Number(answer.noul);
        const verdict = verdictFor(probability);

        if (verdict === "unclear") {
          reasons.push(
            `"${item.key}" is unclear (p=${probability.toFixed(2)})`,
          );
        }

        items.push({
          kind: "requirement",
          key: item.key,
          question: item.question,
          label: item.label ?? item.question,
          probability,
          verdict,
        });
        break;
      }

      case "dimension": {
        const raw = Number(answer.score);
        const confidence = Number(answer.confidence ?? 0);
        const level = clamp(Math.round(raw), 0, item.levels.length - 1);

        if (confidence < CONFIDENCE_FLOOR) {
          reasons.push(
            `"${item.key}" scored at ${confidence.toFixed(2)} confidence`,
          );
        }

        items.push({
          kind: "dimension",
          key: item.key,
          question: item.question,
          label: item.label ?? item.question,
          score: raw,
          level,
          maxLevel: item.levels.length - 1,
          levelText: item.levels[level] ?? "",
          confidence,
        });
        break;
      }

      case "routing": {
        const selected = String(answer.choice);
        const confidence = Number(answer.confidence ?? 0);
        const insufficientSignal = selected === INSUFFICIENT_SIGNAL;

        if (insufficientSignal) {
          reasons.push(`"${item.key}": not enough in the resume to place them`);
        } else if (confidence < CONFIDENCE_FLOOR) {
          reasons.push(
            `"${item.key}" chosen at ${confidence.toFixed(2)} confidence`,
          );
        }

        items.push({
          kind: "routing",
          key: item.key,
          question: item.question,
          label: item.label ?? item.question,
          selected,
          confidence,
          probabilities: (answer.probabilities ?? {}) as Record<string, number>,
          insufficientSignal,
        });
        break;
      }
    }
  }

  return {
    role: rubric.role,
    rubricDigest,
    model: meta.model,
    latencyMs: meta.latencyMs,
    usage: meta.usage,
    items,
    needsHumanRead: reasons.length > 0,
    reasons,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
