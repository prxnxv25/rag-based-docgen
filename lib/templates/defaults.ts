import type { DocType, TemplateSection } from "@/lib/types";

/**
 * Default section outlines, based on widely used industry structures
 * (IEEE 830 / ISO/IEC/IEEE 29148 for requirements specs, arc42 / C4 for
 * technical design, and a standard consulting-style proposal layout).
 * `guidance` tells the model what each section must cover.
 */

const FSD: TemplateSection[] = [
  {
    title: "Document control",
    guidance:
      "Table with document title, project, version [TBC], date [TBC], author [TBC], reviewers and approvers (roles from the BRD stakeholders, names [TBC]). Add a short revision history table with one initial row.",
  },
  {
    title: "Introduction",
    guidance:
      "Purpose of this document, scope (in and out, taken from the BRD analysis), intended audience, and a glossary of domain terms and acronyms used in the BRD.",
  },
  {
    title: "Business context",
    guidance:
      "Summarise the business problem and the goals the solution must achieve. List measurable success criteria where the BRD gives them. Reference the BRD requirement IDs each goal relates to.",
  },
  {
    title: "Stakeholders and roles",
    guidance:
      "Table of stakeholders and user roles with responsibilities and what each can do in the system. Include a simple role-permission matrix for the main functions.",
  },
  {
    title: "Functional overview",
    guidance:
      "System context in prose (what is inside and outside the system, actors, external systems), plus a feature summary table mapping each feature to the BRD requirement IDs it satisfies.",
  },
  {
    title: "Detailed functional requirements (flows, preconditions, alternatives)",
    guidance:
      "One subsection per feature or functional requirement. For each: ID, description, actors, preconditions, trigger, main flow (numbered steps), alternate and exception flows, postconditions, and the BRD requirement ID(s) it traces to. Use the requirement IDs from the analysis exactly.",
  },
  {
    title: "Business rules",
    guidance:
      "Numbered business rules (BR-001...) with the condition, outcome and source requirement. Include field-level validation rules and calculation or decision logic stated precisely.",
  },
  {
    title: "Data requirements",
    guidance:
      "Key business entities, their attributes, mandatory/optional status, formats and constraints, relationships in plain language, data retention and archival needs. Table format preferred.",
  },
  {
    title: "UI behavior",
    guidance:
      "Screens or interaction points implied by the requirements, what each shows and allows, navigation, messages and error states, and accessibility expectations. Describe behaviour, not visual design.",
  },
  {
    title: "Reports and integrations",
    guidance:
      "Reports and dashboards, notifications and alerts (trigger, recipient, content), and external systems the functionality depends on, described from a functional point of view.",
  },
  {
    title: "Non-functional requirements",
    guidance:
      "Performance, availability, security and privacy, auditability, usability, compliance and any other quality requirements, each with a measurable target if the BRD gives one, otherwise marked [TBC]. Trace to requirement IDs.",
  },
  {
    title: "Acceptance criteria (Given/When/Then)",
    guidance:
      "For each major functional requirement, testable acceptance criteria in Given/When/Then form, referencing the requirement ID.",
  },
  {
    title: "Assumptions and constraints",
    guidance:
      "Assumptions, dependencies on other teams, systems or decisions, and constraints, taken from the analysis. Separate lists.",
  },
  {
    title: "Open issues and risks",
    guidance:
      "Unresolved questions (with the answers the user supplied where available), and functional risks with likelihood, impact and mitigation.",
  },
];

