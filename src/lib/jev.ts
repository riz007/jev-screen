/**
 * Jev client.
 *
 * Server-side only. The SDK refuses to run in a browser unless explicitly
 * allowed, and nothing here passes that flag.
 */

import { TypeSafeClient } from "@typesafe-ai/sdk";
import { buildCard, type EvidenceCard } from "./evidence";
import type { RedactedText } from "./redact";
import { digest, toQuestions, type Rubric } from "./rubric";

export const DEFAULT_TIMEOUT_MS = 5_000;

export class ScreenError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "rejected" | "timeout" | "transport" | "malformed",
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ScreenError";
  }
}

/**
 * The only shape that reaches the API. `resume` is a `RedactedText`, so an
 * unredacted string cannot be passed without going through `redact` first.
 */
type State = {
  role: string;
  requirements: string[];
  resume: RedactedText;
};

export type ScreenOptions = {
  timeoutMs?: number;
  model?: string;
  /** Injectable for tests. */
  client?: Pick<TypeSafeClient, "systemOne">;
};

export async function screen(
  rubric: Rubric,
  resume: RedactedText,
  options: ScreenOptions = {},
): Promise<EvidenceCard> {
  const timeoutMs =
    options.timeoutMs ??
    (Number(process.env.JEV_SCREEN_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const client = options.client ?? new TypeSafeClient({ logLevel: "off" });

  const state: State = {
    role: rubric.role,
    requirements: rubric.requirements,
    resume,
  };

  const started = Date.now();

  try {
    const result = await client.systemOne(
      {
        state,
        questions: toQuestions(rubric),
        model: options.model ?? process.env.TYPESAFE_MODEL,
      },
      {
        timeout: timeoutMs,
        // `timeout` is per attempt; the signal is what caps total wall time.
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

/**
 * Keep the API's own explanation.
 *
 * YOLO-Shell hit this: the HTTP layer reduced a 422 to "http status: 422" and
 * discarded the body naming the offending field, which made a broken payload
 * undiagnosable. A 422 here means the rubric produced something the API
 * rejected, and the detail says which question.
 */
function toScreenError(error: unknown): ScreenError {
  const named = (error as { name?: string })?.name ?? "";
  const status = (error as { status?: number })?.status;
  const detail = detailOf(error);

  if (named === "AuthenticationError" || status === 401) {
    return new ScreenError("TypeSafe rejected the API key", "auth", detail);
  }
  if (named === "PermissionDeniedError" || status === 403) {
    return new ScreenError("TypeSafe denied this key", "auth", detail);
  }
  if (named === "UnprocessableEntityError" || status === 422) {
    return new ScreenError(
      "Jev rejected the request shape",
      "rejected",
      detail,
    );
  }
  if (
    named === "APITimeoutError" ||
    named === "APIUserAbortError" ||
    named === "TimeoutError"
  ) {
    return new ScreenError("Jev did not answer in time", "timeout", detail);
  }
  if (named === "APIConnectionError") {
    return new ScreenError("could not reach TypeSafe", "transport", detail);
  }
  return new ScreenError(
    error instanceof Error ? error.message : "unknown failure",
    "transport",
    detail,
  );
}

function detailOf(error: unknown): string | undefined {
  const body =
    (error as { error?: unknown; body?: unknown })?.error ??
    (error as { body?: unknown })?.body;
  if (body === undefined) return undefined;

  const text = typeof body === "string" ? body : JSON.stringify(body);
  // Server-supplied and printed to operators: bound it and strip control chars.
  return [...text]
    .filter((c) => c >= " " || c === "\t")
    .slice(0, 400)
    .join("");
}
