"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Voice = {
  id: string;
  name: string;
  language?: string;
  gender?: string;
  type?: "public" | "private";
  previewAudioUrl?: string;
};

type State =
  | "idle"
  | "creating"
  | "ready"
  | "generating"
  | "complete"
  | "failed";

const STORE = "neocloud_creator_avatar_v1_1";

export default function CreatorAvatar() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [name, setName] = useState("My NeoCloud Avatar");

  const [avatarId, setAvatarId] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [defaultVoiceId, setDefaultVoiceId] = useState("");

  const [script, setScript] = useState(
    "Hello! This is my NeoCloud AI avatar."
  );

  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [voiceScope, setVoiceScope] = useState<"private" | "public">("public");
  const [voiceGender, setVoiceGender] = useState<"male" | "female" | "all">(
    "male"
  );
  const [voiceLanguage, setVoiceLanguage] = useState("English");
  const [voiceSpeed, setVoiceSpeed] = useState("1");
  const [voicePitch, setVoicePitch] = useState("0");

  const [ratio, setRatio] = useState("9:16");
  const [resolution, setResolution] = useState("720p");
  const [expression, setExpression] = useState("low");
  const [motion, setMotion] = useState(
    "Very subtle natural presenter movement. Keep the face stable, maintain natural eye contact, use minimal head movement, no exaggerated gestures."
  );

  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [videoId, setVideoId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const input = useRef<HTMLInputElement | null>(null);
  const timer = useRef<number | null>(null);

  const busy = state === "creating" || state === "generating";

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");

      if (saved.avatarId) {
        setAvatarId(saved.avatarId);
        setName(saved.name || "My NeoCloud Avatar");
        setAvatarPreview(saved.preview || "");
        setDefaultVoiceId(saved.defaultVoiceId || "");
        setVoiceId(saved.voiceId || saved.defaultVoiceId || "");
        setState("ready");
      }
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }

      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === voiceId),
    [voices, voiceId]
  );

  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Use a JPG or PNG portrait.");
      e.target.value = "";
      return;
    }

    if (file.size > 32 * 1024 * 1024) {
      setError("Photo must be 32 MB or smaller.");
      e.target.value = "";
      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setError("");
  };

  const loadVoices = async (
    scope: "private" | "public" = voiceScope,
    gender: "male" | "female" | "all" = voiceGender
  ) => {
    setError("");
    setMessage("Loading available voices...");

    try {
      const params = new URLSearchParams({
        action: "voices",
        type: scope,
        language: voiceLanguage,
      });

      if (gender !== "all") {
        params.set("gender", gender);
      }

      const response = await fetch(`/api/creator-avatar?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Could not load HeyGen voices.");
      }

      const list: Voice[] = json.voices || [];
      setVoices(list);

      if (list.length > 0) {
        setVoiceId(list[0].id);
        setMessage(
          scope === "private"
            ? "Private/cloned voices loaded."
            : "Public voices loaded."
        );
      } else {
        setVoiceId("");
        setMessage(
          scope === "private"
            ? "No private cloned voices were found in your HeyGen account."
            : "No voices matched this filter."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load voices.");
    }
  };

  const create = async () => {
    if (!photo || !consent || busy) return;

    setState("creating");
    setError("");
    setMessage("Uploading portrait and creating reusable avatar...");

    try {
      const form = new FormData();
      form.append("photo", photo);
      form.append("name", name);

      const response = await fetch(
        "/api/creator-avatar?action=create-avatar",
        {
          method: "POST",
          body: form,
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Avatar creation failed.");
      }

      if (!json.avatarId) {
        throw new Error("HeyGen returned no avatar ID.");
      }

      setAvatarId(json.avatarId);
      setAvatarPreview(json.previewImageUrl || preview);
      setDefaultVoiceId(json.defaultVoiceId || "");

      if (json.defaultVoiceId) {
        setVoiceId(json.defaultVoiceId);
      }

      setState("ready");
      setMessage(
        "Avatar ready. For the best voice match, choose a private cloned voice if your account has one."
      );

      localStorage.setItem(
        STORE,
        JSON.stringify({
          avatarId: json.avatarId,
          name,
          preview: json.previewImageUrl || "",
          defaultVoiceId: json.defaultVoiceId || "",
          voiceId: json.defaultVoiceId || "",
        })
      );
    } catch (e) {
      setState("failed");
      setError(e instanceof Error ? e.message : "Avatar creation failed.");
    }
  };

  const poll = async (id: string) => {
    try {
      const response = await fetch(
        `/api/creator-avatar?action=video-status&id=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Status check failed.");
      }

      if (json.failureMessage) {
        setState("failed");
        setError(json.failureMessage);
        return;
      }

      if (json.videoUrl) {
        setVideoUrl(json.videoUrl);
        setState("complete");
        setMessage("Creator Avatar video is ready.");
        return;
      }

      setState("generating");
      setMessage(
        `Rendering more natural avatar video${
          json.status ? ` (${json.status})` : ""
        }...`
      );

      timer.current = window.setTimeout(() => void poll(id), 7000);
    } catch (e) {
      setState("failed");
      setError(e instanceof Error ? e.message : "Status check failed.");
    }
  };

  const generate = async () => {
    if (!avatarId || !script.trim() || busy) return;

    setState("generating");
    setError("");
    setVideoUrl("");
    setMessage("Starting realistic avatar render...");

    try {
      const response = await fetch(
        "/api/creator-avatar?action=generate-video",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatarId,
            script: script.trim(),
            voiceId: voiceId || defaultVoiceId || undefined,
            aspectRatio: ratio,
            resolution,
            expressiveness: expression,
            motionPrompt: motion,
            voiceSpeed: Number(voiceSpeed),
            voicePitch: Number(voicePitch),
            voiceLocale: voiceLanguage,
            title: `${name} - NeoCloud Creator`,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Could not generate video.");
      }

      if (!json.videoId) {
        throw new Error("HeyGen returned no video ID.");
      }

      setVideoId(json.videoId);
      await poll(json.videoId);
    } catch (e) {
      setState("failed");
      setError(e instanceof Error ? e.message : "Video generation failed.");
    }
  };

  const reset = () => {
    localStorage.removeItem(STORE);
    setAvatarId("");
    setAvatarPreview("");
    setDefaultVoiceId("");
    setVoiceId("");
    setVoices([]);
    setVideoId("");
    setVideoUrl("");
    setState("idle");
    setMessage("");
    setError("");
  };

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-8">
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
            NeoCloud Creator Studio
          </div>

          <h1 className="text-3xl font-semibold md:text-5xl">
            Creator Avatar V1.1
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50 md:text-base">
            Improved voice control and more conservative motion settings for a
            more natural creator-avatar result.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-white/10 bg-[#171717] p-5 md:p-7">
            <div className="flex justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">1. Your Avatar</h2>
                <p className="mt-1 text-sm text-white/40">
                  Use a well-lit, front-facing portrait with a neutral
                  expression.
                </p>
              </div>

              {avatarId && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs"
                >
                  New avatar
                </button>
              )}
            </div>

            {!avatarId ? (
              <>
                <input
                  ref={input}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={choose}
                />

                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="mt-5 flex min-h-[330px] w-full items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-white/15 bg-white/[0.025]"
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt="Portrait preview"
                      className="h-[330px] w-full object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">
                        +
                      </div>
                      <div>Choose portrait</div>
                      <div className="mt-2 text-xs text-white/35">
                        JPG / PNG · max 32 MB
                      </div>
                    </div>
                  )}
                </button>

                <label className="mt-5 block">
                  <span className="mb-2 block text-sm text-white/60">
                    Avatar name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
                  />
                </label>

                <label className="mt-5 flex gap-3 rounded-2xl border border-amber-400/10 bg-amber-400/[0.04] p-4 text-xs leading-5 text-amber-100/70">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    I am this person or I have explicit permission to create
                    and use this person&apos;s AI avatar.
                  </span>
                </label>

                <button
                  disabled={!photo || !consent || busy}
                  onClick={create}
                  className="mt-5 w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black disabled:bg-white/15 disabled:text-white/30"
                >
                  {state === "creating"
                    ? "Creating Avatar..."
                    : "Create My Avatar"}
                </button>
              </>
            ) : (
              <div className="mt-5">
                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Saved avatar"
                      className="h-[330px] w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-[250px] items-center justify-center text-white/35">
                      Avatar ready
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] p-4">
                  <div className="text-sm font-medium text-emerald-200">
                    ✓ Reusable avatar ready
                  </div>
                  <div className="mt-2 break-all text-xs text-white/35">
                    Avatar ID: {avatarId}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#171717] p-5 md:p-7">
            <h2 className="text-lg font-semibold">2. Voice + Video</h2>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/60">Script</span>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={6}
                maxLength={5000}
                className="w-full resize-none rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm leading-6"
              />
            </label>

            <div className="mt-5 rounded-2xl border border-blue-400/10 bg-blue-400/[0.04] p-4">
              <div className="text-sm font-medium">Voice source</div>
              <p className="mt-1 text-xs leading-5 text-white/40">
                If you have a cloned/private voice in HeyGen, choose Private.
                Otherwise choose a public male/female voice.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVoiceScope("private");
                    void loadVoices("private", voiceGender);
                  }}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    voiceScope === "private"
                      ? "border-blue-400/35 bg-blue-500/10"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  My cloned voices
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVoiceScope("public");
                    void loadVoices("public", voiceGender);
                  }}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    voiceScope === "public"
                      ? "border-blue-400/35 bg-blue-500/10"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  Public voices
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setVoiceGender("male");
                    void loadVoices(voiceScope, "male");
                  }}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    voiceGender === "male"
                      ? "border-white/25 bg-white/10"
                      : "border-white/10"
                  }`}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceGender("female");
                    void loadVoices(voiceScope, "female");
                  }}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    voiceGender === "female"
                      ? "border-white/25 bg-white/10"
                      : "border-white/10"
                  }`}
                >
                  Female
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceGender("all");
                    void loadVoices(voiceScope, "all");
                  }}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    voiceGender === "all"
                      ? "border-white/25 bg-white/10"
                      : "border-white/10"
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/60">
                Voice language
              </span>
              <select
                value={voiceLanguage}
                onChange={(e) => setVoiceLanguage(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
              >
                <option>English</option>
                <option>Bengali</option>
                <option>Hindi</option>
                <option>Spanish</option>
                <option>Arabic</option>
              </select>
            </label>

            <div className="mt-5">
              <div className="mb-2 flex justify-between">
                <span className="text-sm text-white/60">Selected voice</span>
                <button
                  type="button"
                  onClick={() => void loadVoices()}
                  className="text-xs text-blue-300"
                >
                  Refresh voices
                </button>
              </div>

              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
              >
                <option value="">
                  {defaultVoiceId
                    ? "Use avatar default voice"
                    : "Choose a voice"}
                </option>

                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                    {voice.gender ? ` · ${voice.gender}` : ""}
                    {voice.language ? ` · ${voice.language}` : ""}
                  </option>
                ))}
              </select>

              {selectedVoice?.previewAudioUrl && (
                <audio
                  key={selectedVoice.previewAudioUrl}
                  src={selectedVoice.previewAudioUrl}
                  controls
                  className="mt-3 w-full"
                />
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-2 block text-sm text-white/60">
                  Voice speed
                </span>
                <select
                  value={voiceSpeed}
                  onChange={(e) => setVoiceSpeed(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
                >
                  <option value="0.9">0.9× Natural slow</option>
                  <option value="1">1.0× Normal</option>
                  <option value="1.05">1.05× Slightly faster</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm text-white/60">
                  Voice pitch
                </span>
                <select
                  value={voicePitch}
                  onChange={(e) => setVoicePitch(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
                >
                  <option value="-2">Lower</option>
                  <option value="0">Normal</option>
                  <option value="2">Higher</option>
                </select>
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-2 block text-sm text-white/60">
                  Aspect ratio
                </span>
                <select
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
                >
                  <option value="9:16">9:16 · Reels</option>
                  <option value="16:9">16:9 · YouTube</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm text-white/60">
                  Resolution
                </span>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
                >
                  <option value="720p">720p · MVP</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/60">
                Expressiveness
              </span>
              <select
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
              >
                <option value="low">Low · most stable</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/60">
                Motion direction
              </span>
              <textarea
                value={motion}
                onChange={(e) => setMotion(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm leading-6"
              />
            </label>

            <button
              disabled={!avatarId || !script.trim() || busy}
              onClick={generate}
              className="mt-5 w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black disabled:bg-white/15 disabled:text-white/30"
            >
              {state === "generating"
                ? "Generating Video..."
                : "Generate More Natural Video"}
            </button>
          </section>
        </div>

        {(message || error || videoUrl) && (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-[#171717] p-5 md:p-7">
            {message && <p className="text-sm text-white/45">{message}</p>}

            {videoId && (
              <p className="mt-2 break-all text-xs text-white/25">
                Video ID: {videoId}
              </p>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-red-400/15 bg-red-500/[0.06] p-4 text-sm text-red-200/80">
                {error}
              </div>
            )}

            {busy && (
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-400/70" />
              </div>
            )}

            {videoUrl && (
              <div className="mt-6">
                <video
                  src={videoUrl}
                  controls
                  className="mx-auto max-h-[720px] w-full rounded-2xl bg-black object-contain"
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
          </section>
        )}
      </div>
    </main>
  );
}