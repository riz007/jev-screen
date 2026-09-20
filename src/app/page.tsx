"use client";

import { useEffect, useRef, useState } from "react";
import type { Evidence, EvidenceCard } from "@/lib/evidence";
import { redact } from "@/lib/redact";

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
    throw new Error([data.error, data.detail].filter(Boolean).join("\n") || "could not read that");
  }

  return data as unknown as Report;
}

export default function Page() {
  const [apiKey, setApiKey] = useState("");
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

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
    (resume.trim().length > 0 || fileRef.current !== null);

  async function run() {
    setBusy(true);
    setError(null);
    setReport(null);

    try {
      let text = resume;

      if (!text.trim() && fileRef.current) {
        const { pdfToMarkdown } = await import("@/lib/pdf");
        text = await pdfToMarkdown(new Uint8Array(await fileRef.current.arrayBuffer()));
      }

      const response = await fetch("/api/gap", {
        method: "POST",
        headers: { "content-type": "application/json", "x-typesafe-key": apiKey.trim() },
        body: JSON.stringify({ resume: redact(text), jobDescription }),
      });

      setReport(await readReport(response));
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not read that");
    } finally {
      setBusy(false);
    }
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    fileRef.current = file;
    setFileName(file?.name ?? null);
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
          <h1>A job description is a list of claims. Your resume either proves them or it doesn&rsquo;t.</h1>
          <p>
            Paste both. You get back what this job asks for that your resume cannot
            currently back up, and the one change that would close the widest gap.
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
            Your own key, used for your own requests. Held in this tab only and dropped
            when you close it. Never written to a database or a log.{" "}
            <a href="https://typesafe.ai" target="_blank" rel="noreferrer noopener">
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
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Paste your resume, or choose a PDF below…"
              spellCheck={false}
            />
            <div className="drop mono">
              <label className="file-btn">
                Choose PDF
                <input type="file" accept="application/pdf" onChange={onFile} />
              </label>
              <span>{fileName ?? "Read in your browser. Identifying details are stripped before sending."}</span>
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
              <span>The whole posting works better than the bullet list alone.</span>
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
              Your resume is read and scrubbed <strong>in your browser</strong>. Name,
              contact details, address, age, graduation year and institution are removed
              before anything is sent.
            </li>
            <li>
              Only the scrubbed text and the job description leave this page. The
              original never does.
            </li>
            <li>
              They go to TypeSafe Jev, hosted in the United States, which answers and
              returns the result. If you are in the EU/EEA, the UK or Thailand, that is
              a transfer outside your jurisdiction, and using this page is your consent
              to it.
            </li>
            <li>
              Nothing is stored. No database, no server logs of your text, no cookies,
              no analytics. Close the tab and there is nothing left to erase.
            </li>
            <li>
              Your API key is yours. It is held in this tab&rsquo;s session storage,
              sent only to authenticate your own request, and never persisted here.
            </li>
          </ul>
          <p>
            Do not paste anything you would not show a stranger. This is a drafting aid,
            not a hiring decision, and it makes no decision about anyone.
          </p>
        </footer>
      </main>
    </>
  );
}

function ReportView({ card, redacted }: Report) {
  const gap = card.items.find((item) => item.kind === "routing");
  const gapText = gap && gap.kind === "routing" ? GAP_LABELS[gap.selected] : null;

  return (
    <section className="report">
      <h2>What this job asks for, and what your resume backs up</h2>

      {gapText && (
        <p className="verdict">
          The widest gap is <strong>{gapText}</strong>.
        </p>
      )}

      {card.items.map((item) => (
        <Finding key={item.key} item={item} />
      ))}

      <div className="ledger">
        <span>{card.model}</span>
        <span>{card.latencyMs}ms</span>
        <span>{card.usage.input_tokens} tokens in</span>
        {card.needsHumanRead && <span>read the flagged lines yourself</span>}
      </div>

      <details>
        <summary>What was actually sent, after scrubbing</summary>
        <pre>{redacted}</pre>
      </details>
    </section>
  );
}

function Finding({ item }: { item: Evidence }) {
  if (item.kind === "routing") return null;

  if (item.kind === "requirement") {
    const mark =
      item.verdict === "yes" ? "proven" : item.verdict === "no" ? "unproven" : "unclear";

    return (
      <div className="finding">
        <p className="finding__claim">{item.label}</p>
        <div>
          <span className={`mark mark--${mark}`}>{mark}</span>
          <div className={`gauge${mark === "unproven" ? " gauge--unproven" : ""}`}>
            <i style={{ width: `${Math.round(item.probability * 100)}%` }} />
          </div>
          <p className="finding__proof mono">
            {Math.round(item.probability * 100)}% confident this is evidenced
          </p>
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
        <span className={`mark mark--${thin ? "unproven" : "proven"}`}>
          {item.level} of {item.maxLevel}
        </span>
        <div className={`gauge${thin ? " gauge--unproven" : ""}`}>
          <i style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
        <p className="finding__proof">{item.levelText}</p>
      </div>
    </div>
  );
}