const TSD: TemplateSection[] = [
  {
    title: "Document control",
    guidance:
      "Table with document title, project, version [TBC], date [TBC], author [TBC], reviewers and approvers by role. Short revision history table.",
  },
  {
    title: "Introduction",
    guidance:
      "Purpose, technical scope, audience, references to the BRD and FSD, and key technical terms.",
  },
  {
    title: "Architecture overview (include a Mermaid diagram)",
    guidance:
      "Architecture style and the reasoning for it, a context description, major building blocks and how they interact, and the key architectural decisions with the alternatives considered and why they were rejected. Include a text-based component diagram (Mermaid in a fenced code block).",
  },
  {
    title: "Technology stack",
    guidance:
      "Table of technology choices per layer (front end, back end, data, integration, hosting, CI/CD, observability) with rationale. Respect any technology constraints in the BRD; where none are given, propose sensible defaults and mark them as proposals.",
  },
  {
    title: "Component design",
    guidance:
      "For each component or module: responsibility, interfaces, key classes or services, dependencies, and the requirement IDs it implements.",
  },
  {
    title: "Data model",
    guidance:
      "Logical data model with entities, key attributes, keys and relationships (Mermaid ER diagram in a fenced code block plus a table), storage choices, data flow, retention, backup and migration of existing data if the BRD implies it.",
  },
  {
    title: "API and integration design",
    guidance:
      "Internal and external interfaces: endpoint or message list with method, path or topic, purpose, request and response shape, authentication, error codes, and integration patterns (sync, async, batch). Cover every integration implied by the BRD.",
  },
  {
    title: "Security",
    guidance:
      "Authentication, authorisation model, data protection in transit and at rest, secrets management, audit logging, threat considerations and compliance obligations that appear in the BRD.",
  },
  {
    title: "Infrastructure and deployment",
    guidance:
      "Environments, hosting topology, deployment pipeline, configuration management, release and rollback approach, and infrastructure sizing assumptions.",
  },
  {
    title: "Performance and availability",
    guidance:
      "How the design meets each non-functional requirement: expected load assumptions, scaling approach, caching, resilience, disaster recovery targets. State targets from the BRD or mark [TBC].",
  },
  {
    title: "Error handling and monitoring",
    guidance:
      "Error classification and handling strategy, logging standards, metrics, alerting and operational support model.",
  },
  {
    title: "Testing strategy",
    guidance:
      "Test levels (unit, integration, system, UAT, performance, security), tooling, test data, environments, entry/exit criteria, and how acceptance criteria from the FSD will be verified.",
  },
  {
    title: "Technical risks",
    guidance:
      "Technical risks with mitigation, assumptions, and open technical decisions, including the answers the user supplied to open questions.",
  },
];

const SPD: TemplateSection[] = [
  {
    title: "Executive summary",
    guidance:
      "One page. The client's problem, the proposed solution in two or three sentences, the main benefits, the high-level approach and what is being asked of the client. Written for a senior non-technical reader.",
  },
  {
    title: "Understanding of the requirement",
    guidance:
      "Restate the client's context, goals, stakeholders and key requirements in your own words to show understanding. Reference the requirement IDs. Call out the points that most influence the solution.",
  },
  {
    title: "Proposed solution",
    guidance:
      "What is being proposed and how it meets the goals. Describe capabilities in business terms, mapped to the main requirement groups. Include a table mapping requirement group to solution capability.",
  },
  {
    title: "Solution architecture",
    guidance:
      "High-level architecture in plain language with a Mermaid diagram in a fenced code block. Mention key technology choices and why, consistent with the BRD constraints. Keep it non-deep-technical; point to the TSD for detail.",
  },
  {
    title: "Scope",
    guidance:
      "In-scope and out-of-scope items as two lists, derived from the BRD analysis, plus change-control note.",
  },
  {
    title: "Delivery approach (Agile phases)",
    guidance:
      "Phased delivery plan using an iterative, Agile-style approach unless the BRD dictates otherwise: phases or increments, what each delivers, how feedback and demos work, quality gates and handover.",
  },
  {
    title: "Timeline and milestones",
    guidance:
      "Milestone table with phase, deliverable and timing. Use dates or durations only when the BRD or user answers provide them; otherwise put [TBC] for timing.",
  },
  {
    title: "Team and governance",
    guidance:
      "Proposed roles and responsibilities on both sides, governance forums and cadence, escalation path and reporting.",
  },
  {
    title: "Assumptions",
    guidance:
      "Assumptions the proposal relies on and dependencies on the client or third parties, from the analysis plus any needed to make the proposal coherent.",
  },
  {
    title: "Risks and mitigations",
    guidance:
      "Table of risks with likelihood, impact, mitigation and owner role. Draw on the analysis risks.",
  },
  {
    title: "Effort and commercials (no invented prices; use [TBC])",
    guidance:
      "Do not invent prices or day rates. Provide an effort breakdown by phase as indicative ranges only if the BRD supports estimation; otherwise provide the table structure with [TBC] values and list what is needed to complete it. State the commercial model options (fixed price, time and materials) neutrally.",
  },
  {
    title: "Benefits and success measures",
    guidance:
      "Expected business benefits and how success will be measured, using targets from the BRD or marked [TBC].",
  },
  {
    title: "Next steps",
    guidance:
      "Concrete next steps and decisions needed from the client to proceed, with the open questions that still block a firm proposal.",
  },
];

export const DEFAULT_OUTLINES: Record<DocType, TemplateSection[]> = {
  fsd: FSD,
  tsd: TSD,
  spd: SPD,
};
