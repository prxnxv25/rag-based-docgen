import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "@/lib/api";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, "ANTHROPIC_API_KEY is not configured on the server.");
  }
  client ??= new Anthropic();
  return client;
}

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

/** Runs a forced tool call and returns the tool input as an object. */
export async function callTool(opts: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<unknown> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 12000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: opts.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new HttpError(502, "The model did not return structured output. Please retry.");
  }
  return block.input;
}

/** Streams plain text for one document section as a web ReadableStream. */
export function streamText(opts: { system: string; user: string; maxTokens?: number }) {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 6000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      stream.abort();
    },
  });
}
