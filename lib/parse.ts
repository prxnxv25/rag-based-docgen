import { HttpError } from "@/lib/api";
import { LIMITS } from "@/lib/types";

function clean(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}


function stripTags(html: string): string {
  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Converts mammoth's HTML to Markdown, keeping headings, lists and tables. */
function htmlToMarkdown(html: string): string {
  let s = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, inner: string) => {
    const rows = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
      [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) =>
        stripTags(c[1]).replace(/\s+/g, " ").replace(/\|/g, "/").trim(),
      ),
    );
    if (!rows.length) return "";
    const cols = Math.max(...rows.map((r) => r.length));
    const line = (r: string[]) =>
      "| " + Array.from({ length: cols }, (_, i) => r[i] ?? "").join(" | ") + " |";
    return (
      "\n\n" +
      [line(rows[0]), "| " + Array(cols).fill("---").join(" | ") + " |", ...rows.slice(1).map(line)].join(
        "\n",
      ) +
      "\n\n"
    );
  });
  s = s.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_m, level: string, text: string) => `\n\n${"#".repeat(Number(level))} ${stripTags(text).trim()}\n\n`,
  );
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, text: string) => `\n- ${stripTags(text).trim()}`);
  s = s.replace(/<\/(p|ul|ol)>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n");
  return stripTags(s);
}

/** Extracts text from an uploaded .docx, .pdf, .txt or .md file. */
export async function fileToText(file: File): Promise<string> {
  if (file.size > LIMITS.maxUploadBytes) {
    throw new HttpError(
      413,
      `"${file.name}" is larger than ${LIMITS.maxUploadBytes / 1024 / 1024} MB.`,
    );
  }
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".docx")) {
    // HTML keeps headings, lists and tables, which matters when reading templates.
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.convertToHtml({ buffer: buf });
    return clean(htmlToMarkdown(result.value));
  }

  if (name.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const result = await parser.getText();
      return clean(result.text);
    } finally {
      await parser.destroy();
    }
  }

  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
    return clean(buf.toString("utf8"));
  }

  throw new HttpError(
    415,
    `"${file.name}" is not supported. Upload a .docx, .pdf, .txt or .md file.`,
  );
}
