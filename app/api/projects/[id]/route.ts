import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { HttpError, getLatestDocuments, getOwnedProject, handle, requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  const latest = await getLatestDocuments(id);
  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      brdFileName: project.brdFileName,
      analysis: project.analysis,
      answers: project.answers,
      outline: project.outline,
      outlineSource: project.outlineSource,
    },
    documents: Object.fromEntries(
      Object.entries(latest).map(([type, d]) => [type, { version: d.version, sections: d.sections }]),
    ),
  });
});

const patch = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  answers: z.record(z.string(), z.string().max(4000)).optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const { id } = await params;
  await getOwnedProject(id, userId);
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Invalid update.");
  await getDb()
    .update(schema.projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)));
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const { id } = await params;
  await getOwnedProject(id, userId);
  await getDb()
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)));
  return NextResponse.json({ ok: true });
});
