import { screen, ScreenError } from "@/lib/jev";
import { redact } from "@/lib/redact";
import { SAMPLE_RUBRIC } from "@/lib/sample-rubric";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_RESUME_CHARS = 60_000;

const STATUS_BY_KIND: Record<ScreenError["kind"], number> = {
  auth: 502,
  rejected: 502,
  timeout: 504,
  transport: 502,
  malformed: 502,
};

export async function POST(request: Request) {
  let body: { resume?: unknown; redactInstitutions?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "expected a JSON body" },
      { status: 400 },
    );
  }

  const resume = typeof body.resume === "string" ? body.resume.trim() : "";

  if (!resume) {
    return NextResponse.json(
      { error: "resume text is required" },
      { status: 400 },
    );
  }
  if (resume.length > MAX_RESUME_CHARS) {
    return NextResponse.json({ error: "resume too long" }, { status: 413 });
  }
  if (!process.env.TYPESAFE_API_KEY) {
    return NextResponse.json(
      { error: "TYPESAFE_API_KEY is not set" },
      { status: 503 },
    );
  }

  const redacted = redact(resume, {
    redactInstitutions: body.redactInstitutions !== false,
  });

  try {
    const card = await screen(SAMPLE_RUBRIC, redacted);
    return NextResponse.json({ card, redacted });
  } catch (error) {
    if (error instanceof ScreenError) {
      return NextResponse.json(
        { error: error.message, kind: error.kind, detail: error.detail },
        { status: STATUS_BY_KIND[error.kind] },
      );
    }
    return NextResponse.json({ error: "screening failed" }, { status: 500 });
  }
}
