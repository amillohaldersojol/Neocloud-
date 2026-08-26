"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

type Mode = "economy" | "premium";
type JobState = "idle" | "starting" | "processing" | "completed" | "failed";

const LANGUAGES = [
  { label: "English", eleven: "en", heygen: "English" },
  { label: "Bengali", eleven: "bn", heygen: "Bengali" },
  { label: "Hindi", eleven: "hi", heygen: "Hindi" },
  { label: "Spanish", eleven: "es", heygen: "Spanish (Spain)" },
  { label: "French", eleven: "fr", heygen: "French" },
  { label: "German", eleven: "de", heygen: "German" },
  { label: "Italian", eleven: "it", heygen: "Italian" },
  { label: "Portuguese", eleven: "pt", heygen: "Portuguese (Brazil)" },
  { label: "Arabic", eleven: "ar", heygen: "Arabic" },
  { label: "Japanese", eleven: "ja", heygen: "Japanese" },
  { label: "Korean", eleven: "ko", heygen: "Korean" },
  { label: "Chinese", eleven: "zh", heygen: "Chinese (Mandarin, Simplified)" },
];

export default function VideoTranslator() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [mode, setMode] = useState<Mode>("economy");
  const [premiumQuality, setPremiumQuality] = useState<"speed" | "precision">("speed");
  const [target, setTarget] = useState("English");
  const [speakerCount, setSpeakerCount] = useState("0");
  const [watermark, setWatermark] = useState(true);
  const [consent, setConsent] = useState(false);
  const [jobState, setJobState] = useState<JobState>("idle");
  const [statusText, setStatusText] = useState("");
  const [jobId, setJobId] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<number | null>(null);

  const selectedLanguage = useMemo(
    () => LANGUAGES.find((x) => x.label === target) || LANGUAGES[0],
    [target]
  );

  const busy = jobState === "starting" || jobState === "processing";

  const resetJob = () => {
    if (pollRef.current !== null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setJobState("idle");
    setStatusText("");
    setJobId("");
    setOutputUrl("");
    setError("");
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files?.[0];
    if (!f) return;

    if (!/\.(mp4|webm)$/i.test(f.name) && !["video/mp4", "video/webm"].includes(f.type)) {
      setError("Please upload MP4 or WebM.");
      event.target.value = "";
      return;
    }

    const max = mode === "premium" ? 32 * 1024 * 1024 : 250 * 1024 * 1024;
    if (f.size > max) {
      setError(
        mode === "premium"
          ? "Premium V1 supports up to 32 MB."
          : "Economy V1 supports up to 250 MB."
      );
      event.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    resetJob();
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setConsent(false);
  };

  const pollEconomy = async (id: string, lang: string) => {
    const res = await fetch(
      `/api/video-translate?action=economy-status&id=${encodeURIComponent(id)}&lang=${encodeURIComponent(lang)}`,
      { cache: "no-store" }
    );
    const data = await res.json();

    if (!res.ok) throw new Error(data?.error || "Could not check dubbing status.");

    if (data.status === "failed") {
      setJobState("failed");
      setError(data.error || "Dubbing failed.");
      return;
    }

    if (data.status === "dubbed") {
      setJobState("completed");
      setStatusText("Economy translation completed.");
      setOutputUrl(
        `/api/video-translate?action=economy-download&id=${encodeURIComponent(id)}&lang=${encodeURIComponent(lang)}`
      );
      return;
    }

    setJobState("processing");
    setStatusText(`Economy Mode is processing (${data.status || "working"})...`);
    pollRef.current = window.setTimeout(() => void pollEconomy(id, lang), 5000);
  };

  const pollPremium = async (id: string) => {
    const res = await fetch(
      `/api/video-translate?action=premium-status&id=${encodeURIComponent(id)}`,
      { cache: "no-store" }
    );
    const data = await res.json();

    if (!res.ok) throw new Error(data?.error || "Could not check Premium status.");

    if (data.failureMessage) {
      setJobState("failed");
      setError(data.failureMessage);
      return;
    }

    if (data.videoUrl) {
      setJobState("completed");
      setStatusText("Premium Lip-Sync translation completed.");
      setOutputUrl(data.videoUrl);
      return;
    }

    setJobState("processing");
    setStatusText("Premium Mode is translating, cloning voices and syncing lips...");
    pollRef.current = window.setTimeout(() => void pollPremium(id), 7000);
  };

  const start = async () => {
    if (!file || !consent || busy) return;

    setError("");
    setOutputUrl("");
    setJobId("");
    setJobState("starting");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      form.append("speakerCount", speakerCount);
      form.append("targetLanguage", mode === "economy" ? selectedLanguage.eleven : selectedLanguage.heygen);
      form.append("targetLabel", selectedLanguage.label);
      form.append("premiumQuality", premiumQuality);
      form.append("watermark", watermark ? "true" : "false");

      setStatusText(mode === "economy" ? "Starting low-cost dubbing..." : "Starting Premium Lip-Sync...");

      const res = await fetch(
        `/api/video-translate?action=${mode === "economy" ? "economy-create" : "premium-create"}`,
        { method: "POST", body: form }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Could not start translation.");

      if (!data.id) throw new Error("No job ID returned.");

      setJobId(data.id);
      setJobState("processing");

      if (mode === "economy") {
        await pollEconomy(data.id, selectedLanguage.eleven);
      } else {
        await pollPremium(data.id);
      }
    } catch (e) {
      setJobState("failed");
      setError(e instanceof Error ? e.message : "Translation failed.");
    }
  };

  const fileSize = file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-8">
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
            NeoCloud Creator Studio
          </div>
          <h1 className="text-3xl font-semibold md:text-5xl">Video Translator</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50 md:text-base">
            Economy = low-cost speaker-aware dubbing. Premium = voice-preserved translation with lip-sync.
          </p>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => { setMode("economy"); resetJob(); }}
            className={`rounded-[24px] border p-5 text-left ${mode === "economy" ? "border-emerald-400/35 bg-emerald-500/[0.08]" : "border-white/10 bg-[#171717]"}`}
          >
            <div className="text-lg font-semibold">🟢 Economy</div>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Cheapest option. Automatic dubbing, multi-speaker support and voice cloning. No lip-sync reconstruction.
            </p>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => { setMode("premium"); resetJob(); }}
            className={`rounded-[24px] border p-5 text-left ${mode === "premium" ? "border-blue-400/35 bg-blue-500/[0.08]" : "border-white/10 bg-[#171717]"}`}
          >
            <div className="text-lg font-semibold">🔵 Premium Lip-Sync</div>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Higher cost. Voice cloning plus translated mouth/lip synchronization.
            </p>
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-white/10 bg-[#171717] p-5 md:p-7">
            <h2 className="text-lg font-semibold">1. Upload video</h2>
            <p className="mt-1 text-sm text-white/40">MP4 or WebM.</p>

            <input ref={inputRef} type="file" accept="video/mp4,video/webm,.mp4,.webm" className="hidden" onChange={onFile} />

            {!file ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-5 flex min-h-[280px] w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-white/15 bg-white/[0.025]"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">+</div>
                <div className="font-medium">Choose video</div>
              </button>
            ) : (
              <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-black">
                <video src={previewUrl} controls className="aspect-video w-full object-contain" />
                <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-[#151515] p-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="mt-1 text-xs text-white/35">{fileSize}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setPreviewUrl("");
                      setFile(null);
                      setConsent(false);
                      resetJob();
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    className="rounded-full bg-white/10 px-4 py-2 text-xs text-white/70"
                  >
                    Replace
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#171717] p-5 md:p-7">
            <h2 className="text-lg font-semibold">2. Settings</h2>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm text-white/60">Translate to</span>
                <select value={target} disabled={busy} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm">
                  {LANGUAGES.map((x) => <option key={x.label}>{x.label}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-white/60">Speakers</span>
                <select value={speakerCount} disabled={busy} onChange={(e) => setSpeakerCount(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm">
                  <option value="0">Auto detect</option>
                  <option value="1">1 speaker</option>
                  <option value="2">2 speakers</option>
                  <option value="3">3 speakers</option>
                  <option value="4">4 speakers</option>
                </select>
              </label>

              {mode === "premium" && (
                <div>
                  <span className="mb-2 block text-sm text-white/60">Premium quality</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPremiumQuality("speed")} className={`rounded-2xl border px-4 py-3 text-sm ${premiumQuality === "speed" ? "border-blue-400/35 bg-blue-500/10" : "border-white/10 bg-white/[0.03]"}`}>Speed</button>
                    <button type="button" onClick={() => setPremiumQuality("precision")} className={`rounded-2xl border px-4 py-3 text-sm ${premiumQuality === "precision" ? "border-blue-400/35 bg-blue-500/10" : "border-white/10 bg-white/[0.03]"}`}>Precision</button>
                  </div>
                </div>
              )}

              {mode === "economy" && (
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div>
                    <div className="text-sm font-medium">Watermark</div>
                    <div className="mt-1 text-xs text-white/35">Keep ON for the lowest ElevenLabs automatic-dubbing rate.</div>
                  </div>
                  <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} className="h-5 w-5" />
                </label>
              )}

              <label className="flex items-start gap-3 rounded-2xl border border-amber-400/10 bg-amber-400/[0.04] p-4 text-xs leading-5 text-amber-100/70">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>I own this media or have permission to translate and clone the speakers&apos; voices.</span>
              </label>

              <button
                type="button"
                disabled={!file || !consent || busy}
                onClick={start}
                className="w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black disabled:bg-white/15 disabled:text-white/30"
              >
                {jobState === "starting" && "Starting..."}
                {jobState === "processing" && "Processing..."}
                {!busy && (mode === "economy" ? "Translate with Economy" : "Translate with Premium Lip-Sync")}
              </button>
            </div>
          </section>
        </div>

        {(jobState !== "idle" || error || outputUrl) && (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-[#171717] p-5 md:p-7">
            <div className="text-sm font-medium">
              {jobState === "completed" ? "Translation complete" : jobState === "failed" ? "Translation issue" : "NeoCloud is processing your video"}
            </div>

            {statusText && <div className="mt-2 text-sm text-white/40">{statusText}</div>}
            {jobId && <div className="mt-2 break-all text-xs text-white/25">Job ID: {jobId}</div>}
            {error && <div className="mt-4 rounded-2xl border border-red-400/15 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200/80">{error}</div>}

            {busy && (
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-400/70" />
              </div>
            )}

            {outputUrl && (
              <div className="mt-6">
                <video src={outputUrl} controls className="aspect-video w-full rounded-2xl bg-black object-contain" />
                <a href={outputUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
                  Open translated video
                </a>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}