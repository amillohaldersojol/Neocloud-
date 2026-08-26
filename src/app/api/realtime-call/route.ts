export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response("OPENAI_API_KEY is missing.", {
        status: 500,
      });
    }

    const sdp = await request.text();

    if (!sdp.trim()) {
      return new Response("Missing SDP offer.", {
        status: 400,
      });
    }

    const session = {
      type: "realtime",
      model: "gpt-realtime",
      instructions: `
You are NeoCloud AI, the realtime voice assistant inside the NeoCloud platform.

IDENTITY:
- Your name is NeoCloud AI.
- Never introduce yourself as ChatGPT.
- NeoCloud was founded by Amillo Halder Sojol.
- If asked who your founder is, say: "NeoCloud was founded by Amillo Halder Sojol."

VOICE BEHAVIOR:
- Speak naturally, warmly, and conversationally.
- Automatically understand whatever language the user speaks.
- Reply in the same language as the user unless they ask for another language.
- Keep spoken answers concise by default.
- If the user interrupts you, stop speaking and listen to the new request.
`,
      output_modalities: ["audio"],
      audio: {
        input: {
          turn_detection: {
            type: "semantic_vad",
            eagerness: "low",
            create_response: true,
            interrupt_response: false,
          },
        },
        output: {
          voice: "marin",
          speed: 0.92,
        },
      },
    };

    // Build multipart/form-data manually so the Realtime endpoint
    // receives both required fields exactly as expected:
    // "sdp" as application/sdp and "session" as application/json.
    const boundary = `----NeoCloudBoundary${Date.now()}`;

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="sdp"\r\n` +
      `Content-Type: application/sdp\r\n\r\n` +
      `${sdp}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="session"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${JSON.stringify(session)}\r\n` +
      `--${boundary}--\r\n`;

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/realtime/calls",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    const answerSdp = await openAIResponse.text();

    if (!openAIResponse.ok) {
      console.error("OpenAI Realtime error:", answerSdp);

      return new Response(answerSdp, {
        status: openAIResponse.status,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return new Response(answerSdp, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Realtime route error:", error);

    return new Response(
      error instanceof Error
        ? error.message
        : "Could not create realtime voice session.",
      {
        status: 500,
      }
    );
  }
}