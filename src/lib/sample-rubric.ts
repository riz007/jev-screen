import type { Rubric } from "./rubric";

export const SAMPLE_RUBRIC: Rubric = {
  rubricId: "sample-senior-backend",
  version: 1,
  role: "Senior Backend Engineer",
  requirements: ["5+ years production backend", "owned a service end to end"],
  items: [
    {
      kind: "requirement",
      key: "ships_production_backend",
      question:
        "Has this person shipped and operated backend services in production?",
      whenTrue:
        "Shipped and operated backend services that real users depended on",
      whenFalse:
        "Coursework, tutorials, bootcamp projects, or frontend-only work",
    },
    {
      kind: "requirement",
      key: "owned_a_service",
      question:
        "Has this person owned a service end to end, including running it?",
      whenTrue:
        "Named a service they owned, including its operation or on-call",
      whenFalse: "Contributed to services owned and operated by others",
    },
    {
      kind: "dimension",
      key: "distributed_systems_depth",
      question:
        "Rate the depth of distributed systems experience evidenced here.",
      levels: [
        "No exposure",
        "Consumed an internal API",
        "Built and shipped a service",
        "Designed for scale or partition tolerance",
        "Ran a system where an outage was a business incident",
      ],
    },
    {
      kind: "routing",
      key: "track",
      question: "Which track does this experience fit best?",
      options: {
        platform: "Infrastructure, reliability, developer tooling",
        product: "User-facing features and product surfaces",
      },
    },
  ],
};
