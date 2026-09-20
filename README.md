# jev-screen

A job description is a list of claims. Your resume either proves them or it doesn't.

Paste both. You get back what the job asks for that your resume cannot currently
back up, and the one change that would close the widest gap.

Two surfaces share one engine:

- **`/`** — candidate-facing. Your own resume, your own target job. No employment
  decision is made, nothing is stored.
- **`/api/screen`** — recruiter-facing evidence cards. Not linked from the UI and
  not public until the bias audit and candidate notice exist.

## Run it

```bash
npm install
cp .env.example .env.local     # add TYPESAFE_API_KEY
npm run dev
```

## Why Jev rather than a chat model

Jev answers typed questions with probabilities, so the tool can say **unproven**
instead of guessing. A requirement comes back as `0.34`, not as a paragraph that
has to be parsed and half-believed. Routing questions carry an
`insufficient_signal` option, so a thin resume produces "not enough here to
judge" rather than an invented verdict.

That is also why there is no overall score. Scores are fakeable and invite
ranking; a gap list is specific and actionable.

## Layout

```
src/lib/pdf.ts       PDF -> markdown, with a scanned-PDF guard
src/lib/redact.ts    blind screening; the only way to make a RedactedText
src/lib/rubric.ts    rubric types, validation, content-addressed digest
src/lib/gap.ts       the resume-vs-job-description rubric
src/lib/evidence.ts  Jev answers -> findings, confidence routing
src/lib/jev.ts       the Jev call; server-side only
```

`redact` returns a branded `RedactedText` and the Jev payload accepts nothing
else, so raw resume text cannot reach the API by accident.

## Design

Hallmark, editorial genre. Split Studio macrostructure, Newsprint theme,
newspaper masthead, dense colophon. Tokens in `tokens.css`; the stylesheet
references them by name and never inlines a colour.

## Checks

```bash
npm test
npm run typecheck
npm run build
```
