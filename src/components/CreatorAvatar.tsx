"use client";

import { useEffect, useRef, useState } from "react";

type JobState =
  | "idle"
  | "uploading"
  | "submitting"
  | "queued"
  | "running"
  | "completed"
  | "failed";

export default function CreatorAvatar() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [imagePreview, setImagePreview] = useState("");
  const [audioName, setAudioName] = useState("");

  const [motionStyle, setMotionStyle] = useState("natural");
  const [emotion, setEmotion] = useState("neutral");

  const [fps, setFps] = useState(24);
  const [steps, setSteps] = useState(4);
  const [length, setLength] = useState(24);

  const [state, setState] = useState<JobState>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [jobId, setJobId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const timerRef = useRef<number | null>(null);

  const busy =
    state === "uploading" ||
    state === "submitting" ||
    state === "queued" ||
    state === "running";

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const uploadToCloudinary = async (
    file: File,
    resourceType: "image" | "video"
  ) => {
    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    const uploadPreset =
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary configuration is missing in .env.local."
      );
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const json = await response.json();

    if (!response.ok) {
      throw new Error(
        json?.error?.message || "Cloudinary upload failed."
      );
    }

    if (!json?.secure_url) {
      throw new Error("Cloudinary returned no file URL.");
    }

    return json.secure_url as string;
  };

  const pollStatus = async (id: string) => {
    try {
      const response = await fetch(
        `/api/creator-avatar?action=video-status&id=${encodeURIComponent(id)}`,
        {
          cache: "no-store",
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error || "Could not check NEO V2 job status."
        );
      }

      const status = String(json?.status || "").toUpperCase();

      if (status === "COMPLETED") {
        const url =
          json?.videoUrl ||
          json?.output?.video_url ||
          json?.output?.videoUrl ||
          json?.output?.url ||
          json?.output?.output_url ||
          "";

        if (!url) {
          setState("failed");
          setError(
            "NEO V2 completed, but no public video URL was returned."
          );
          return;
        }

        setVideoUrl(url);
        setState("completed");
        setMessage("NEO V2 video is ready.");
        return;
      }

      if (
        status === "FAILED" ||
        status === "CANCELLED" ||
        status === "TIMED_OUT"
      ) {
        setState("failed");
        setError(
          json?.error ||
            json?.output?.error ||
            json?.output?.message ||
            "NEO V2 generation failed."
        );
        return;
      }

      if (status === "IN_PROGRESS") {
        setState("running");
        setMessage("NEO V2 is rendering your avatar...");
      } else {
        setState("queued");
        setMessage("Waiting for GPU worker...");
      }

      timerRef.current = window.setTimeout(
        () => void pollStatus(id),
        6000
      );
    } catch (err) {
      setState("failed");
      setError(
        err instanceof Error
          ? err.message
          : "Could not check job status."
      );
    }
  };

  const generate = async () => {
    if (!imageFile) {
      setError("Choose a portrait image first.");
      return;
    }

    if (!audioFile) {
      setError("Choose an audio or video file first.");
      return;
    }

    if (busy) return;

    setError("");
    setVideoUrl("");
    setJobId("");
    setState("uploading");
    setMessage("Uploading portrait and audio...");

    try {
      const [sourceImageUrl, audioUrl] = await Promise.all([
        uploadToCloudinary(imageFile, "image"),
        uploadToCloudinary(audioFile, "video"),
      ]);

      setState("submitting");
      setMessage("Sending request to NEO V2...");

      const response = await fetch(
        "/api/creator-avatar?action=generate-video",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source_image: sourceImageUrl,
            audio_path: audioUrl,

            motion_style: motionStyle,
            emotion,

            fps,
            width: 768,
            height: 768,

            steps,
            length,

            timeout_seconds: 1500,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error || "Could not start NEO V2 generation."
        );
      }

      const id = json?.jobId || json?.videoId || json?.id;

      if (!id) {
        throw new Error(
          "RunPod accepted the request but returned no job ID."
        );
      }

      setJobId(id);
      setState("queued");
      setMessage("Job created. Waiting for GPU worker...");

      await pollStatus(id);
    } catch (err) {
      setState("failed");
      setError(
        err instanceof Error
          ? err.message
          : "Generation failed."
      );
    }
  };

  const reset = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setState("idle");
    setMessage("");
    setError("");
    setJobId("");
    setVideoUrl("");
  };

  return (
    <main className="min-h-screen bg-[#080b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-8">
          <div className="mb-4 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5 text-xs text-cyan-200">
            NeoCloud Creator Studio
          </div>

          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            NEO V2 Avatar Engine
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/45 md:text-base">
            Upload a portrait and audio or video. NeoCloud will generate
            your AI presenter automatically.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 md:p-7">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/60">
              Input
            </div>

            <h2 className="mt-2 text-xl font-semibold">
              Portrait + Audio
            </h2>

            <div className="mt-6">
              <div className="mb-2 text-sm text-white/60">
                Portrait image
              </div>

              <label className="flex min-h-40 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-center hover:border-cyan-400/30">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;

                    setImageFile(file);

                    if (imagePreview) {
                      URL.revokeObjectURL(imagePreview);
                    }

                    if (file) {
                      setImagePreview(URL.createObjectURL(file));
                    } else {
                      setImagePreview("");
                    }
                  }}
                />

                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Portrait preview"
                    className="max-h-72 rounded-xl object-contain"
                  />
                ) : (
                  <div>
                    <div className="text-sm font-medium">
                      Click to upload portrait
                    </div>
                    <div className="mt-2 text-xs text-white/35">
                      JPG, PNG or WEBP
                    </div>
                  </div>
                )}
              </label>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-sm text-white/60">
                Audio or video
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-5 hover:border-cyan-400/30">
                <input
                  type="file"
                  accept="audio/*,video/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;

                    setAudioFile(file);
                    setAudioName(file?.name || "");
                  }}
                />

                <div>
                  <div className="text-sm font-medium">
                    {audioName || "Click to upload audio / video"}
                  </div>

                  <div className="mt-1 text-xs text-white/35">
                    MP3, WAV, M4A, MP4 and similar formats
                  </div>
                </div>
              </label>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-2 block text-sm text-white/60">
                  Motion style
                </span>

                <select
                  value={motionStyle}
                  onChange={(e) => setMotionStyle(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-2xl border border-white/10 bg-[#131820] px-4 py-3 text-sm"
                >
                  <option value="natural">Natural</option>
                  <option value="subtle">Subtle</option>
                  <option value="presenter">Presenter</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm text-white/60">
                  Emotion
                </span>

                <select
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-2xl border border-white/10 bg-[#131820] px-4 py-3 text-sm"
                >
                  <option value="neutral">Neutral</option>
                  <option value="happy">Happy</option>
                  <option value="serious">Serious</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 md:p-7">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/60">
              Generation
            </div>

            <h2 className="mt-2 text-xl font-semibold">
              Quality Controls
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSteps(4);
                  setLength(24);
                }}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4 text-left"
              >
                <div className="text-sm font-medium">Fast Test</div>
                <div className="mt-1 text-xs text-white/35">
                  24 frames · 4 steps
                </div>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSteps(12);
                  setLength(48);
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left"
              >
                <div className="text-sm font-medium">Balanced</div>
                <div className="mt-1 text-xs text-white/35">
                  48 frames · 12 steps
                </div>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSteps(18);
                  setLength(72);
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left"
              >
                <div className="text-sm font-medium">Quality Demo</div>
                <div className="mt-1 text-xs text-white/35">
                  72 frames · 18 steps
                </div>
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-semibold">{fps}</div>
                  <div className="mt-1 text-xs text-white/35">FPS</div>
                </div>

                <div>
                  <div className="text-xl font-semibold">{steps}</div>
                  <div className="mt-1 text-xs text-white/35">Steps</div>
                </div>

                <div>
                  <div className="text-xl font-semibold">{length}</div>
                  <div className="mt-1 text-xs text-white/35">Frames</div>
                </div>
              </div>
            </div>

            <select
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              disabled={busy}
              className="mt-6 w-full rounded-2xl border border-white/10 bg-[#131820] px-4 py-3 text-sm"
            >
              <option value={24}>24 FPS</option>
              <option value={25}>25 FPS</option>
            </select>

            <button
              type="button"
              onClick={generate}
              disabled={busy || !imageFile || !audioFile}
              className="mt-6 w-full rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-black disabled:bg-white/10 disabled:text-white/25"
            >
              {state === "uploading"
                ? "Uploading files..."
                : state === "submitting"
                ? "Starting NEO V2..."
                : state === "queued"
                ? "Waiting for GPU..."
                : state === "running"
                ? "Generating Video..."
                : "Generate with NEO V2"}
            </button>
          </section>
        </div>

        {(message || error || jobId || videoUrl) && (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-5 md:p-7">
            {message && (
              <p className="text-sm text-white/60">{message}</p>
            )}

            {jobId && (
              <div className="mt-4 break-all text-xs text-white/30">
                Job ID: {jobId}
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-500/[0.06] p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            {videoUrl && (
              <div className="mt-6">
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="w-full rounded-2xl"
                />

                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
                >
                  Open generated video
                </a>
              </div>
            )}

            {(state === "completed" || state === "failed") && (
              <button
                type="button"
                onClick={reset}
                className="mt-5 rounded-full border border-white/10 px-4 py-2 text-xs text-white/60"
              >
                New generation
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}