"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type JobState =
  | "idle"
  | "uploading"
  | "submitting"
  | "queued"
  | "running"
  | "completed"
  | "failed";

type QualityPreset = {
  id: "fast" | "balanced" | "quality";
  title: string;
  subtitle: string;
  steps: number;
  length: number;
};

const PRESETS: QualityPreset[] = [
  {
    id: "fast",
    title: "Fast Test",
    subtitle: "Quick pipeline check",
    steps: 4,
    length: 24,
  },
  {
    id: "balanced",
    title: "Balanced",
    subtitle: "Best speed / quality",
    steps: 12,
    length: 48,
  },
  {
    id: "quality",
    title: "Quality Demo",
    subtitle: "Higher quality output",
    steps: 18,
    length: 72,
  },
];

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

  const currentPreset = useMemo(() => {
    return (
      PRESETS.find(
        (preset) =>
          preset.steps === steps &&
          preset.length === length
      )?.id || "custom"
    );
  }, [steps, length]);

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
        `/api/creator-avatar?action=video-status&id=${encodeURIComponent(
          id
        )}`,
        {
          cache: "no-store",
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Could not check NEO V2 job status."
        );
      }

      const status = String(
        json?.status || ""
      ).toUpperCase();

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
        setMessage("Your NEO V2 video is ready.");
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
        setMessage(
          "NEO V2 is rendering your avatar..."
        );
      } else {
        setState("queued");
        setMessage(
          "Waiting for available GPU worker..."
        );
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
      setError(
        "Choose an audio or video file first."
      );
      return;
    }

    if (busy) return;

    setError("");
    setVideoUrl("");
    setJobId("");

    setState("uploading");
    setMessage(
      "Uploading portrait and audio securely..."
    );

    try {
      const [sourceImageUrl, audioUrl] =
        await Promise.all([
          uploadToCloudinary(imageFile, "image"),
          uploadToCloudinary(audioFile, "video"),
        ]);

      setState("submitting");
      setMessage(
        "Sending generation request to NEO V2..."
      );

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
          json?.error ||
            "Could not start NEO V2 generation."
        );
      }

      const id =
        json?.jobId ||
        json?.videoId ||
        json?.id;

      if (!id) {
        throw new Error(
          "RunPod accepted the request but returned no job ID."
        );
      }

      setJobId(id);
      setState("queued");
      setMessage(
        "Generation job created. Waiting for GPU..."
      );

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

  const getProgress = () => {
    if (state === "uploading") return 20;
    if (state === "submitting") return 35;
    if (state === "queued") return 50;
    if (state === "running") return 78;
    if (state === "completed") return 100;
    return 0;
  };

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8 lg:px-10">

        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1.5 text-xs text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              NeoCloud Creator Studio
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
              NEO V2{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                Avatar Engine
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/45 md:text-base">
              Create AI presenter videos from a single
              portrait and audio track using NeoCloud&apos;s
              own NEO V2 generation pipeline.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]" />

            <div>
              <p className="text-xs font-medium text-white">
                NEO V2 Engine
              </p>
              <p className="text-[11px] text-white/35">
                RunPod Serverless
              </p>
            </div>
          </div>
        </div>

        {/* WORKSPACE */}

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">

          {/* LEFT SIDE */}

          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.025] shadow-2xl shadow-black/20">

            <div className="border-b border-white/10 px-6 py-5 md:px-7">
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300/60">
                Step 01
              </div>

              <h2 className="mt-2 text-xl font-semibold">
                Add your source
              </h2>

              <p className="mt-1 text-sm text-white/35">
                Upload one portrait and one audio or
                video file.
              </p>
            </div>

            <div className="space-y-6 p-6 md:p-7">

              {/* PORTRAIT */}

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-white/70">
                    Portrait image
                  </span>

                  <span className="text-xs text-white/25">
                    JPG · PNG · WEBP
                  </span>
                </div>

                <label className="group relative flex min-h-[280px] cursor-pointer items-center justify-center overflow-hidden rounded-3xl border border-dashed border-white/15 bg-black/25 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.025]">

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const file =
                        e.target.files?.[0] || null;

                      setImageFile(file);

                      if (imagePreview) {
                        URL.revokeObjectURL(
                          imagePreview
                        );
                      }

                      if (file) {
                        setImagePreview(
                          URL.createObjectURL(file)
                        );
                      } else {
                        setImagePreview("");
                      }
                    }}
                  />

                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview}
                        alt="Portrait preview"
                        className="max-h-[390px] w-full object-contain"
                      />

                      {!busy && (
                        <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-black/65 px-4 py-3 text-center text-xs text-white/70 opacity-0 backdrop-blur-xl transition group-hover:opacity-100">
                          Click to replace portrait
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-6 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] text-2xl">
                        +
                      </div>

                      <div className="mt-4 text-sm font-semibold">
                        Upload portrait
                      </div>

                      <div className="mt-2 text-xs text-white/35">
                        Choose a clear front-facing image
                      </div>
                    </div>
                  )}
                </label>
              </div>

              {/* AUDIO */}

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-white/70">
                    Audio or video
                  </span>

                  <span className="text-xs text-white/25">
                    MP3 · WAV · M4A · MP4
                  </span>
                </div>

                <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-black/25 p-4 transition hover:border-violet-400/40">

                  <input
                    type="file"
                    accept="audio/*,video/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const file =
                        e.target.files?.[0] || null;

                      setAudioFile(file);
                      setAudioName(file?.name || "");
                    }}
                  />

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-xl">
                    ♪
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {audioName ||
                        "Upload audio or video"}
                    </div>

                    <div className="mt-1 text-xs text-white/35">
                      {audioName
                        ? "File ready for generation"
                        : "Click to choose source audio"}
                    </div>
                  </div>
                </label>
              </div>

              {/* MOTION */}

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/35">
                    Motion Style
                  </span>

                  <select
                    value={motionStyle}
                    onChange={(e) =>
                      setMotionStyle(e.target.value)
                    }
                    disabled={busy}
                    className="w-full rounded-2xl border border-white/10 bg-[#10151d] px-4 py-3.5 text-sm text-white outline-none transition focus:border-cyan-400/40"
                  >
                    <option value="natural">
                      Natural
                    </option>

                    <option value="subtle">
                      Subtle
                    </option>

                    <option value="presenter">
                      Presenter
                    </option>
                  </select>
                </label>

                <label>
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/35">
                    Emotion
                  </span>

                  <select
                    value={emotion}
                    onChange={(e) =>
                      setEmotion(e.target.value)
                    }
                    disabled={busy}
                    className="w-full rounded-2xl border border-white/10 bg-[#10151d] px-4 py-3.5 text-sm text-white outline-none transition focus:border-violet-400/40"
                  >
                    <option value="neutral">
                      Neutral
                    </option>

                    <option value="happy">
                      Happy
                    </option>

                    <option value="serious">
                      Serious
                    </option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          {/* RIGHT SIDE */}

          <section className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.025] p-6 shadow-2xl shadow-black/20 md:p-7">

            <div className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300/60">
              Step 02
            </div>

            <h2 className="mt-2 text-xl font-semibold">
              Generation settings
            </h2>

            <p className="mt-1 text-sm text-white/35">
              Choose your generation quality and motion
              settings.
            </p>

            {/* PRESETS */}

            <div className="mt-7 space-y-3">
              {PRESETS.map((preset) => {
                const active =
                  currentPreset === preset.id;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setSteps(preset.steps);
                      setLength(preset.length);
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-blue-400/50 bg-gradient-to-r from-blue-500/15 to-violet-500/10 shadow-lg shadow-blue-500/5"
                        : "border-white/10 bg-black/20 hover:border-white/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {preset.title}
                        </span>

                        {preset.id === "balanced" && (
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300">
                            Recommended
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-white/35">
                        {preset.subtitle}
                      </p>
                    </div>

                    <div className="text-right text-xs text-white/40">
                      <div>
                        {preset.length} frames
                      </div>
                      <div className="mt-1">
                        {preset.steps} steps
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* STATS */}

            <div className="mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-black/20 py-5 text-center">
              <div>
                <div className="text-2xl font-semibold">
                  {fps}
                </div>

                <div className="mt-1 text-[11px] uppercase tracking-wider text-white/30">
                  FPS
                </div>
              </div>

              <div>
                <div className="text-2xl font-semibold">
                  {steps}
                </div>

                <div className="mt-1 text-[11px] uppercase tracking-wider text-white/30">
                  Steps
                </div>
              </div>

              <div>
                <div className="text-2xl font-semibold">
                  {length}
                </div>

                <div className="mt-1 text-[11px] uppercase tracking-wider text-white/30">
                  Frames
                </div>
              </div>
            </div>

            {/* FPS */}

            <div className="mt-6">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/35">
                Frame Rate
              </span>

              <select
                value={fps}
                onChange={(e) =>
                  setFps(Number(e.target.value))
                }
                disabled={busy}
                className="w-full rounded-2xl border border-white/10 bg-[#10151d] px-4 py-3.5 text-sm text-white outline-none transition focus:border-blue-400/40"
              >
                <option value={24}>24 FPS</option>
                <option value={25}>25 FPS</option>
              </select>
            </div>

            {/* SUMMARY */}

            <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/[0.06] to-violet-500/[0.06] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/35">
                Generation Summary
              </p>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">
                    Resolution
                  </span>
                  <span>768 × 768</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-white/40">
                    Motion
                  </span>
                  <span className="capitalize">
                    {motionStyle}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-white/40">
                    Emotion
                  </span>
                  <span className="capitalize">
                    {emotion}
                  </span>
                </div>
              </div>
            </div>

            {/* GENERATE BUTTON */}

            <button
              type="button"
              onClick={generate}
              disabled={
                busy ||
                !imageFile ||
                !audioFile
              }
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-4 text-sm font-semibold text-white shadow-xl shadow-blue-600/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
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

            {!imageFile || !audioFile ? (
              <p className="mt-3 text-center text-xs text-white/25">
                Upload portrait and audio to continue.
              </p>
            ) : (
              <p className="mt-3 text-center text-xs text-emerald-400/70">
                Ready to generate
              </p>
            )}
          </section>
        </div>

        {/* GENERATION STATUS / RESULT */}

        {(message ||
          error ||
          jobId ||
          videoUrl) && (
          <section className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.025]">

            <div className="border-b border-white/10 p-6 md:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-blue-300/60">
                    Generation
                  </div>

                  <h2 className="mt-2 text-xl font-semibold">
                    {state === "completed"
                      ? "Generation complete"
                      : state === "failed"
                      ? "Generation failed"
                      : "NEO V2 is working"}
                  </h2>
                </div>

                {jobId && (
                  <div className="max-w-sm truncate rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] text-white/35">
                    Job {jobId}
                  </div>
                )}
              </div>

              {busy && (
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-white/45">
                      {message}
                    </span>

                    <span className="text-blue-300">
                      {getProgress()}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all duration-700"
                      style={{
                        width: `${getProgress()}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 md:p-7">
              {error && (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.07] p-4 text-sm text-red-200">
                  {error}
                </div>
              )}

              {videoUrl && (
                <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
                  <div className="overflow-hidden rounded-3xl border border-white/10 bg-black">
                    <video
                      src={videoUrl}
                      controls
                      playsInline
                      className="aspect-square w-full object-contain"
                    />
                  </div>

                  <div className="flex flex-col rounded-3xl border border-white/10 bg-black/20 p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-xl">
                      ✓
                    </div>

                    <h3 className="mt-5 text-xl font-semibold">
                      Your avatar is ready
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-white/40">
                      NEO V2 successfully generated your
                      AI presenter video.
                    </p>

                    <div className="mt-6 space-y-3 text-sm">
                      <div className="flex justify-between border-b border-white/5 pb-3">
                        <span className="text-white/35">
                          FPS
                        </span>
                        <span>{fps}</span>
                      </div>

                      <div className="flex justify-between border-b border-white/5 pb-3">
                        <span className="text-white/35">
                          Frames
                        </span>
                        <span>{length}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-white/35">
                          Status
                        </span>

                        <span className="text-emerald-400">
                          Completed
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto pt-8">
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
                      >
                        Open generated video
                      </a>

                      <button
                        type="button"
                        onClick={reset}
                        className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
                      >
                        New generation
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {state === "failed" && (
                <button
                  type="button"
                  onClick={reset}
                  className="mt-5 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/70 hover:bg-white/10"
                >
                  Try another generation
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}