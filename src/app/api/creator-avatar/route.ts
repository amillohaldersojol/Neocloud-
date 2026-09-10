import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUNPOD_API = "https://api.runpod.ai/v2";

function getConfig() {
  const endpoint = process.env.NEO_BODY_ENDPOINT?.trim();
  const apiKey = process.env.NEO_BODY_API_KEY?.trim();

  if (!endpoint) {
    throw new Error("NEO_BODY_ENDPOINT is missing from .env.local");
  }

  if (!apiKey) {
    throw new Error("NEO_BODY_API_KEY is missing from .env.local");
  }

  return {
    endpoint: endpoint
      .replace("https://api.runpod.ai/v2/", "")
      .replace("/run", "")
      .replace("/runsync", "")
      .replace(/\/+$/, ""),
    apiKey,
  };
}

async function parseResponse(res: Response) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function authHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

// -----------------------------------------------------
// GENERATE NEO V2 VIDEO
// -----------------------------------------------------

async function generateVideo(req: NextRequest) {
  const body = await req.json();

  const sourceImage = String(
    body.source_image ||
      body.sourceImage ||
      body.imageUrl ||
      ""
  ).trim();

  const audioPath = String(
    body.audio_path ||
      body.audioPath ||
      body.audioUrl ||
      ""
  ).trim();

  if (!sourceImage) {
    return NextResponse.json(
      { error: "Source image URL is required." },
      { status: 400 }
    );
  }

  if (!audioPath) {
    return NextResponse.json(
      { error: "Audio URL is required." },
      { status: 400 }
    );
  }

  const { endpoint, apiKey } = getConfig();

  const payload = {
    input: {
      source_image: sourceImage,
      audio_path: audioPath,

      motion_style: String(
        body.motion_style ||
          body.motionStyle ||
          "natural"
      ),

      emotion: String(body.emotion || "neutral"),

      fps: Number(body.fps || 24),

      width: Number(body.width || 768),

      height: Number(body.height || 768),

      steps: Number(body.steps || 12),

      length: Number(body.length || 48),

      timeout_seconds: Number(
        body.timeout_seconds ||
          body.timeoutSeconds ||
          900
      ),
    },
  };

  console.log("NEO V2 request:", {
    endpoint,
    input: payload.input,
  });

  const res = await fetch(
    `${RUNPOD_API}/${endpoint}/run`,
    {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const json = await parseResponse(res);

  if (!res.ok) {
    console.error("NEO V2 RunPod error:", json);

    return NextResponse.json(
      {
        error:
          json?.error ||
          json?.message ||
          "NEO V2 generation request failed.",
        details: json,
      },
      { status: res.status }
    );
  }

  const jobId = json?.id;

  if (!jobId) {
    return NextResponse.json(
      {
        error: "RunPod accepted the request but returned no job ID.",
        details: json,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    provider: "neo-v2",
    videoId: jobId,
    jobId,
    status: json?.status || "IN_QUEUE",
  });
}

// -----------------------------------------------------
// CHECK NEO V2 JOB STATUS
// -----------------------------------------------------

async function getVideoStatus(req: NextRequest) {
  const id =
    req.nextUrl.searchParams.get("id") ||
    req.nextUrl.searchParams.get("jobId");

  if (!id) {
    return NextResponse.json(
      { error: "Job ID is required." },
      { status: 400 }
    );
  }

  const { endpoint, apiKey } = getConfig();

  const res = await fetch(
    `${RUNPOD_API}/${endpoint}/status/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    }
  );

  const json = await parseResponse(res);

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          json?.error ||
          json?.message ||
          "Could not check NEO V2 job status.",
        details: json,
      },
      { status: res.status }
    );
  }

 const output = json?.output || {};

let videoUrl =
  output?.video_url ||
  output?.videoUrl ||
  output?.url ||
  output?.output_url ||
  "";

if (!videoUrl && output?.video_base64) {
  const mimeType = output?.video_mime_type || "video/mp4";
  videoUrl = `data:${mimeType};base64,${output.video_base64}`;
}
  return NextResponse.json({
    success: json?.status === "COMPLETED",
    provider: "neo-v2",

    jobId: id,
    videoId: id,

    status: json?.status || "",

    videoUrl,

    output,

    error:
      json?.error ||
      output?.error ||
      output?.message ||
      "",
  });
}

// -----------------------------------------------------
// POST
// -----------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const action =
      req.nextUrl.searchParams.get("action") ||
      "generate-video";

    if (action === "generate-video") {
      return await generateVideo(req);
    }

    return NextResponse.json(
      {
        error: `Unknown NEO V2 action: ${action}`,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("NEO V2 POST error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected NEO V2 error.",
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------
// GET
// -----------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get("action");

    if (action === "video-status") {
      return await getVideoStatus(req);
    }

    return NextResponse.json({
      success: true,
      service: "NeoCloud NEO V2 Avatar Engine",
      provider: "neo-v2",
      status: "ready",
    });
  } catch (error) {
    console.error("NEO V2 GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected NEO V2 error.",
      },
      { status: 500 }
    );
  }
}