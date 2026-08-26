import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELEVENLABS_API = "https://api.elevenlabs.io";
const HEYGEN_API = "https://api.heygen.com";

function elevenKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is missing. Add it to .env.local and restart npm run dev.");
  return key;
}

function heygenKey() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY is missing. Premium Lip-Sync needs a HeyGen API key.");
  return key;
}

async function jsonOrRaw(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function economyCreate(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const targetLanguage = String(form.get("targetLanguage") || "").trim();
  const targetLabel = String(form.get("targetLabel") || "").trim();
  const speakerCount = Number(form.get("speakerCount") || 0);
  const watermark = String(form.get("watermark") || "true") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No video file was provided." }, { status: 400 });
  }

  if (!targetLanguage) {
    return NextResponse.json({ error: "Target language is required." }, { status: 400 });
  }

  if (file.size > 250 * 1024 * 1024) {
    return NextResponse.json({ error: "Economy V1 currently limits uploads to 250 MB." }, { status: 413 });
  }

  const providerForm = new FormData();
  providerForm.append("file", file, file.name);
  providerForm.append("name", `NeoCloud Economy - ${file.name} - ${targetLabel || targetLanguage}`);
  providerForm.append("source_lang", "auto");
  providerForm.append("target_lang", targetLanguage);
  providerForm.append("num_speakers", String(Number.isFinite(speakerCount) && speakerCount > 0 ? Math.floor(speakerCount) : 0));
  providerForm.append("watermark", watermark ? "true" : "false");
  providerForm.append("dubbing_studio", "false");
  providerForm.append("disable_voice_cloning", "false");
  providerForm.append("mode", "automatic");
  providerForm.append("highest_resolution", "false");
  providerForm.append("drop_background_audio", "false");

  const response = await fetch(`${ELEVENLABS_API}/v1/dubbing`, {
    method: "POST",
    headers: { "xi-api-key": elevenKey() },
    body: providerForm,
  });

  const data = await jsonOrRaw(response);

  if (!response.ok) {
    return NextResponse.json({ error: "ElevenLabs could not start Economy dubbing.", details: data }, { status: response.status });
  }

  return NextResponse.json({
    provider: "elevenlabs",
    id: data?.dubbing_id,
    expectedDurationSec: data?.expected_duration_sec,
    targetLanguage,
  });
}

async function economyStatus(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  const lang = request.nextUrl.searchParams.get("lang")?.trim() || "";

  if (!id) return NextResponse.json({ error: "Dubbing ID is required." }, { status: 400 });

  const response = await fetch(`${ELEVENLABS_API}/v1/dubbing/${encodeURIComponent(id)}`, {
    headers: { "xi-api-key": elevenKey() },
    cache: "no-store",
  });

  const data = await jsonOrRaw(response);

  if (!response.ok) {
    return NextResponse.json({ error: "Could not check Economy dubbing status.", details: data }, { status: response.status });
  }

  return NextResponse.json({
    provider: "elevenlabs",
    id,
    targetLanguage: lang,
    status: data?.status,
    error: data?.error || null,
  });
}

async function economyDownload(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  const lang = request.nextUrl.searchParams.get("lang")?.trim();

  if (!id || !lang) {
    return NextResponse.json({ error: "Dubbing ID and language are required." }, { status: 400 });
  }

  const response = await fetch(
    `${ELEVENLABS_API}/v1/dubbing/${encodeURIComponent(id)}/audio/${encodeURIComponent(lang)}`,
    {
      headers: { "xi-api-key": elevenKey() },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const details = await jsonOrRaw(response);
    return NextResponse.json({ error: "Could not download dubbed media.", details }, { status: response.status });
  }

  const bytes = await response.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "Content-Type": response.headers.get("content-type") || "video/mp4",
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="neocloud-dub-${lang}.mp4"`,
    },
  });
}

async function premiumCreate(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const targetLanguage = String(form.get("targetLanguage") || "").trim();
  const targetLabel = String(form.get("targetLabel") || "").trim();
  const speakerCount = Number(form.get("speakerCount") || 0);
  const quality = String(form.get("premiumQuality") || "speed") === "precision" ? "precision" : "speed";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No video file was provided." }, { status: 400 });
  }

  if (file.size > 32 * 1024 * 1024) {
    return NextResponse.json({ error: "Premium Lip-Sync V1 supports up to 32 MB." }, { status: 413 });
  }

  const uploadForm = new FormData();
  uploadForm.append("file", file, file.name);

  const uploadResponse = await fetch(`${HEYGEN_API}/v3/assets`, {
    method: "POST",
    headers: {
      "x-api-key": heygenKey(),
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: uploadForm,
  });

  const uploadData = await jsonOrRaw(uploadResponse);

  if (!uploadResponse.ok) {
    return NextResponse.json({ error: "HeyGen asset upload failed.", details: uploadData }, { status: uploadResponse.status });
  }

  const videoUrl = uploadData?.data?.url;
  if (!videoUrl) {
    return NextResponse.json({ error: "HeyGen returned no asset URL." }, { status: 502 });
  }

  const payload = {
    video: { type: "url", url: videoUrl },
    output_languages: [targetLanguage],
    title: `NeoCloud Premium - ${file.name} - ${targetLabel || targetLanguage}`,
    mode: quality,
    translate_audio_only: false,
    enable_caption: true,
    keep_the_same_format: true,
    enable_dynamic_duration: true,
    disable_music_track: false,
    enable_speech_enhancement: true,
    enable_watermark: false,
    ...(Number.isFinite(speakerCount) && speakerCount > 0 ? { speaker_num: Math.floor(speakerCount) } : {}),
  };

  const response = await fetch(`${HEYGEN_API}/v3/video-translations`, {
    method: "POST",
    headers: {
      "x-api-key": heygenKey(),
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const data = await jsonOrRaw(response);

  if (!response.ok) {
    return NextResponse.json({ error: "HeyGen could not start Premium Lip-Sync.", details: data }, { status: response.status });
  }

  return NextResponse.json({
    provider: "heygen",
    id: data?.data?.video_translation_ids?.[0],
    targetLanguage,
  });
}

async function premiumStatus(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Translation ID is required." }, { status: 400 });

  const response = await fetch(`${HEYGEN_API}/v3/video-translations/${encodeURIComponent(id)}`, {
    headers: { "x-api-key": heygenKey() },
    cache: "no-store",
  });

  const data = await jsonOrRaw(response);

  if (!response.ok) {
    return NextResponse.json({ error: "Could not check Premium Lip-Sync status.", details: data }, { status: response.status });
  }

  return NextResponse.json({
    provider: "heygen",
    id,
    videoUrl: data?.data?.video_url,
    failureMessage: data?.data?.failure_message || null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action");

    if (action === "economy-create") return await economyCreate(request);
    if (action === "premium-create") return await premiumCreate(request);

    return NextResponse.json({ error: "Unknown Video Translator action." }, { status: 400 });
  } catch (error) {
    console.error("NeoCloud Video Translator POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected Video Translator error." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action");

    if (action === "economy-status") return await economyStatus(request);
    if (action === "economy-download") return await economyDownload(request);
    if (action === "premium-status") return await premiumStatus(request);

    return NextResponse.json({ error: "Unknown Video Translator action." }, { status: 400 });
  } catch (error) {
    console.error("NeoCloud Video Translator GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected Video Translator error." },
      { status: 500 }
    );
  }
}