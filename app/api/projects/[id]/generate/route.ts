import { z } from "zod";
import { HttpError, getOwnedProject, handle, recordUsage, requireUser } from "@/lib/api";
import { streamText } from "@/lib/anthropic";
import { SECTION_SYSTEM, sectionUserPrompt } from "@/lib/prompts";
import { DOC_TYPES } from "@/lib/types";

// One section per request keeps every call well inside the function time limit.
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const body = z.object({
  docType: z.enum(DOC_TYPES as [string, ...string[]]),
  sectionIndex: z.number().int().min(0).max(60),
  prior: z
    .array(z.object({ title: z.string().max(200), content: z.string().max(60_000) }))
    .max(60)
    .default([]),
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(id, userId);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Invalid request.");
  const { docType, sectionIndex, prior } = parsed.data;
  const type = docType as "fsd" | "tsd" | "spd";

  if (!project.analysis) throw new HttpError(409, "Analyse the BRD first.");
  const outline = project.outline[type];
  if (!outline[sectionIndex]) throw new HttpError(400, "That section does not exist.");

  await recordUsage(userId, "section");

  const stream = streamText({
    system: SECTION_SYSTEM,
    user: sectionUserPrompt({
      docType: type,
      analysis: project.analysis,
      answers: project.answers,
      outline,
      sectionIndex,
      prior,
    }),
    maxTokens: 20000,
    onRetry: () => recordUsage(userId, "section-retry"),
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
});
