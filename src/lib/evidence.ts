import { verdictFor, type Verdict } from "./bands";
import { INSUFFICIENT_SIGNAL, type Rubric } from "./rubric";

export {
  BANDS,
  VERDICT_LABEL,
  VERDICT_MEANING,
  verdictFor,
  type Verdict,
} from "./bands";

export const CONFIDENCE_FLOOR = 0.8;

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
  ranked: Array<{ option: string; probability: number }>;
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

        if (verdict === "thin") {
          reasons.push(
            `${item.label ?? item.key}: only a hint, worth a human read`,
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

        const probabilities = (answer.probabilities ?? {}) as Record<
          string,
          number
        >;

        items.push({
          kind: "routing",
          key: item.key,
          question: item.question,
          label: item.label ?? item.question,
          selected,
          confidence,
          probabilities,
          ranked: Object.entries(probabilities)
            .map(([option, probability]) => ({ option, probability }))
            .sort((a, b) => b.probability - a.probability),
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
