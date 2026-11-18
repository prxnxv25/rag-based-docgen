import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { HttpError, getOwnedProject, handle, requireUser } from "@/lib/api";
import { isDocType } from "@/lib/types";

type Ctx = { params: Promise<{ id: string; docType: string }> };

const MAX_VERSIONS = 30;

const putBody = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().max(80),
        title: z.string().max(200),
        guidance: z.string().max(4000),
        content: z.string().max(200_000),
      }),
    )
    .min(1)
    .max(60),
});

/** Lists versions, or returns the sections of one version with ?version=N. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const { id, docType } = await params;
  if (!isDocType(docType)) throw new HttpError(404, "Unknown document type.");
  await getOwnedProject(id, userId);

  const db = getDb();
  const version = new URL(req.url).searchParams.get("version");
  if (version) {
    const [row] = await db
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.projectId, id),
          eq(schema.documents.docType, docType),
          eq(schema.documents.version, Number(version)),
        ),
      )
      .limit(1);
    if (!row) throw new HttpError(404, "Version not found.");
    return NextResponse.json({ version: row.version, sections: row.sections });
  }

  const rows = await db
    .select({ version: schema.documents.version, createdAt: schema.documents.createdAt })
    .from(schema.documents)
    .where(and(eq(schema.documents.projectId, id), eq(schema.documents.docType, docType)))
    .orderBy(desc(schema.documents.version));
  return NextResponse.json({ versions: rows });
});

/** Saves the document as a new version. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const { id, docType } = await params;
  if (!isDocType(docType)) throw new HttpError(404, "Unknown document type.");
  await getOwnedProject(id, userId);

  const parsed = putBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Invalid document.");

  const db = getDb();
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${schema.documents.version}), 0)::int` })
    .from(schema.documents)
    .where(and(eq(schema.documents.projectId, id), eq(schema.documents.docType, docType)));
  const version = max + 1;

  await db
    .insert(schema.documents)
    .values({ projectId: id, docType, version, sections: parsed.data.sections });

  // Keep only the most recent versions.
  if (version > MAX_VERSIONS) {
    await db
      .delete(schema.documents)
      .where(
        and(
          eq(schema.documents.projectId, id),
          eq(schema.documents.docType, docType),
          sql`${schema.documents.version} <= ${version - MAX_VERSIONS}`,
        ),
      );
  }
  await db
    .update(schema.projects)
    .set({ updatedAt: new Date() })
    .where(eq(schema.projects.id, id));

  return NextResponse.json({ version });
});
