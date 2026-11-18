import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getLatestDocuments } from "@/lib/api";
import { requirePageUser } from "@/lib/session";
import { Header } from "@/components/Header";
import { Workspace } from "@/components/Workspace";
import type { DocType } from "@/lib/types";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [project] = await getDb()
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)))
    .limit(1);
  if (!project) notFound();

  const latest = await getLatestDocuments(id);
  const documents = Object.fromEntries(
    Object.entries(latest).map(([type, d]) => [type, { version: d.version, sections: d.sections }]),
  ) as Partial<Record<DocType, { version: number; sections: (typeof latest)[string]["sections"] }>>;

  return (
    <>
      <Header name={user.name} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Workspace
          project={{
            id: project.id,
            title: project.title,
            brdFileName: project.brdFileName,
            analysis: project.analysis,
            answers: project.answers,
            outline: project.outline,
            outlineSource: project.outlineSource,
          }}
          documents={documents}
        />
      </main>
    </>
  );
}
