import { describe, expect, it } from "vitest";
import { PLACEHOLDER, redact } from "@/lib/redact";

const RESUME = `Jane Q. Candidate
jane.candidate@example.com | +1 (415) 555-0142 | San Francisco, CA 94110
https://linkedin.com/in/janecandidate

EXPERIENCE
Staff Engineer, Stripe (2021-2025)
  Owned the payouts ledger service; ran it through two Black Fridays.
  Cut p99 from 1.2s to 180ms.

EDUCATION
BSc Computer Science, Stanford University, class of 2015
`;

describe("redaction", () => {
  const out = redact(RESUME);

  it("removes direct identifiers", () => {
    for (const secret of [
      "jane.candidate@example.com",
      "555-0142",
      "94110",
      "linkedin.com/in/janecandidate",
      "Jane Q. Candidate",
    ]) {
      expect(out).not.toContain(secret);
    }
  });

  it("keeps the signal the assessment depends on", () => {
    for (const kept of ["Stripe", "Staff Engineer", "payouts ledger", "2021-2025", "180ms"]) {
      expect(out).toContain(kept);
    }
  });

  it("removes institution and graduation year by default", () => {
    expect(out).not.toContain("Stanford University");
    expect(out).not.toContain("class of 2015");
  });

  it("keeps the institution when a role asks for it", () => {
    expect(redact(RESUME, { redactInstitutions: false })).toContain("Stanford University");
  });

  it("is idempotent", () => {
    expect(redact(out)).toEqual(out);
  });

  it("does not collapse into a wall of placeholders", () => {
    expect(out.match(/(?:\[REDACTED\][^\S\n]*){2,}/g)).toBeNull();
  });

  it("handles degenerate input", () => {
    expect(redact("")).toBe("");
    expect(redact("   ")).toBe("   ");
    expect(() => redact("x".repeat(200_000))).not.toThrow();
  });

  it("does not mistake a section header for a name", () => {
    const body = "EXPERIENCE\nStaff Engineer at Stripe";
    expect(redact(body)).toContain("EXPERIENCE");
  });

  it("keeps employment ranges, which a phone pattern would otherwise eat", () => {
    expect(redact("Engineer, Stripe (2021-2025)")).toContain("2021-2025");
    expect(redact("Cut p99 to 180ms across 50000 users")).toContain("50000");
  });

  it("marks the name header rather than deleting the line", () => {
    expect(out.split("\n")[0]).toBe(PLACEHOLDER);
  });
});
