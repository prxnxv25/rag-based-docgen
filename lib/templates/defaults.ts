import type { DocType, TemplateSection } from "@/lib/types";

/**
 * Default section outlines, based on widely used industry structures
 * (IEEE 830 / ISO/IEC/IEEE 29148 for requirements specs, arc42 / C4 for
 * technical design, and a standard consulting-style proposal layout).
 * `guidance` tells the model what each section must cover.
 */

const FSD: TemplateSection[] = [
  {
    title: "Document Control",
    guidance:
      "Table with document title, project, version (1.0 Draft), date, author (leave as [TBC]), reviewers and approvers (roles from the BRD stakeholders, names [TBC]). Add a short revision history table with one initial row.",
  },
  {
    title: "Introduction",
    guidance:
      "Purpose of this document, scope (in and out, taken from the BRD analysis), intended audience, and a glossary of domain terms and acronyms used in the BRD.",
  },
  {
    title: "Business Context and Objectives",
    guidance:
      "Summarise the business problem and the goals the solution must achieve. List measurable success criteria where the BRD gives them. Reference the BRD requirement IDs each goal relates to.",
  },
  {
    title: "Stakeholders and User Roles",
    guidance:
      "Table of stakeholders and user roles with responsibilities and what each can do in the system. Include a simple role-permission matrix for the main functions.",
  },
  {
    title: "Functional Overview",
    guidance:
      "System context in prose (what is inside and outside the system, actors, external systems), plus a feature summary table mapping each feature to the BRD requirement IDs it satisfies.",
  },
  {
    title: "Detailed Functional Requirements",
    guidance:
      "One subsection per feature or functional requirement. For each: ID, description, actors, preconditions, trigger, main flow (numbered steps), alternate and exception flows, postconditions, and the BRD requirement ID(s) it traces to. Use the requirement IDs from the analysis exactly.",
  },
  {
    title: "Business Rules and Validations",
    guidance:
      "Numbered business rules (BR-001...) with the condition, outcome and source requirement. Include field-level validation rules and calculation or decision logic stated precisely.",
  },
  {
    title: "Data Requirements",
    guidance:
      "Key business entities, their attributes, mandatory/optional status, formats and constraints, relationships in plain language, data retention and archival needs. Table format preferred.",
  },
  {
    title: "User Interface and Interaction Behaviour",
    guidance:
      "Screens or interaction points implied by the requirements, what each shows and allows, navigation, messages and error states, and accessibility expectations. Describe behaviour, not visual design.",
  },
  {
    title: "Reports, Notifications and Integrations",
    guidance:
      "Reports and dashboards, notifications and alerts (trigger, recipient, content), and external systems the functionality depends on, described from a functional point of view.",
  },
  {
    title: "Non-Functional Requirements",
    guidance:
      "Performance, availability, security and privacy, auditability, usability, compliance and any other quality requirements, each with a measurable target if the BRD gives one, otherwise marked [TBC]. Trace to requirement IDs.",
  },
  {
    title: "Acceptance Criteria",
    guidance:
      "For each major functional requirement, testable acceptance criteria in Given/When/Then form, referencing the requirement ID.",
  },
  {
    title: "Assumptions, Dependencies and Constraints",
    guidance:
      "Assumptions, dependencies on other teams, systems or decisions, and constraints, taken from the analysis. Separate lists.",
  },
  {
    title: "Open Issues and Risks",
    guidance:
      "Unresolved questions (with the answers the user supplied where available), and functional risks with likelihood, impact and mitigation.",
  },
];

