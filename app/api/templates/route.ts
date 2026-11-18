import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { handle, requireUser } from "@/lib/api";

export const GET = handle(async () => {
  const userId = await requireUser();
  const rows = await getDb()
    .select({
      id: schema.templates.id,
      name: schema.templates.name,
      docType: schema.templates.docType,
      sections: schema.templates.sections,
      createdAt: schema.templates.createdAt,
    })
    .from(schema.templates)
    .where(eq(schema.templates.userId, userId))
    .orderBy(desc(schema.templates.createdAt));
  return NextResponse.json({
    templates: rows.map((r) => ({
      id: r.id,
      name: r.name,
      docType: r.docType,
      sectionCount: r.sections.length,
      createdAt: r.createdAt,
    })),
  });
});
