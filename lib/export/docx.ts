import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import type { Analysis, DocSection, DocType } from "@/lib/types";
import { DOC_LABELS } from "@/lib/types";
import { buildTrace } from "@/lib/trace";

const FONT = "Calibri";
const MONO = "Consolas";
const CONTENT_WIDTH = 9026; // A4 with 1" margins, in DXA

/* ---------------------------- inline markdown --------------------------- */

function inline(text: string, base: { bold?: boolean; italics?: boolean; size?: number } = {}): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    const tok = m[0];
    if (tok.startsWith("**") || tok.startsWith("__")) {
      runs.push(new TextRun({ text: tok.slice(2, -2), font: FONT, ...base, bold: true }));
    } else if (tok.startsWith("`")) {
      runs.push(
        new TextRun({
          text: tok.slice(1, -1),
          font: MONO,
          size: (base.size ?? 22) - 2,
          shading: { type: ShadingType.CLEAR, fill: "F1F5F9", color: "auto" },
        }),
      );
    } else {
      runs.push(new TextRun({ text: tok.slice(1, -1), font: FONT, ...base, italics: true }));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return runs.length ? runs : [new TextRun({ text: "", font: FONT })];
}

/* ------------------------------- tables -------------------------------- */

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim().replace(/<br\s*\/?>/gi, "\n"));
}

function makeTable(rows: string[][]): Table {
  const cols = Math.max(...rows.map((r) => r.length));
  const colW = Math.floor(CONTENT_WIDTH / cols);
  const widths = Array.from({ length: cols }, (_, i) =>
    i === cols - 1 ? CONTENT_WIDTH - colW * (cols - 1) : colW,
  );
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map(
      (r, ri) =>
        new TableRow({
          tableHeader: ri === 0,
          children: widths.map(
            (w, ci) =>
              new TableCell({
                borders,
                width: { size: w, type: WidthType.DXA },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                shading:
                  ri === 0 ? { type: ShadingType.CLEAR, fill: "E2E8F0", color: "auto" } : undefined,
                children: (r[ci] ?? "").split("\n").map(
                  (line) =>
                    new Paragraph({
                      children: inline(line, { bold: ri === 0, size: 20 }),
                    }),
                ),
              }),
          ),
        }),
    ),
  });
}

/* ------------------------------ block parse ----------------------------- */

type Block = Paragraph | Table;

function markdownToBlocks(md: string, listInstance: { n: number }): Block[] {
  const out: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let inNumbered = false;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code (including mermaid): rendered as monospace text
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, "").trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      if (lang) {
        out.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({
                text: lang === "mermaid" ? "Diagram source (Mermaid):" : lang,
                font: FONT,
                italics: true,
                size: 18,
                color: "64748B",
              }),
            ],
          }),
        );
      }
      for (const c of code) {
        out.push(
          new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9", color: "auto" },
            spacing: { after: 0 },
            children: [new TextRun({ text: c || " ", font: MONO, size: 18 })],
          }),
        );
      }
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      inNumbered = false;
      continue;
    }

    // table
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const rows: string[][] = [splitRow(line)];
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      out.push(makeTable(rows));
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      inNumbered = false;
      continue;
    }

    // headings inside content start at level 2
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length <= 3 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      out.push(new Paragraph({ heading: level, children: inline(h[2].trim()) }));
      i++;
      inNumbered = false;
      continue;
    }

    // bullets
    const b = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (b) {
      const level = Math.min(Math.floor(b[1].replace(/\t/g, "  ").length / 2), 3);
      out.push(
        new Paragraph({
          numbering: { reference: "bullets", level },
          children: inline(b[2]),
        }),
      );
      i++;
      inNumbered = false;
      continue;
    }

    // numbered
    const n = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (n) {
      if (!inNumbered) listInstance.n += 1;
      inNumbered = true;
      const level = Math.min(Math.floor(n[1].replace(/\t/g, "  ").length / 3), 3);
      out.push(
        new Paragraph({
          numbering: { reference: "numbers", level, instance: listInstance.n },
          children: inline(n[2]),
        }),
      );
      i++;
      continue;
    }

    // blockquote
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      out.push(
        new Paragraph({
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "94A3B8", space: 8 } },
          children: inline(q[1], { italics: true }),
        }),
      );
      i++;
      inNumbered = false;
      continue;
    }

    // blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // paragraph: merge soft-wrapped lines
    const para: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(\s*```|\s*\||#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|>)/.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    out.push(new Paragraph({ spacing: { after: 120 }, children: inline(para.join(" ")) }));
    inNumbered = false;
  }
  return out;
}

/* -------------------------------- document ------------------------------ */

function bulletLevels() {
  const marks = ["•", "◦", "▪", "–"];
  return marks.map((text, level) => ({
    level,
    format: LevelFormat.BULLET,
    text,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 540 + level * 360, hanging: 270 } } },
  }));
}

function numberLevels() {
  const fmts = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL];
  return fmts.map((format, level) => ({
    level,
    format,
    text: `%${level + 1}.`,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 540 + level * 360, hanging: 360 } } },
  }));
}

export async function docToDocx(args: {
  docType: DocType;
  projectName: string;
  version: number;
  sections: DocSection[];
  analysis: Analysis | null;
}): Promise<Buffer> {
  const { docType, projectName, version, sections, analysis } = args;
  const listInstance = { n: 0 };
  const date = new Date().toISOString().slice(0, 10);
  const children: Block[] = [];

  // Title block
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { before: 1200, after: 200 },
      children: [new TextRun({ text: DOC_LABELS[docType], font: FONT, bold: true, size: 44 })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: projectName, font: FONT, size: 32, color: "334155" })],
    }),
    new Paragraph({
      spacing: { after: 600 },
      children: [
        new TextRun({ text: `Version ${version}  |  ${date}`, font: FONT, size: 22, color: "64748B" }),
      ],
    }),
  );

  sections.forEach((s, idx) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: idx === 0,
        children: [new TextRun({ text: `${idx + 1}. ${s.title}`, font: FONT })],
      }),
    );
    if (s.content.trim()) {
      children.push(...markdownToBlocks(s.content, listInstance));
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Not yet written.", italics: true, font: FONT, color: "94A3B8" })],
        }),
      );
    }
  });

  if (analysis) {
    const trace = buildTrace(analysis, { [docType]: sections });
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun({ text: "Appendix A. Requirements Traceability", font: FONT })],
      }),
      makeTable([
        ["ID", "Requirement", "Priority", "Covered in"],
        ...trace.rows.map((r) => [
          r.id,
          r.title,
          r.priority,
          r.refs[docType].length ? r.refs[docType].join("; ") : "Not covered",
        ]),
      ]),
    );
  }

  const doc = new Document({
    creator: "BRD Document Generator",
    title: `${DOC_LABELS[docType]} - ${projectName}`,
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          run: { size: 44, bold: true, font: FONT, color: "0F172A" },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: FONT, color: "0F172A" },
          paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: FONT, color: "1E293B" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 23, bold: true, font: FONT, color: "334155" },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: bulletLevels() },
        { reference: "numbers", levels: numberLevels() },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${projectName}  |  Page `, font: FONT, size: 18, color: "64748B" }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "64748B" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
