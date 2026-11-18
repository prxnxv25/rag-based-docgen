import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "@/lib/api";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, "ANTHROPIC_API_KEY is not configured on the server.");
  }
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: "https://api.minimax.io/anthropic",
  });
  return client;
}

export const MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M3";

/** Requests structured output with tools, while accepting JSON-only model responses. */
export async function callTool<T>(opts: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  parse: (value: unknown) => T;
  maxTokens?: number;
  onRetry?: () => Promise<void>;
}): Promise<T> {
  const anthropic = getClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await opts.onRetry?.();
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 20000,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
        tools: [
          {
            name: opts.toolName,
            description: opts.toolDescription,
            input_schema: opts.schema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "auto" },
      });
      const block = res.content.find((b) => b.type === "tool_use");
      if (block?.type === "tool_use") return opts.parse(block.input);

      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
      try {
        return opts.parse(JSON.parse(fenced));
      } catch {
        const start = fenced.indexOf("{");
        const end = fenced.lastIndexOf("}");
        if (start >= 0 && end > start) {
          return opts.parse(JSON.parse(fenced.slice(start, end + 1)));
        }
        throw new Error("The model returned no structured output.");
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      lastError = error;
    }
  }

  console.error("MiniMax structured output failed after retry.", lastError);
  throw new HttpError(502, "The model request failed after two attempts. Please retry.");
}

/** Streams one section as NDJSON events so failed attempts can be reset safely. */
export function streamText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  onRetry?: () => Promise<void>;
}) {
  const anthropic = getClient();
  const encoder = new TextEncoder();
  let abortActive: (() => void) | null = null;
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: { type: "delta" | "reset" | "done" | "error"; text?: string }) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) {
            await opts.onRetry?.();
            send({ type: "reset" });
          }
          const stream = anthropic.messages.stream({
            model: MODEL,
            max_tokens: opts.maxTokens ?? 20000,
            system: opts.system,
            messages: [{ role: "user", content: opts.user }],
          });
          abortActive = () => stream.abort();
          let emitted = false;
          for await (const ev of stream) {
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              emitted = true;
              send({ type: "delta", text: ev.delta.text });
            }
          }
          if (!emitted) throw new Error("The model returned an empty section.");
          abortActive = null;
          send({ type: "done" });
          controller.close();
          return;
        } catch (error) {
          abortActive?.();
          abortActive = null;
          if (cancelled) return;
          if (attempt > 0 || error instanceof HttpError) {
            const message =
              error instanceof HttpError
                ? error.message
                : "The model request failed after retry. Retry this section.";
            console.error("MiniMax section generation failed.", error);
            send({ type: "error", text: message });
            controller.close();
            return;
          }
        }
      }
    },
    cancel() {
      cancelled = true;
      abortActive?.();
    },
  });
}
