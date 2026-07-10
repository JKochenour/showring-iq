import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authz";
import {
  isHelpAssistantConfigured,
  streamHelpResponse,
  type HelpChatMessage,
} from "@/lib/ai/help-assistant";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

export async function POST(request: NextRequest) {
  await requireUser(); // any signed-in user; nothing org-specific here

  if (!isHelpAssistantConfigured()) {
    return NextResponse.json(
      {
        error:
          "The help assistant isn't configured yet. An admin needs to set ANTHROPIC_API_KEY.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawMessages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const messages: HelpChatMessage[] = rawMessages
    .slice(-MAX_MESSAGES)
    .map((m) => {
      const role = (m as { role?: unknown })?.role;
      const content = (m as { content?: unknown })?.content;
      if (
        (role !== "user" && role !== "assistant") ||
        typeof content !== "string" ||
        content.length === 0
      ) {
        return null;
      }
      return { role, content: content.slice(0, MAX_MESSAGE_LENGTH) };
    })
    .filter((m): m is HelpChatMessage => m !== null);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "The last message must be from the user" },
      { status: 400 }
    );
  }

  const claudeStream = streamHelpResponse(messages);
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const finalMessage = await claudeStream.finalMessage();
        if (finalMessage.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(
              "\n\n(I can't help with that request. Try rephrasing, or ask something about using ShowRing IQ.)"
            )
          );
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            "\n\n(Something went wrong reaching the help assistant. Please try again.)"
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
