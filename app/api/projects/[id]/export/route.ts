import { desc, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { HttpError, getOwnedProject, handle, requireUser } from "@/lib/api";
import { docToDocx } from "@/lib/export/docx";
import { docToMarkdown } from "@/lib/export/markdown";
import { isDocType } from "@/lib/types";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

function fileSafe(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "project";
}

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, userId);

  const url = new URL(req.url);
  const docType = url.searchParams.get("docType");
  const format = url.searchParams.get("format") ?? "docx";
  if (!isDocType(docType)) throw new HttpError(400, "Unknown document type.");
  if (format !== "docx" && format !== "md") throw new HttpError(400, "Unknown format.");

  const [doc] = await getDb()
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.projectId, id), eq(schema.documents.docType, docType)))
    .orderBy(desc(schema.documents.version))
    .limit(1);
  if (!doc) throw new HttpError(404, "Nothing has been saved for this document yet.");

  const args = {
    docType,
    projectName: project.analysis?.projectName || project.title,
    version: doc.version,
    sections: doc.sections,
    analysis: project.analysis,
  };
  const base = `${fileSafe(project.title)}_${docType.toUpperCase()}_v${doc.version}`;

  if (format === "md") {
    return new Response(docToMarkdown(args), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.md"`,
      },
    });
  }

  const buffer = await docToDocx(args);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${base}.docx"`,
    },
  });
});
