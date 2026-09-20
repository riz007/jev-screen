declare const brand: unique symbol;

export type RedactedText = string & { readonly [brand]: "redacted" };

export const PLACEHOLDER = "[REDACTED]";

export type RedactionOptions = {
  redactInstitutions?: boolean;
};

type Pattern = {
  name: string;
  re: RegExp;
  redactOnlyWhen?: (match: string) => boolean;
};

const SHORTEST_PLAUSIBLE_PHONE_DIGITS = 9;

const digitCount = (value: string) => (value.match(/\d/g) ?? []).length;

const SECTION_HEADERS = new Set([
  "experience",
  "work experience",
  "employment",
  "education",
  "skills",
  "summary",
  "profile",
  "objective",
  "projects",
  "publications",
  "certifications",
  "awards",
  "contact",
  "about",
]);

const PATTERNS: Pattern[] = [
  { name: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  {
    name: "profile-url",
    re: /\bhttps?:\/\/(?:www\.)?(?:linkedin\.com|github\.com|twitter\.com|x\.com|facebook\.com|instagram\.com)\/\S+/gi,
  },
  {
    name: "phone",
    re: /\+?\d[\d\s().-]{7,}\d/g,
    redactOnlyWhen: (match) =>
      digitCount(match) >= SHORTEST_PLAUSIBLE_PHONE_DIGITS,
  },
  { name: "postal-us", re: /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g },
  { name: "postal-uk", re: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi },
  {
    name: "date-of-birth",
    re: /\b(?:date of birth|dob|born)\s*[:\-]?\s*[^\n,;]{4,24}/gi,
  },
  { name: "age", re: /\bage\s*[:\-]\s*\d{1,2}\b/gi },
  {
    name: "graduation-year",
    re: /\b(?:class of|graduated|graduation)\s*[:\-]?\s*(?:19|20)\d{2}\b/gi,
  },
  {
    name: "demographics",
    re: /\b(?:gender|sex|marital status|nationality|citizenship|visa status|race|ethnicity|religion|pronouns)\s*[:\-]\s*[^\n,;]{1,32}/gi,
  },
];

const INSTITUTION: Pattern = {
  name: "institution",
  re: /\b(?:[A-Z][A-Za-z&.'-]+\s+){0,3}(?:University|College|Institute of Technology|Polytechnic|Academy)(?:\s+of\s+[A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+)?)?\b/g,
};

const ADJACENT_PLACEHOLDERS_ON_ONE_LINE = /(?:\[REDACTED\][^\S\n]*){2,}/g;

function isLikelyNameHeader(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length <= 60 &&
    trimmed.split(/\s+/).length <= 5 &&
    !/\d/.test(trimmed) &&
    !SECTION_HEADERS.has(
      trimmed
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .trim(),
    )
  );
}

function redactNameHeader(text: string): string {
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line.trim().length > 0);
  if (first === -1 || !isLikelyNameHeader(lines[first]!)) return text;

  lines[first] = PLACEHOLDER;
  return lines.join("\n");
}

export function redact(
  text: string,
  options: RedactionOptions = {},
): RedactedText {
  const { redactInstitutions = true } = options;
  const patterns = redactInstitutions ? [...PATTERNS, INSTITUTION] : PATTERNS;

  let out = redactNameHeader(text);

  for (const { re, redactOnlyWhen } of patterns) {
    out = out.replace(re, (match) =>
      redactOnlyWhen && !redactOnlyWhen(match) ? match : PLACEHOLDER,
    );
  }

  return out.replace(
    ADJACENT_PLACEHOLDERS_ON_ONE_LINE,
    `${PLACEHOLDER} `,
  ) as RedactedText;
}

export function unsafeAsRedacted(text: string): RedactedText {
  return text as RedactedText;
}
