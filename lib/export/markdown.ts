import type { Analysis, DocSection, DocType } from "@/lib/types";
import { DOC_LABELS } from "@/lib/types";
import { buildTrace } from "@/lib/trace";

export function docToMarkdown(args: {
  docType: DocType;
  projectName: string;
  version: number;
  sections: DocSection[];
  analysis: Analysis | null;
}): string {
  const { docType, projectName, version, sections, analysis } = args;
  const date = new Date().toISOString().slice(0, 10);
  const parts: string[] = [
    `# ${DOC_LABELS[docType]}`,
    `**Project:** ${projectName}  \n**Version:** ${version}  \n**Date:** ${date}`,
  ];
  sections.forEach((s, i) => {
    parts.push(`## ${i + 1}. ${s.title}\n\n${s.content.trim() || "_Not yet written._"}`);
  });

  if (analysis) {
    const trace = buildTrace(analysis, { [docType]: sections });
    const lines = [
      `## Appendix A. Requirements Traceability`,
      "",
      `| ID | Requirement | Type | Priority | Covered in |`,
      `| --- | --- | --- | --- | --- |`,
      ...trace.rows.map((r) => {
        const where = r.refs[docType].length ? r.refs[docType].join("; ") : "Not covered";
        return `| ${r.id} | ${r.title.replace(/\|/g, "/")} | ${r.type} | ${r.priority} | ${where.replace(/\|/g, "/")} |`;
      }),
    ];
    parts.push(lines.join("\n"));
  }
  return parts.join("\n\n") + "\n";
}
