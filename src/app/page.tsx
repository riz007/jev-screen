"use client";

import {
  BANDS,
  VERDICT_LABEL,
  VERDICT_MEANING,
  type Verdict,
} from "@/lib/bands";
import type { Evidence, EvidenceCard, RoutingEvidence } from "@/lib/evidence";
import { redact } from "@/lib/redact";
import { useEffect, useState } from "react";

type Report = { card: EvidenceCard; redacted: string };

const KEY_STORAGE = "typesafe-key";

const GAP_LABELS: Record<string, string> = {
  core_skills: "showing the primary skills actually used in real work",
  scope_and_ownership: "showing ownership at the level the job describes",
  domain_experience: "showing experience in the domain the job names",
  measurable_outcomes: "turning responsibilities into measured outcomes",
  nothing_significant: "nothing major — this resume already makes its case",
  insufficient_signal: "more detail, because there is not enough here to judge",
};

async function readReport(response: Response): Promise<Report> {
  const body = await response.text();

  let data: { error?: string; detail?: string };
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(
      response.ok
        ? "The server sent something this could not read."
        : `The server returned an error (${response.status}). Try again in a moment.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      [data.error, data.detail].filter(Boolean).join("\n") ||
        "could not read that",
    );
  }

  return data as unknown as Report;
}

export default function Page() {
  const [apiKey, setApiKey] = useState("");
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setApiKey(sessionStorage.getItem(KEY_STORAGE) ?? "");
    } catch {
      /* private mode, or storage blocked: the field simply starts empty */
    }
  }, []);

  function rememberKey(value: string) {
    setApiKey(value);
    try {
      if (value) sessionStorage.setItem(KEY_STORAGE, value);
      else sessionStorage.removeItem(KEY_STORAGE);
    } catch {
      /* not storing it is an acceptable outcome */
    }
  }

  const ready =
    apiKey.trim().length > 0 &&
    jobDescription.trim().length > 0 &&
    resume.trim().length > 0;

  async function run() {
    setBusy(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch("/api/gap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-typesafe-key": apiKey.trim(),
        },
        body: JSON.stringify({ resume: redact(resume), jobDescription }),
      });

      setReport(await readReport(response));
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not read that");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError(null);
    setFileName(file.name);

    try {
      const { pdfToMarkdown } = await import("@/lib/pdf");
      setResume(await pdfToMarkdown(new Uint8Array(await file.arrayBuffer())));
    } catch (e) {
      setFileName(null);
      setError(e instanceof Error ? e.message : "could not read that PDF");
    } finally {
      setParsing(false);
      event.target.value = "";
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="shell topbar__inner">
          <p className="topbar__word mono">WHAT YOUR RESUME PROVES</p>
          <p className="topbar__meta mono">Read by Jev · nothing stored</p>
        </div>
      </header>

      <main className="shell">
        <div className="lede">
          <h1>
            A job description is a list of claims. Your resume either proves
            them or it doesn&rsquo;t.
          </h1>
          <p>
            Paste both. You get back what this job asks for that your resume
            cannot currently back up, and the one change that would close the
            widest gap.
          </p>
        </div>

        <section className="key">
          <div className="key__row">
            <label htmlFor="api-key">TypeSafe API key</label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => rememberKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <p className="key__note mono">
            Your own key, used for your own requests. Held in this tab only and
            dropped when you close it. Never written to a database or a log.{" "}
            <a
              href="https://typesafe.ai"
              target="_blank"
              rel="noreferrer noopener"
            >
              Get one
            </a>
          </p>
        </section>

        <div className="diptych">
          <section className="panel">
            <div className="panel__head">
              <h2 id="resume-label">Your resume</h2>
              <span className="panel__note mono">PDF or paste</span>
            </div>
            <textarea
              aria-labelledby="resume-label"
              value={parsing ? "Reading the PDF…" : resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Paste your resume, or choose a PDF below…"
              spellCheck={false}
              readOnly={parsing}
            />
            <div className="drop mono">
              <label className="file-btn">
                {parsing ? "Reading\u2026" : "Choose PDF"}
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={onFile}
                  disabled={parsing}
                />
              </label>
              <span>
                {fileName
                  ? `${fileName} — read here in your browser. Edit it before sending if you like.`
                  : "The PDF is read in your browser and the text lands here for you to check."}
              </span>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2 id="job-label">The job description</h2>
              <span className="panel__note mono">Paste</span>
            </div>
            <textarea
              aria-labelledby="job-label"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the posting you are about to apply to…"
              spellCheck={false}
            />
            <div className="drop mono">
              <span>
                The whole posting works better than the bullet list alone.
              </span>
            </div>
          </section>
        </div>

        <div className="actions">
          <button className="run" onClick={run} disabled={busy || !ready}>
            {busy ? "Reading…" : "Read them together"}
          </button>
          <p className="hint mono">One pass. Usually a second or two.</p>
        </div>

        {error && <p className="err">{error}</p>}
        {report && <ReportView {...report} />}

        <footer className="colophon">
          <h2>What happens to your data</h2>
          <ul>
            <li>
              Your resume is read and scrubbed <strong>in your browser</strong>.
              Name, contact details, address, age, graduation year and
              institution are removed before anything is sent.
            </li>
            <li>
              Only the scrubbed text and the job description leave this page.
              The original never does.
            </li>
            <li>
              They go to TypeSafe Jev, hosted in the United States, which
              answers and returns the result. If you are in the EU/EEA, the UK
              or Thailand, that is a transfer outside your jurisdiction, and
              using this page is your consent to it.
            </li>
            <li>
              Nothing is stored. No database, no server logs of your text, no
              cookies, no analytics. Close the tab and there is nothing left to
              erase.
            </li>
            <li>
              Your API key is yours. It is held in this tab&rsquo;s session
              storage, sent only to authenticate your own request, and never
              persisted here.
            </li>
          </ul>
          <p>
            Do not paste anything you would not show a stranger. This is a
            drafting aid, not a hiring decision, and it makes no decision about
            anyone.
          </p>
        </footer>
      </main>
    </>
  );
}

function ReportView({ card, redacted }: Report) {
  const gap = card.items.find((item) => item.kind === "routing");
  const findings = card.items.filter((item) => item.kind !== "routing");

  return (
    <section className="report">
      <h2>What the posting asks for, and what the document evidences</h2>

      <p className="verdict">
        Each line is a claim the posting makes. Jev returns the probability that
        the document backs it up &mdash; not a score, and not a decision.
      </p>

      {findings.map((item) => (
        <Finding key={item.key} item={item} />
      ))}

      {gap && gap.kind === "routing" && <Ranked gap={gap} />}

      <div className="ledger">
        <span>{card.model}</span>
        <span>{card.latencyMs}ms</span>
        <span>{card.usage.input_tokens} tokens in</span>
        <span>{card.usage.output_tokens} out</span>
        {card.needsHumanRead && (
          <span>&#9888; read the thin lines yourself</span>
        )}
      </div>

      <details>
        <summary>What was actually sent, after scrubbing</summary>
        <pre>{redacted}</pre>
      </details>
    </section>
  );
}

function Ranked({ gap }: { gap: RoutingEvidence }) {
  const top = gap.ranked[0];

  return (
    <section className="ranked">
      <h3>What would close the gap</h3>
      <p className="ranked__note">
        Jev weighs every option, not just the winner. The bars are its own
        probabilities, so a flat spread means it is genuinely torn.
      </p>

      {gap.insufficientSignal ? (
        <p className="ranked__none">
          Not enough in the document to judge. That is Jev declining, not
          failing &mdash; a thin document should produce a shrug, not an
          invented answer.
        </p>
      ) : (
        <ol className="ranked__list">
          {gap.ranked.map(({ option, probability }) => (
            <li
              key={option}
              className={option === top?.option ? "is-top" : undefined}
            >
              <span className="ranked__label">
                {GAP_LABELS[option] ?? option}
              </span>
              <span className="ranked__bar" aria-hidden="true">
                <i style={{ width: `${Math.max(probability * 100, 0.6)}%` }} />
              </span>
              <span className="ranked__pct mono">
                {Math.round(probability * 100)}%
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="audience">
        <p>
          <strong>Applying?</strong> Start at the top of that list. It is the
          single edit that moves this document furthest for this posting.
        </p>
        <p>
          <strong>Hiring?</strong> Read the lines marked thin or not shown. They
          are where the document is silent, which is a question to ask, not a
          reason to reject.
        </p>
      </div>
    </section>
  );
}

function Finding({ item }: { item: Evidence }) {
  if (item.kind === "routing") return null;

  if (item.kind === "requirement") {
    const pct = Math.round(item.probability * 100);

    return (
      <div className="finding">
        <p className="finding__claim">{item.label}</p>
        <div>
          <div className="readout">
            <span className={`mark mark--${item.verdict}`}>
              {VERDICT_LABEL[item.verdict]}
            </span>
            <span className="readout__num mono">{pct}%</span>
          </div>
          <Scale value={item.probability} verdict={item.verdict} />
          <p className="finding__proof">{VERDICT_MEANING[item.verdict]}</p>
        </div>
      </div>
    );
  }

  const share = item.maxLevel > 0 ? item.level / item.maxLevel : 0;
  const thin = share <= 0.5;

  return (
    <div className="finding">
      <p className="finding__claim">{item.label}</p>
      <div>
        <div className="readout">
          <span className={`mark mark--${thin ? "absent" : "proven"}`}>
            {item.level} of {item.maxLevel}
          </span>
        </div>
        <Scale value={share} verdict={thin ? "absent" : "proven"} />
        <p className="finding__proof">{item.levelText}</p>
      </div>
    </div>
  );
}

function Scale({ value, verdict }: { value: number; verdict: Verdict }) {
  return (
    <div className="scale" aria-hidden="true">
      <div
        className={`scale__fill scale__fill--${verdict}`}
        style={{ width: `${value * 100}%` }}
      />
      <span className="scale__tick" style={{ left: `${BANDS.thin * 100}%` }} />
      <span
        className="scale__tick"
        style={{ left: `${BANDS.likely * 100}%` }}
      />
      <span
        className="scale__tick"
        style={{ left: `${BANDS.proven * 100}%` }}
      />
    </div>
  );
}
