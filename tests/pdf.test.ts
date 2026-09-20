import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_PDF_BYTES, PdfError, pdfToMarkdown } from "@/lib/pdf";
import { redact } from "@/lib/redact";

const resumePdf = () =>
  new Uint8Array(readFileSync(new URL("./fixtures/resume.pdf", import.meta.url)));

describe("pdf to markdown", () => {
  it("extracts the whole document, not a prefix of it", async () => {
    const out = await pdfToMarkdown(resumePdf());

    expect(out).toContain("Staff Engineer, Stripe (2021-2025)");
    expect(out).toContain("180ms");
    expect(out).toContain("Senior Engineer, Shopify (2018-2021)");
    expect(out).toContain("class of 2015");
  });

  it("turns all-caps section titles into markdown headings", async () => {
    const out = await pdfToMarkdown(resumePdf());

    expect(out).toContain("## Experience");
    expect(out).toContain("## Education");
  });

  it("feeds redaction cleanly end to end", async () => {
    const redacted = redact(await pdfToMarkdown(resumePdf()));

    for (const identifier of ["jane@example.com", "555-0142", "Stanford University", "class of 2015"]) {
      expect(redacted).not.toContain(identifier);
    }
    for (const signal of ["Stripe", "Shopify", "payouts ledger", "180ms", "2021-2025"]) {
      expect(redacted).toContain(signal);
    }
  });

  it("says a scanned PDF is a scan instead of returning nothing", async () => {
    const blank = new Uint8Array(readFileSync(new URL("./fixtures/resume.pdf", import.meta.url)));
    await expect(pdfToMarkdown(blank.slice(0, 2000))).rejects.toBeInstanceOf(PdfError);
  });

  it("rejects an oversized file before parsing it", async () => {
    await expect(pdfToMarkdown(new Uint8Array(MAX_PDF_BYTES + 1))).rejects.toThrow(/8MB/);
  });

  it("rejects bytes that are not a PDF", async () => {
    await expect(pdfToMarkdown(new TextEncoder().encode("not a pdf"))).rejects.toBeInstanceOf(PdfError);
  });
});

describe("gap rubric", () => {
  it("gives every item a user-facing label that is not a Jev instruction", async () => {
    const { GAP_RUBRIC } = await import("@/lib/gap");

    for (const item of GAP_RUBRIC.items) {
      expect(item.label, `${item.key} has no label`).toBeTruthy();
      expect(item.label).not.toMatch(/^Rate how/);
      expect(item.label).not.toBe(item.question);
    }
  });
});
