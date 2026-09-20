export const BANDS = { proven: 0.8, likely: 0.6, thin: 0.4 } as const;

export type Verdict = "proven" | "likely" | "thin" | "absent";

export const VERDICT_LABEL: Record<Verdict, string> = {
  proven: "proven",
  likely: "likely",
  thin: "thin",
  absent: "not shown",
};

export const VERDICT_MEANING: Record<Verdict, string> = {
  proven: "The document demonstrates this.",
  likely: "Leaning yes, but not demonstrated outright.",
  thin: "There is a hint of it and no more.",
  absent: "Nothing here backs this up.",
};

export function verdictFor(probability: number): Verdict {
  if (probability >= BANDS.proven) return "proven";
  if (probability >= BANDS.likely) return "likely";
  if (probability >= BANDS.thin) return "thin";
  return "absent";
}
