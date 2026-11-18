import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requirePageUser } from "@/lib/session";
import { Md } from "@/components/Md";
import { PrintButton } from "@/components/PrintButton";
import { DOC_LABELS, isDocType } from "@/lib/types";

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string; docType: string }>;
}) {
  const user = await requirePageUser();
  const { id, docType } = await params;
  if (!isDocType(docType) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = getDb();
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)))
    .limit(1);
  if (!project) notFound();

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.projectId, id), eq(schema.documents.docType, docType)))
    .orderBy(desc(schema.documents.version))
    .limit(1);
  if (!doc) notFound();

  const name = project.analysis?.projectName || project.title;

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8">
      <div className="no-print mb-6 flex items-center justify-between rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-700">
        <span>Choose &quot;Save as PDF&quot; as the destination in the print dialog.</span>
        <PrintButton />
      </div>
      <h1 className="text-3xl font-bold text-slate-900">{DOC_LABELS[docType]}</h1>
      <p className="mt-2 text-lg text-slate-600">{name}</p>
      <p className="text-sm text-slate-500">
        Version {doc.version} · {doc.createdAt.toISOString().slice(0, 10)}
      </p>
      {doc.sections.map((s, i) => (
        <section key={s.id} className="print-section mt-8">
          <h2 className="border-b border-slate-200 pb-1 text-xl font-semibold text-slate-900">
            {i + 1}. {s.title}
          </h2>
          <div className="mt-3">
            <Md>{s.content || "_Not written._"}</Md>
          </div>
        </section>
      ))}
    </main>
  );
}
