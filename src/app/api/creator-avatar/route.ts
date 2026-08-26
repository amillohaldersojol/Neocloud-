import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.heygen.com";

function getKey() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    throw new Error(
      "HEYGEN_API_KEY is missing. Add it to .env.local and restart npm run dev."
    );
  }
  return key;
}

async function parseResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getProviderMessage(json: any) {
  return (
    json?.error?.message ||
    json?.error ||
    json?.message ||
    json?.detail?.message ||
    json?.details?.message ||
    json?.raw ||
    ""
  );
}

async function listVoiceData(
  type = "public",
  language = "",
  gender = ""
) {
  const params = new URLSearchParams({
    type,
    limit: "100",
  });

  if (language) params.set("language", language);
  if (gender === "male" || gender === "female") {
    params.set("gender", gender);
  }

  const res = await fetch(`${API}/v3/voices?${params.toString()}`, {
    headers: {
      "x-api-key": getKey(),
    },
    cache: "no-store",
  });

  const json = await parseResponse(res);

  if (!res.ok) {
    throw new Error(
      getProviderMessage(json) || "Could not load HeyGen voices."
    );
  }

  return Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.data?.voices)
    ? json.data.voices
    : [];
}

async function pickFallbackVoice(language = "English") {
  let list = await listVoiceData("public", language, "male");

  if (!list.length) {
    list = await listVoiceData("public");
  }

  const voice =
    list.find(
      (v: any) =>
        String(v?.gender || "").toLowerCase() === "male" &&
        (v?.voice_id || v?.id)
    ) ||
    list.find((v: any) => v?.voice_id || v?.id);

  return voice?.voice_id || voice?.id || "";
}

async function createAvatar(req: NextRequest) {
  const form = await req.formData();
  const photo = form.get("photo");
  const name = String(form.get("name") || "My NeoCloud Avatar").trim();

  if (!(photo instanceof File)) {
    return NextResponse.json(
      { error: "Choose a portrait first." },
      { status: 400 }
    );
  }

  if (!["image/jpeg", "image/png"].includes(photo.type)) {
    return NextResponse.json(
      { error: "Use a JPG or PNG portrait." },
      { status: 400 }
    );
  }

  if (photo.size > 32 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Photo must be 32 MB or smaller." },
      { status: 413 }
    );
  }

  const uploadForm = new FormData();
  uploadForm.append("file", photo, photo.name);

  const uploadRes = await fetch(`${API}/v3/assets`, {
    method: "POST",
    headers: {
      "x-api-key": getKey(),
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: uploadForm,
  });

  const uploadJson = await parseResponse(uploadRes);

  if (!uploadRes.ok) {
    return NextResponse.json(
      {
        error:
          getProviderMessage(uploadJson) ||
          "HeyGen portrait upload failed.",
        details: uploadJson,
      },
      { status: uploadRes.status }
    );
  }

  const assetId =
    uploadJson?.data?.id ||
    uploadJson?.data?.asset_id ||
    uploadJson?.id ||
    uploadJson?.asset_id;

  if (!assetId) {
    return NextResponse.json(
      {
        error: "Portrait uploaded but HeyGen returned no asset ID.",
        details: uploadJson,
      },
      { status: 502 }
    );
  }

  const avatarRes = await fetch(`${API}/v3/avatars`, {
    method: "POST",
    headers: {
      "x-api-key": getKey(),
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      type: "photo",
      name,
      file: {
        type: "asset_id",
        asset_id: assetId,
      },
    }),
  });

  const avatarJson = await parseResponse(avatarRes);

  if (!avatarRes.ok) {
    return NextResponse.json(
      {
        error:
          getProviderMessage(avatarJson) ||
          "HeyGen Photo Avatar creation failed.",
        details: avatarJson,
      },
      { status: avatarRes.status }
    );
  }

  const item = avatarJson?.data?.avatar_item;
  const group = avatarJson?.data?.avatar_group;

  return NextResponse.json({
    avatarId: item?.id || group?.id || "",
    previewImageUrl:
      item?.preview_image_url ||
      group?.preview_image_url ||
      "",
    defaultVoiceId:
      item?.default_voice_id ||
      group?.default_voice_id ||
      "",
    status:
      item?.status ||
      group?.status ||
      "processing",
  });
}

async function listVoices(req: NextRequest) {
  const type =
    req.nextUrl.searchParams.get("type") === "private"
      ? "private"
      : "public";

  const language =
    req.nextUrl.searchParams.get("language")?.trim() || "";

  const gender =
    req.nextUrl.searchParams.get("gender")?.trim() || "";

  const list = await listVoiceData(type, language, gender);

  return NextResponse.json({
    voices: list.map((v: any) => ({
      id: v.voice_id || v.id,
      name: v.name || v.display_name || "HeyGen Voice",
      language: v.language || v.locale || "",
      gender: v.gender || "",
      type,
      previewAudioUrl: v.preview_audio_url || "",
    })),
  });
}

