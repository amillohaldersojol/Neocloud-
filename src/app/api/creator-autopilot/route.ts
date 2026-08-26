import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local and restart npm run dev.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function cleanJsonText(text: string) {
  return text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function createScript(request: NextRequest) {
  const body = await request.json();
  const topic = String(body.topic || "").trim();
  const language = String(body.language || "English").trim();
  const durationSeconds = Math.max(15, Math.min(90, Number(body.durationSeconds) || 45));
  const style = String(body.style || "").trim();
  const recentTopics = Array.isArray(body.recentTopics)
    ? body.recentTopics.slice(0, 12).map(String)
    : [];

  if (!topic) {
    return NextResponse.json({ error: "Content topic is required." }, { status: 400 });
  }

  const client = getOpenAI();
  const response = await client.responses.create({
    model: "gpt-5.6",
    input: `
You are the script engine inside NeoCloud Creator Autopilot.

Create ONE short-form creator video script.

CONTENT NICHE:
${topic}

LANGUAGE:
${language}

TARGET LENGTH:
Approximately ${durationSeconds} seconds when spoken naturally.

STYLE:
${style || "Clear, energetic, factual, creator-friendly."}

RECENT VIDEO TITLES TO AVOID REPEATING:
${recentTopics.length ? recentTopics.join("\n") : "None yet."}

Important:
- Do not fabricate current events or statistics.
- Start with a strong hook.
- Use short spoken sentences.
- Make it natural for an AI avatar presenter.
- No markdown inside the script.

Return ONLY valid JSON:
{
  "title": "short video title",
  "script": "complete spoken script"
}
`,
  });

  let parsed: { title?: string; script?: string } = {};

  try {
    parsed = JSON.parse(cleanJsonText(response.output_text));
  } catch {
    parsed = {
      title: "NeoCloud Creator Video",
      script: response.output_text.trim(),
    };
  }

  if (!parsed.script) {
    return NextResponse.json({ error: "The AI did not return a usable script." }, { status: 502 });
  }

  return NextResponse.json({
    title: parsed.title || "NeoCloud Creator Video",
    script: parsed.script,
  });
}

export async function POST(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action");

    if (action === "create-script") {
      return await createScript(request);
    }

    return NextResponse.json({ error: "Unknown Creator Autopilot action." }, { status: 400 });
  } catch (error) {
    console.error("NeoCloud Creator Autopilot error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected Creator Autopilot error.",
      },
      { status: 500 }
    );
  }
}