import { NextResponse } from "next/server";
import { GAP_RUBRIC } from "@/lib/gap";
import { screen, ScreenError } from "@/lib/jev";
import { redact } from "@/lib/redact";

export const runtime = "nodejs";

const MAX_CHARS = 60_000;

const STATUS_BY_KIND: Record<ScreenError["kind"], number> = {
  auth: 401,
  rejected: 502,
  timeout: 504,
  transport: 502,
  malformed: 502,
};

export async function POST(request: Request) {
  const suppliedKey = request.headers.get("x-typesafe-key")?.trim();

  const serverKeyAllowed = process.env.ALLOW_SERVER_KEY === "1";
  const apiKey = suppliedKey || (serverKeyAllowed ? process.env.TYPESAFE_API_KEY : undefined);

  if (!apiKey) {
    return NextResponse.json(
      { error: "Add your TypeSafe API key above to run this." },
      { status: 401 },
    );
  }

  let body: { resume?: unknown; jobDescription?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  const resume = typeof body.resume === "string" ? body.resume.trim() : "";

  if (!jobDescription) return NextResponse.json({ error: "paste the job description" }, { status: 400 });
  if (!resume) return NextResponse.json({ error: "add your resume" }, { status: 400 });
  if (resume.length > MAX_CHARS || jobDescription.length > MAX_CHARS) {
    return NextResponse.json({ error: "that is longer than this handles" }, { status: 413 });
  }

  const redacted = redact(resume);

  try {
    const card = await screen(GAP_RUBRIC, redacted, { jobDescription, apiKey });
    return NextResponse.json({ card, redacted });
  } catch (error) {
    if (error instanceof ScreenError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: STATUS_BY_KIND[error.kind] },
      );
    }
    return NextResponse.json({ error: "could not read that" }, { status: 500 });
  }
}
