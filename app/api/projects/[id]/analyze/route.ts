import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { HttpError, getOwnedProject, handle, recordUsage, requireUser } from "@/lib/api";
import { callTool } from "@/lib/anthropic";
import {
  ANALYSIS_SYSTEM,
  ANALYSIS_TOOL_SCHEMA,
  analysisUserPrompt,
  normaliseAnalysis,
} from "@/lib/prompts";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, userId);

  await recordUsage(userId, "analyze");
  const raw = await callTool({
    system: ANALYSIS_SYSTEM,
    user: analysisUserPrompt(project.brdText),
    toolName: "record_analysis",
    toolDescription: "Record the structured analysis of the BRD.",
    schema: ANALYSIS_TOOL_SCHEMA,
    maxTokens: 12000,
  });

  const analysis = normaliseAnalysis(raw);
  if (analysis.requirements.length === 0) {
    throw new HttpError(
      422,
      "No requirements could be extracted. Check that the uploaded file is a BRD.",
    );
  }

  // Question IDs may change on re-analysis, so earlier answers are cleared.
  await getDb()
    .update(schema.projects)
    .set({ analysis, answers: {}, updatedAt: new Date() })
    .where(eq(schema.projects.id, id));

  return NextResponse.json({ analysis });
});
