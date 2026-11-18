export type DocType = "fsd" | "tsd" | "spd";

export const DOC_TYPES: DocType[] = ["fsd", "tsd", "spd"];

export const DOC_LABELS: Record<DocType, string> = {
  fsd: "Functional Specification Document (FSD)",
  tsd: "Technical Specification Document (TSD)",
  spd: "Solution Proposal Document (SPD)",
};

export const DOC_SHORT: Record<DocType, string> = {
  fsd: "FSD",
  tsd: "TSD",
  spd: "SPD",
};

export function isDocType(v: unknown): v is DocType {
  return v === "fsd" || v === "tsd" || v === "spd";
}

/** One section of a template: what to write about, not the written text. */
export interface TemplateSection {
  title: string;
  guidance: string;
}

/** One section of a generated document. */
export interface DocSection {
  id: string;
  title: string;
  guidance: string;
  content: string;
}

export interface Requirement {
  id: string; // e.g. FR-001, NFR-002, CON-001
  type: "functional" | "non-functional" | "constraint";
  title: string;
  description: string;
  priority: "must" | "should" | "could" | "unspecified";
}

export interface OpenQuestion {
  id: string; // Q-001
  question: string;
  why: string;
  suggestedDefault: string;
}

export interface Analysis {
  projectName: string;
  summary: string;
  businessGoals: string[];
  stakeholders: { name: string; role: string; interest: string }[];
  scope: { inScope: string[]; outOfScope: string[] };
  requirements: Requirement[];
  assumptions: string[];
  constraints: string[];
  risks: string[];
  openQuestions: OpenQuestion[];
}

export type Outline = Record<DocType, TemplateSection[]>;

export const LIMITS = {
  maxUploadBytes: 8 * 1024 * 1024,
  maxBrdChars: 120_000,
  maxTemplateChars: 60_000,
  maxContextChars: 24_000,
};
