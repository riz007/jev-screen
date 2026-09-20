import { TypeSafeClient } from "@typesafe-ai/sdk";
import { buildCard, type EvidenceCard } from "./evidence";
import type { RedactedText } from "./redact";
import { digest, toQuestions, type Rubric } from "./rubric";

export const DEFAULT_TIMEOUT_MS = 5_000;

const MAX_ERROR_DETAIL_CHARS = 400;

export type ScreenErrorKind = "auth" | "rejected" | "timeout" | "transport" | "malformed";

export class ScreenError extends Error {
  constructor(
    message: string,
    readonly kind: ScreenErrorKind,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ScreenError";
  }
}

type State = {
  role: string;
  requirements: string[];
  resume: RedactedText;
  job_description?: string;
};

export type ScreenOptions = {
  timeoutMs?: number;
  model?: string;
  jobDescription?: string;
  apiKey?: string;
  client?: Pick<TypeSafeClient, "systemOne">;
};

export async function screen(
  rubric: Rubric,
  resume: RedactedText,
  options: ScreenOptions = {},
): Promise<EvidenceCard> {
  const timeoutMs =
    options.timeoutMs ?? (Number(process.env.JEV_SCREEN_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);

  const client =
    options.client ??
    new TypeSafeClient({
      logLevel: "off",
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    });

  const state: State = { role: rubric.role, requirements: rubric.requirements, resume };
  if (options.jobDescription) state.job_description = options.jobDescription;

  const started = Date.now();

  try {
    const result = await client.systemOne(
      {
        state,
        questions: toQuestions(rubric),
        model: options.model ?? process.env.TYPESAFE_DEFAULT_MODEL,
      },
      {
        timeout: timeoutMs,
        signal: AbortSignal.timeout(timeoutMs),
        retry: { maxRetries: 1 },
      },
    );

    return buildCard(rubric, digest(rubric), result.answers as never, {
      model: result.model,
      latencyMs: Date.now() - started,
      usage: result.usage,
    });
  } catch (error) {
    throw toScreenError(error);
  }
}

function toScreenError(error: unknown): ScreenError {
  const name = (error as { name?: string })?.name ?? "";
  const status = (error as { status?: number })?.status;
  const detail = detailOf(error);

  if (name === "AuthenticationError" || status === 401) {
    return new ScreenError("TypeSafe rejected the API key", "auth", detail);
  }
  if (name === "PermissionDeniedError" || status === 403) {
    return new ScreenError("TypeSafe denied this key", "auth", detail);
  }
  if (name === "UnprocessableEntityError" || status === 422) {
    return new ScreenError("Jev rejected the request shape", "rejected", detail);
  }
  if (name === "APITimeoutError" || name === "APIUserAbortError" || name === "TimeoutError") {
    return new ScreenError("Jev did not answer in time", "timeout", detail);
  }
  if (name === "APIConnectionError") {
    return new ScreenError("could not reach TypeSafe", "transport", detail);
  }

  return new ScreenError(
    error instanceof Error ? error.message : "unknown failure",
    "transport",
    detail,
  );
}

function detailOf(error: unknown): string | undefined {
  const body = (error as { error?: unknown })?.error ?? (error as { body?: unknown })?.body;
  if (body === undefined) return undefined;

  const text = typeof body === "string" ? body : JSON.stringify(body);

  return [...text]
    .filter((character) => character >= " " || character === "\t")
    .slice(0, MAX_ERROR_DETAIL_CHARS)
    .join("");
}
