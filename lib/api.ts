import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "Please sign in.");
  return session.user.id;
}

/** Wraps a route handler so thrown HttpErrors become JSON error responses. */
export function handle<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      const message = err instanceof Error ? err.message : "Unexpected error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

const DAILY_LIMIT = Number(process.env.DAILY_GENERATION_LIMIT ?? 300);

/** Cost control: counts LLM calls per user in the last 24 hours. */
export async function recordUsage(userId: string, kind: string) {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.usageEvents)
    .where(
      and(eq(schema.usageEvents.userId, userId), gte(schema.usageEvents.createdAt, since)),
    );
  if ((row?.n ?? 0) >= DAILY_LIMIT) {
    throw new HttpError(
      429,
      `Daily generation limit (${DAILY_LIMIT}) reached. Try again tomorrow.`,
    );
  }
  await db.insert(schema.usageEvents).values({ userId, kind });
}

export async function getOwnedProject(projectId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) throw new HttpError(404, "Project not found.");
  const [project] = await getDb()
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!project) throw new HttpError(404, "Project not found.");
  return project;
}

/** Latest version of each document type for a project. */
export async function getLatestDocuments(projectId: string) {
  const rows = await getDb()
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.projectId, projectId));
  const latest: Record<string, (typeof rows)[number]> = {};
  for (const r of rows) {
    if (!latest[r.docType] || latest[r.docType].version < r.version) latest[r.docType] = r;
  }
  return latest;
}