const TSD: TemplateSection[] = [
  {
    title: "Document Control",
    guidance:
      "Table with document title, project, version (1.0 Draft), date, author [TBC], reviewers and approvers by role. Short revision history table.",
  },
  {
    title: "Introduction and Technical Scope",
    guidance:
      "Purpose, technical scope, audience, references to the BRD and FSD, and key technical terms.",
  },
  {
    title: "Architecture Overview",
    guidance:
      "Architecture style and the reasoning for it, a context description, major building blocks and how they interact, and the key architectural decisions with the alternatives considered and why they were rejected. Include a text-based component diagram (Mermaid in a fenced code block).",
  },
  {
    title: "Technology Stack",
    guidance:
      "Table of technology choices per layer (front end, back end, data, integration, hosting, CI/CD, observability) with rationale. Respect any technology constraints in the BRD; where none are given, propose sensible defaults and mark them as proposals.",
  },
  {
    title: "Component Design",
    guidance:
      "For each component or module: responsibility, interfaces, key classes or services, dependencies, and the requirement IDs it implements.",
  },
  {
    title: "Data Architecture and Data Model",
    guidance:
      "Logical data model with entities, key attributes, keys and relationships (Mermaid ER diagram in a fenced code block plus a table), storage choices, data flow, retention, backup and migration of existing data if the BRD implies it.",
  },
  {
    title: "API and Integration Design",
    guidance:
      "Internal and external interfaces: endpoint or message list with method, path or topic, purpose, request and response shape, authentication, error codes, and integration patterns (sync, async, batch). Cover every integration implied by the BRD.",
  },
  {
    title: "Security Architecture",
    guidance:
      "Authentication, authorisation model, data protection in transit and at rest, secrets management, audit logging, threat considerations and compliance obligations that appear in the BRD.",
  },
  {
    title: "Infrastructure and Deployment",
    guidance:
      "Environments, hosting topology, deployment pipeline, configuration management, release and rollback approach, and infrastructure sizing assumptions.",
  },
  {
    title: "Performance, Scalability and Availability",
    guidance:
      "How the design meets each non-functional requirement: expected load assumptions, scaling approach, caching, resilience, disaster recovery targets. State targets from the BRD or mark [TBC].",
  },
  {
    title: "Error Handling, Logging and Monitoring",
    guidance:
      "Error classification and handling strategy, logging standards, metrics, alerting and operational support model.",
  },
  {
    title: "Testing Strategy",
    guidance:
      "Test levels (unit, integration, system, UAT, performance, security), tooling, test data, environments, entry/exit criteria, and how acceptance criteria from the FSD will be verified.",
  },
  {
    title: "Technical Risks, Assumptions and Open Items",
    guidance:
      "Technical risks with mitigation, assumptions, and open technical decisions, including the answers the user supplied to open questions.",
  },
];

const SPD: TemplateSection[] = [
  {
    title: "Executive Summary",
    guidance:
      "One page. The client's problem, the proposed solution in two or three sentences, the main benefits, the high-level approach and what is being asked of the client. Written for a senior non-technical reader.",
  },
  {
    title: "Understanding of the Requirement",
    guidance:
      "Restate the client's context, goals, stakeholders and key requirements in your own words to show understanding. Reference the requirement IDs. Call out the points that most influence the solution.",
  },
  {
    title: "Proposed Solution",
    guidance:
      "What is being proposed and how it meets the goals. Describe capabilities in business terms, mapped to the main requirement groups. Include a table mapping requirement group to solution capability.",
  },
  {
    title: "Solution Architecture",
    guidance:
      "High-level architecture in plain language with a Mermaid diagram in a fenced code block. Mention key technology choices and why, consistent with the BRD constraints. Keep it non-deep-technical; point to the TSD for detail.",
  },
  {
    title: "Scope",
    guidance:
      "In-scope and out-of-scope items as two lists, derived from the BRD analysis, plus change-control note.",
  },
  {
    title: "Delivery Approach and Methodology",
    guidance:
      "Phased delivery plan using an iterative, Agile-style approach unless the BRD dictates otherwise: phases or increments, what each delivers, how feedback and demos work, quality gates and handover.",
  },
  {
    title: "Timeline and Milestones",
    guidance:
      "Indicative milestone table (phase, deliverable, relative timing such as 'Week 1-4'). Use dates only if the BRD gives them; otherwise relative durations marked as indicative.",
  },
  {
    title: "Team and Governance",
    guidance:
      "Proposed roles and responsibilities on both sides, governance forums and cadence, escalation path and reporting.",
  },
  {
    title: "Assumptions and Dependencies",
    guidance:
      "Assumptions the proposal relies on and dependencies on the client or third parties, from the analysis plus any needed to make the proposal coherent.",
  },
  {
    title: "Risks and Mitigations",
    guidance:
      "Table of risks with likelihood, impact, mitigation and owner role. Draw on the analysis risks.",
  },
  {
    title: "Effort and Commercials",
    guidance:
      "Do not invent prices or day rates. Provide an effort breakdown by phase as indicative ranges only if the BRD supports estimation; otherwise provide the table structure with [TBC] values and list what is needed to complete it. State the commercial model options (fixed price, time and materials) neutrally.",
  },
  {
    title: "Benefits and Success Measures",
    guidance:
      "Expected business benefits and how success will be measured, using targets from the BRD or marked [TBC].",
  },
  {
    title: "Next Steps",
    guidance:
      "Concrete next steps and decisions needed from the client to proceed, with the open questions that still block a firm proposal.",
  },
];

export const DEFAULT_OUTLINES: Record<DocType, TemplateSection[]> = {
  fsd: FSD,
  tsd: TSD,
  spd: SPD,
};
