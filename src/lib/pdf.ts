import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PDF_BYTES = 8 * 1024 * 1024;

export class PdfError extends Error {}

export async function pdfToMarkdown(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new PdfError("PDF is larger than 8MB");

  let pages: string[];
  try {
    const document = await getDocumentProxy(bytes);
    ({ text: pages } = await extractText(document, { mergePages: false }));
  } catch {
    throw new PdfError("could not read that PDF");
  }

  const markdown = pages.map(toMarkdown).join("\n\n").trim();

  if (markdown.length < 80) {
    throw new PdfError(
      "that PDF has almost no selectable text, so it is probably a scan. Paste the text instead.",
    );
  }

  return markdown;
}

const BULLET = /^[•·▪◦‣⁃*-]\s+/;
const ALL_CAPS_HEADING = /^[A-Z][A-Z\s&/'-]{2,40}$/;

function toMarkdown(page: string): string {
  const lines = page
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  return lines
    .map((line) => {
      if (BULLET.test(line)) return `- ${line.replace(BULLET, "")}`;
      if (ALL_CAPS_HEADING.test(line)) return `## ${titleCase(line)}`;
      return line;
    })
    .join("\n");
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) => character.toUpperCase());
}
