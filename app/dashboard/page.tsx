import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requirePageUser } from "@/lib/session";
import { Header } from "@/components/Header";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";

export default async function Dashboard() {
  const user = await requirePageUser();
  const projects = await getDb()
    .select({
      id: schema.projects.id,
      title: schema.projects.title,
      analysis: schema.projects.analysis,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .where(eq(schema.projects.userId, user.id))
    .orderBy(desc(schema.projects.updatedAt));

  return (
    <>
      <Header name={user.name} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Your projects</h1>
          <Link href="/projects/new" className="btn btn-primary">
            New project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-medium text-slate-900">No projects yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Upload a BRD to generate your first FSD, TSD and Solution Proposal.
            </p>
            <Link href="/projects/new" className="btn btn-primary mt-4">
              Start a project
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {projects.map((p) => (
              <li key={p.id} className="card flex items-center justify-between gap-4 p-4">
                <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">{p.title}</div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {p.analysis
                      ? `${p.analysis.requirements.length} requirements analysed`
                      : "Not analysed yet"}
                    {" · "}
                    Updated {p.updatedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
                  </div>
                </Link>
                <DeleteProjectButton id={p.id} title={p.title} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