async function generateVideo(req: NextRequest) {
  const body = await req.json();

  const avatarId = String(body.avatarId || "").trim();
  const script = String(body.script || "").trim();

  if (!avatarId) {
    return NextResponse.json(
      { error: "Avatar ID is required." },
      { status: 400 }
    );
  }

  if (!script) {
    return NextResponse.json(
      { error: "Write a script first." },
      { status: 400 }
    );
  }

  let voiceId = body.voiceId ? String(body.voiceId).trim() : "";

  if (!voiceId) {
    voiceId = await pickFallbackVoice(
      String(body.voiceLocale || "English")
    );
  }

  if (!voiceId) {
    return NextResponse.json(
      {
        error:
          "No HeyGen voice is available. Open Creator Avatar V1.1 and select a voice first.",
      },
      { status: 400 }
    );
  }

  const basePayload: Record<string, unknown> = {
    type: "avatar",
    avatar_id: avatarId,
    title: String(body.title || "NeoCloud Creator Avatar"),
    script,
    voice_id: voiceId,
    aspect_ratio:
      body.aspectRatio === "16:9" ? "16:9" : "9:16",
    resolution:
      body.resolution === "1080p" ? "1080p" : "720p",
    output_format: "mp4",
  };

  const advancedPayload: Record<string, unknown> = {
    ...basePayload,
    expressiveness: ["low", "medium", "high"].includes(
      body.expressiveness
    )
      ? body.expressiveness
      : "low",
    engine: {
      type: "avatar_iv",
    },
  };

  if (body.motionPrompt) {
    advancedPayload.motion_prompt = String(body.motionPrompt);
  }

  advancedPayload.voice_settings = {
    speed:
      typeof body.voiceSpeed === "number"
        ? Math.max(0.5, Math.min(1.5, body.voiceSpeed))
        : 1,
    pitch:
      typeof body.voicePitch === "number"
        ? Math.max(-50, Math.min(50, body.voicePitch))
        : 0,
    volume: 1,
  };

  const advancedRes = await fetch(`${API}/v3/videos`, {
    method: "POST",
    headers: {
      "x-api-key": getKey(),
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(advancedPayload),
  });

  const advancedJson = await parseResponse(advancedRes);

  if (advancedRes.ok) {
    return NextResponse.json({
      videoId: advancedJson?.data?.video_id,
      status: advancedJson?.data?.status || "processing",
      mode: "advanced",
      voiceId,
    });
  }

  console.warn(
    "HeyGen advanced render rejected:",
    advancedRes.status,
    advancedJson
  );

  const fallbackRes = await fetch(`${API}/v3/videos`, {
    method: "POST",
    headers: {
      "x-api-key": getKey(),
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(basePayload),
  });

  const fallbackJson = await parseResponse(fallbackRes);

  if (fallbackRes.ok) {
    return NextResponse.json({
      videoId: fallbackJson?.data?.video_id,
      status: fallbackJson?.data?.status || "processing",
      mode: "minimal-fallback",
      voiceId,
    });
  }

  return NextResponse.json(
    {
      error:
        getProviderMessage(fallbackJson) ||
        getProviderMessage(advancedJson) ||
        "HeyGen video generation failed.",
      details: {
        advanced: advancedJson,
        fallback: fallbackJson,
      },
    },
    { status: fallbackRes.status || advancedRes.status || 400 }
  );
}

async function getVideoStatus(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Video ID is required." },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${API}/v3/videos/${encodeURIComponent(id)}`,
    {
      headers: {
        "x-api-key": getKey(),
      },
      cache: "no-store",
    }
  );

  const json = await parseResponse(res);

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          getProviderMessage(json) ||
          "Could not check video status.",
        details: json,
      },
      { status: res.status }
    );
  }

  const video = json?.data || {};

  return NextResponse.json({
    status: video.status || "",
    videoUrl: video.video_url || "",
    thumbnailUrl: video.thumbnail_url || "",
    failureMessage: video.failure_message || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get("action");

    if (action === "create-avatar") {
      return await createAvatar(req);
    }

    if (action === "generate-video") {
      return await generateVideo(req);
    }

    return NextResponse.json(
      { error: "Unknown Creator Avatar action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("NeoCloud Creator Avatar POST error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected Creator Avatar error.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get("action");

    if (action === "voices") {
      return await listVoices(req);
    }

    if (action === "video-status") {
      return await getVideoStatus(req);
    }

    return NextResponse.json(
      { error: "Unknown Creator Avatar action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("NeoCloud Creator Avatar GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected Creator Avatar error.",
      },
      { status: 500 }
    );
  }
}