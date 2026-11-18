import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { HttpError, handle, recordUsage, requireUser } from "@/lib/api";
import { callTool } from "@/lib/anthropic";
import { fileToText } from "@/lib/parse";
import {
  TEMPLATE_SYSTEM,
  TEMPLATE_TOOL_SCHEMA,
  parseTemplateSections,
  templateUserPrompt,
} from "@/lib/prompts";
import { DEFAULT_OUTLINES } from "@/lib/templates/defaults";
import { DOC_TYPES, LIMITS, type DocType, type Outline } from "@/lib/types";

export const maxDuration = 300;

export const GET = handle(async () => {
  const userId = await requireUser();
  const rows = await getDb()
    .select({
      id: schema.projects.id,
      title: schema.projects.title,
      analysed: schema.projects.analysis,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId))
    .orderBy(desc(schema.projects.updatedAt));
  return NextResponse.json({
    projects: rows.map((r) => ({
      id: r.id,
      title: r.title,
      analysed: !!r.analysed,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
});

export const POST = handle(async (req: Request) => {
  const userId = await requireUser();
  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, "Expected a form submission.");

  const title = String(form.get("title") ?? "").trim().slice(0, 160);
  if (!title) throw new HttpError(400, "Give the project a name.");

  // BRD: uploaded file wins over pasted text.
  let brdText = String(form.get("brdText") ?? "").trim();
  let brdFileName: string | null = null;
  const brdFile = form.get("brdFile");
  if (brdFile instanceof File && brdFile.size > 0) {
    brdText = await fileToText(brdFile);
    brdFileName = brdFile.name;
  }
  if (brdText.length < 100) {
    throw new HttpError(400, "The BRD is empty or too short. Upload a file or paste the text.");
  }
  if (brdText.length > LIMITS.maxBrdChars) {
    throw new HttpError(
      413,
      `The BRD is too long (${brdText.length.toLocaleString()} characters; limit ${LIMITS.maxBrdChars.toLocaleString()}).`,
    );
  }

  const db = getDb();
  const outline: Outline = {
    fsd: DEFAULT_OUTLINES.fsd,
    tsd: DEFAULT_OUTLINES.tsd,
    spd: DEFAULT_OUTLINES.spd,
  };
  const outlineSource: Record<string, string> = {
    fsd: "Default industry template",
    tsd: "Default industry template",
    spd: "Default industry template",
  };

  // Resolve each document type: default, a saved template, or a new upload.
  await Promise.all(
    DOC_TYPES.map(async (docType: DocType) => {
      const mode = String(form.get(`templateMode_${docType}`) ?? "default");

      if (mode === "saved") {
        const id = String(form.get(`templateSaved_${docType}`) ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Pick a saved template.");
        const [tpl] = await db
          .select()
          .from(schema.templates)
          .where(and(eq(schema.templates.id, id), eq(schema.templates.userId, userId)))
          .limit(1);
        if (!tpl) throw new HttpError(404, "Saved template not found.");
        outline[docType] = tpl.sections;
        outlineSource[docType] = `Saved template: ${tpl.name}`;
        return;
      }

      if (mode === "upload") {
        const file = form.get(`templateFile_${docType}`);
        if (!(file instanceof File) || file.size === 0) {
          throw new HttpError(400, `Choose a template file for the ${docType.toUpperCase()}.`);
        }
        const text = await fileToText(file);
        if (text.length < 50) {
          throw new HttpError(400, `The ${docType.toUpperCase()} template appears to be empty.`);
        }
        await recordUsage(userId, "template");
        const sections = await callTool({
          system: TEMPLATE_SYSTEM,
          user: templateUserPrompt(docType, text),
          toolName: "record_template",
          toolDescription: "Record the ordered section outline of the template.",
          schema: TEMPLATE_TOOL_SCHEMA,
          parse: parseTemplateSections,
          maxTokens: 10000,
          onRetry: () => recordUsage(userId, "template-retry"),
        });
        await db.insert(schema.templates).values({
          userId,
          name: file.name,
          docType,
          sections,
          sourceFileName: file.name,
        });
        outline[docType] = sections;
        outlineSource[docType] = `Uploaded template: ${file.name}`;
      }
    }),
  );

  const [project] = await db
    .insert(schema.projects)
    .values({ userId, title, brdText, brdFileName, outline, outlineSource })
    .returning({ id: schema.projects.id });

  return NextResponse.json({ id: project.id });
});
