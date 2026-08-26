import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AttachmentPayload = {
  name: string;
  mimeType: string;
  kind: "image" | "pdf" | "text";
  data?: string;
  text?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const rawMessages = Array.isArray(body.messages)
      ? body.messages
      : [];

    const messages: ChatMessage[] = rawMessages
      .filter(
        (item: unknown): item is ChatMessage =>
          typeof item === "object" &&
          item !== null &&
          "role" in item &&
          "content" in item &&
          ((item as ChatMessage).role === "user" ||
            (item as ChatMessage).role === "assistant") &&
          typeof (item as ChatMessage).content === "string"
      )
      .map((item: ChatMessage) => ({
        role: item.role,
        content: item.content.trim(),
      }))
      .filter((item: ChatMessage) => item.content.length > 0)
      .slice(-20);

    const attachment =
      body.attachment &&
      typeof body.attachment === "object"
        ? (body.attachment as AttachmentPayload)
        : null;

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided." },
        { status: 400 }
      );
    }

    const priorMessages = messages.slice(0, -1);
    const latestUserMessage = messages[messages.length - 1];

    const input: any[] = priorMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const latestContent: any[] = [
      {
        type: "input_text",
        text: latestUserMessage.content,
      },
    ];

    if (
      attachment?.kind === "image" &&
      typeof attachment.data === "string" &&
      attachment.data.startsWith("data:")
    ) {
      latestContent.push({
        type: "input_image",
        image_url: attachment.data,
      });
    }

    if (
      attachment?.kind === "pdf" &&
      typeof attachment.data === "string" &&
      attachment.data.startsWith("data:")
    ) {
      latestContent.push({
        type: "input_file",
        filename: attachment.name || "document.pdf",
        file_data: attachment.data,
      });
    }

    if (
      attachment?.kind === "text" &&
      typeof attachment.text === "string"
    ) {
      latestContent.push({
        type: "input_text",
        text:
          `\n\nAttached text file: ${attachment.name}\n` +
          "----- FILE CONTENT START -----\n" +
          attachment.text +
          "\n----- FILE CONTENT END -----",
      });
    }

    input.push({
      role: "user",
      content: latestContent,
    });

    const stream = await openai.responses.create({
      model: "gpt-5.6",
      instructions: `
You are NeoCloud AI, the intelligent AI assistant inside the NeoCloud platform.

IDENTITY:
- Your name is NeoCloud AI.
- Never introduce yourself as ChatGPT.
- If someone asks "Who are you?", say that you are NeoCloud AI.
- Reply in the same language the user uses.

MEMORY:
- Use the conversation messages provided in this request as context for the current chat.
- Resolve follow-up phrases such as "that idea", "continue", "the third point", and similar references from the supplied conversation.
- Never claim to remember information that is not present in the supplied conversation context.

FILES:
- When an image, PDF, or text file is attached, analyze that attachment together with the user's question.
- If the user asks about something the attachment does not support, say that clearly.
- Do not invent text, facts, tables, images, or details that are not present in the attachment.

RESPONSE STYLE:
- Make answers clean, structured, and easy to read.
- Always use Markdown formatting.
- Use clear headings when useful.
- Use short paragraphs with proper spacing.
- Use bullet points or numbered lists for steps and lists.
- Use **bold** for important words and key ideas.
- Use code blocks when showing code.
- Never produce giant walls of text.
- Keep answers visually clean, natural, and easy to scan.

FOUNDER:
- NeoCloud was founded by Amillo Halder Sojol.
- If someone asks who founded NeoCloud, who your founder is, or who created NeoCloud, answer: "NeoCloud was founded by Amillo Halder Sojol."
`,
      input,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              controller.enqueue(
                encoder.encode(event.delta)
              );
            }
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("NeoCloud API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}