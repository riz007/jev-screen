import type { Rubric } from "./rubric";

export const GAP_RUBRIC: Rubric = {
  rubricId: "resume-vs-job",
  version: 1,
  role: "this job description",
  requirements: [],
  items: [
    {
      kind: "requirement",
      key: "proves_core_skills",
      label: "Does it prove the skills this job asks for?",
      question:
        "The resume proves the primary technical skills the job description asks for.",
      whenTrue:
        "The resume shows these skills used in real work, not only listed",
      whenFalse:
        "The skills are absent, or named in a list with nothing behind them",
    },
    {
      kind: "requirement",
      key: "proves_scope",
      label: "Does it prove ownership at this level?",
      question:
        "The resume shows ownership at the scope the job description asks for.",
      whenTrue:
        "The candidate owned work at or above the level the job describes",
      whenFalse: "The work described sits below the level the job describes",
    },
    {
      kind: "requirement",
      key: "proves_domain",
      label: "Does it prove experience in this domain?",
      question:
        "The resume shows experience in the domain or industry the job description names.",
      whenTrue:
        "The candidate has worked in this domain or one that transfers directly",
      whenFalse: "The domain is absent and no adjacent experience is described",
    },
    {
      kind: "dimension",
      key: "evidence_quality",
      label: "How concrete is the evidence?",
      question: "Rate how concrete the evidence in this resume is.",
      levels: [
        "Lists technologies with no context",
        "Describes responsibilities without results",
        "Describes work done, with some specifics",
        "Names concrete outcomes, with scale or numbers",
        "Names outcomes, scale, and what this person specifically did",
      ],
    },
    {
      kind: "dimension",
      key: "coverage",
      label: "How much of this job does it cover?",
      question: "Rate how much of what the job asks for this resume evidences.",
      levels: [
        "Almost nothing the job asks for is evidenced",
        "A minority of what the job asks for is evidenced",
        "About half of what the job asks for is evidenced",
        "Most of what the job asks for is evidenced",
        "Everything the job names is evidenced",
      ],
    },
    {
      kind: "routing",
      key: "biggest_gap",
      label: "What would help most?",
      question:
        "Which single thing would most improve this resume's case for this job?",
      options: {
        core_skills: "Showing the primary skills actually used in real work",
        scope_and_ownership: "Showing ownership at the level the job describes",
        domain_experience: "Showing experience in the domain the job names",
        measurable_outcomes:
          "Turning responsibilities into concrete, measured outcomes",
        nothing_significant:
          "The resume already makes a strong case for this job",
      },
    },
  ],
};
