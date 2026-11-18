import type { Analysis, DocSection, DocType } from "@/lib/types";
import { DOC_TYPES } from "@/lib/types";

export interface TraceRow {
  id: string;
  title: string;
  type: string;
  priority: string;
  refs: Record<DocType, string[]>; // section titles that cite this requirement
}

export interface TraceResult {
  rows: TraceRow[];
  /** Requirement IDs cited in a document that do not exist in the analysis. */
  unknownRefs: Record<DocType, string[]>;
  coverage: Record<DocType, { covered: number; total: number }>;
}

const ID_PATTERN = /\[([A-Z]{2,5}-\d{1,4})\]/g;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a requirement-to-document traceability matrix by finding the
 * requirement IDs each generated section cites.
 */
export function buildTrace(
  analysis: Analysis,
  docs: Partial<Record<DocType, DocSection[]>>,
): TraceResult {
  const known = new Set(analysis.requirements.map((r) => r.id));

  const rows: TraceRow[] = analysis.requirements.map((r) => {
    const refs = { fsd: [], tsd: [], spd: [] } as Record<DocType, string[]>;
    const re = new RegExp(`\\[${escapeRegExp(r.id)}\\]`);
    for (const t of DOC_TYPES) {
      for (const s of docs[t] ?? []) {
        if (re.test(s.content)) refs[t].push(s.title);
      }
    }
    return { id: r.id, title: r.title, type: r.type, priority: r.priority, refs };
  });

  const unknownRefs = { fsd: [], tsd: [], spd: [] } as Record<DocType, string[]>;
  for (const t of DOC_TYPES) {
    const seen = new Set<string>();
    for (const s of docs[t] ?? []) {
      for (const match of s.content.matchAll(ID_PATTERN)) {
        const id = match[1];
        if (id && !known.has(id)) seen.add(id);
      }
    }
    unknownRefs[t] = [...seen].sort();
  }

  const coverage = {} as TraceResult["coverage"];
  for (const t of DOC_TYPES) {
    coverage[t] = {
      covered: rows.filter((r) => r.refs[t].length > 0).length,
      total: rows.length,
    };
  }
  return { rows, unknownRefs, coverage };
}
