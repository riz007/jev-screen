import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("key handling", () => {
  const page = read("src/app/page.tsx");
  const route = read("src/app/api/gap/route.ts");
  const jev = read("src/lib/jev.ts");

  it("takes the key from the request, never from a query string", () => {
    expect(route).toContain('headers.get("x-typesafe-key")');
    expect(route).not.toMatch(/searchParams.*key/i);
  });

  it("never logs the key or the resume", () => {
    for (const source of [page, route, jev]) {
      expect(source).not.toMatch(/console\.(log|info|warn|error)/);
    }
  });

  it("never persists the key beyond the tab", () => {
    expect(page).toContain("sessionStorage");
    expect(page).not.toContain("localStorage");
    expect(page).not.toMatch(/document\.cookie/);
  });

  it("masks the key in the UI", () => {
    expect(page).toContain('type="password"');
    expect(page).toContain('autoComplete="off"');
  });

  it("tolerates storage being unavailable", () => {
    expect(page).toMatch(/try\s*{[\s\S]*sessionStorage[\s\S]*}\s*catch/);
  });
});

describe("data minimisation", () => {
  const page = read("src/app/page.tsx");
  const route = read("src/app/api/gap/route.ts");

  it("scrubs in the browser, so the server never receives the original", () => {
    expect(page).toContain('import { redact } from "@/lib/redact"');
    // Assert the request body itself is scrubbed, not a particular variable name.
    expect(page).toMatch(/body:\s*JSON\.stringify\(\{\s*resume:\s*redact\(/);
  });

  it("reads the PDF in the browser, so the file never reaches the server", () => {
    expect(page).toContain('await import("@/lib/pdf")');
    expect(page).toMatch(/setResume\(await pdfToMarkdown\(/);
  });

  it("scrubs again on the server, since redaction is idempotent", () => {
    expect(route).toContain("redact(resume)");
  });

  it("writes nothing to any store", () => {
    for (const source of [page, route]) {
      expect(source).not.toMatch(
        /prisma|mongoose|createClient|fs\.writeFile|redis/i,
      );
    }
  });

  it("tells the user where the data goes and that nothing is kept", () => {
    expect(page).toMatch(/United States/);
    expect(page).toMatch(/Nothing is stored/i);
    expect(page).toMatch(/Thailand/);
    expect(page).toMatch(/no cookies/i);
  });
});

describe("deployment safety", () => {
  const route = read("src/app/api/gap/route.ts");

  it("does not spend the deployer's key on a stranger's request by default", () => {
    expect(route).toContain('process.env.ALLOW_SERVER_KEY === "1"');
    expect(route).toMatch(
      /serverKeyAllowed \? process\.env\.TYPESAFE_API_KEY : undefined/,
    );
  });

  it("keeps .env out of version control", () => {
    const ignored = readFileSync(
      new URL("../.gitignore", import.meta.url),
      "utf8",
    );
    expect(ignored).toMatch(/^\.env$/m);
    expect(ignored).toMatch(/^\.env\.local$/m);
  });
});
