"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type QueueItem = {
  id: string;
  createdAt: string;
  topic: string;
  title: string;
  script: string;
  status: "script-ready" | "rendering" | "ready" | "failed";
  videoId?: string;
  videoUrl?: string;
  error?: string;
};

type AvatarProfile = {
  avatarId?: string;
  voiceId?: string;
  defaultVoiceId?: string;
  name?: string;
};

const CONFIG_KEY = "neocloud_creator_autopilot_v1_config";
const QUEUE_KEY = "neocloud_creator_autopilot_v1_queue";
const AVATAR_KEY = "neocloud_creator_avatar_v1_1";
const RUN_KEY = "neocloud_creator_autopilot_v1_runs";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CreatorAutopilot() {
  const [topic, setTopic] = useState(
    "AI, startups and important technology updates"
  );
  const [videosPerDay, setVideosPerDay] = useState(3);
  const [times, setTimes] = useState(["09:00", "14:00", "20:00"]);
  const [language, setLanguage] = useState("English");
  const [duration, setDuration] = useState("45");
  const [style, setStyle] = useState(
    "Clear, energetic, factual creator-style delivery with a strong hook."
  );
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [autoRender, setAutoRender] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [avatar, setAvatar] = useState<AvatarProfile>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");

      if (saved.topic) setTopic(saved.topic);
      if (saved.videosPerDay) setVideosPerDay(saved.videosPerDay);
      if (Array.isArray(saved.times)) setTimes(saved.times);
      if (saved.language) setLanguage(saved.language);
      if (saved.duration) setDuration(saved.duration);
      if (saved.style) setStyle(saved.style);
      if (typeof saved.autopilotOn === "boolean")
        setAutopilotOn(saved.autopilotOn);
      if (typeof saved.autoRender === "boolean")
        setAutoRender(saved.autoRender);

      const savedQueue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      if (Array.isArray(savedQueue)) setQueue(savedQueue);

      const avatarSaved = JSON.parse(localStorage.getItem(AVATAR_KEY) || "{}");
      setAvatar(avatarSaved || {});
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        topic,
        videosPerDay,
        times,
        language,
        duration,
        style,
        autopilotOn,
        autoRender,
      })
    );
  }, [
    topic,
    videosPerDay,
    times,
    language,
    duration,
    style,
    autopilotOn,
    autoRender,
  ]);

  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, [queue]);

  const activeTimes = useMemo(
    () => times.slice(0, Math.max(1, Math.min(4, videosPerDay))),
    [times, videosPerDay]
  );

  const updateTime = (index: number, value: string) => {
    setTimes((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const pollVideo = async (
    videoId: string,
    queueId: string,
    maxAttempts = 80
  ) => {
    let attempts = 0;

    const check = async (): Promise<void> => {
      attempts += 1;

      try {
        const response = await fetch(
          `/api/creator-avatar?action=video-status&id=${encodeURIComponent(
            videoId
          )}`,
          { cache: "no-store" }
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json?.error || "Could not check avatar video.");
        }

        if (json.failureMessage) {
          setQueue((current) =>
            current.map((item) =>
              item.id === queueId
                ? {
                    ...item,
                    status: "failed",
                    error: json.failureMessage,
                  }
                : item
            )
          );
          return;
        }

        if (json.videoUrl) {
          setQueue((current) =>
            current.map((item) =>
              item.id === queueId
                ? {
                    ...item,
                    status: "ready",
                    videoUrl: json.videoUrl,
                  }
                : item
            )
          );
          return;
        }

        if (attempts >= maxAttempts) {
          setQueue((current) =>
            current.map((item) =>
              item.id === queueId
                ? {
                    ...item,
                    status: "failed",
                    error: "Rendering took too long. Check again later.",
                  }
                : item
            )
          );
          return;
        }

        window.setTimeout(() => void check(), 7000);
      } catch (e) {
        setQueue((current) =>
          current.map((item) =>
            item.id === queueId
              ? {
                  ...item,
                  status: "failed",
                  error:
                    e instanceof Error ? e.message : "Video rendering failed.",
                }
              : item
          )
        );
      }
    };

    await check();
  };

  const renderItem = async (item: QueueItem) => {
    if (!avatar.avatarId) {
      setError(
        "No saved Creator Avatar found. Create/save an avatar in Creator Avatar V1.1 first."
      );
      return;
    }

    setQueue((current) =>
      current.map((q) =>
        q.id === item.id ? { ...q, status: "rendering", error: "" } : q
      )
    );

    try {
      const response = await fetch(
        "/api/creator-avatar?action=generate-video",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatarId: avatar.avatarId,
            voiceId: avatar.voiceId || avatar.defaultVoiceId || undefined,
            script: item.script,
            aspectRatio: "9:16",
            resolution: "720p",
            expressiveness: "low",
            motionPrompt:
              "Very subtle natural presenter movement. Keep the face stable, maintain natural eye contact, use minimal head movement, no exaggerated gestures.",
            voiceSpeed: 1,
            voicePitch: 0,
            voiceLocale: language,
            title: item.title,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Could not start avatar render.");
      }

      if (!json.videoId) {
        throw new Error("No video ID returned.");
      }

      setQueue((current) =>
        current.map((q) =>
          q.id === item.id
            ? { ...q, status: "rendering", videoId: json.videoId }
            : q
        )
      );

      await pollVideo(json.videoId, item.id);
    } catch (e) {
      setQueue((current) =>
        current.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: "failed",
                error:
                  e instanceof Error ? e.message : "Avatar render failed.",
              }
            : q
        )
      );
    }
  };

  const createOne = async (source = "manual") => {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("NeoCloud is creating a fresh creator script...");

    try {
      const recentTopics = queue.slice(0, 12).map((item) => item.title);

      const response = await fetch(
        "/api/creator-autopilot?action=create-script",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            language,
            durationSeconds: Number(duration),
            style,
            recentTopics,
            source,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Could not create creator script.");
      }

      const item: QueueItem = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        topic,
        title: json.title || "NeoCloud Creator Video",
        script: json.script || "",
        status: "script-ready",
      };

      setQueue((current) => [item, ...current]);
      setMessage("Script created and added to Review Queue.");

      if (autoRender) {
        await renderItem(item);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Creator Autopilot generation failed."
      );
    } finally {
      setBusy(false);
    }
  };

  const markScheduledRun = (slot: string) => {
    try {
      const key = todayKey();
      const runs = JSON.parse(localStorage.getItem(RUN_KEY) || "{}");
      const dayRuns: string[] = Array.isArray(runs[key]) ? runs[key] : [];

      if (!dayRuns.includes(slot)) {
        dayRuns.push(slot);
      }

      runs[key] = dayRuns;

      const keys = Object.keys(runs).sort().reverse();
      for (const oldKey of keys.slice(7)) {
        delete runs[oldKey];
      }

      localStorage.setItem(RUN_KEY, JSON.stringify(runs));
    } catch {}
  };

  const alreadyRan = (slot: string) => {
    try {
      const key = todayKey();
      const runs = JSON.parse(localStorage.getItem(RUN_KEY) || "{}");
      return Array.isArray(runs[key]) && runs[key].includes(slot);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!autopilotOn) return;

    const checkSchedule = async () => {
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      for (const slot of activeTimes) {
        if (slot === current && !alreadyRan(slot) && !busy) {
          markScheduledRun(slot);
          await createOne(`scheduled-${slot}`);
          break;
        }
      }
    };

    void checkSchedule();

    timerRef.current = window.setInterval(() => {
      void checkSchedule();
    }, 30000);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autopilotOn, activeTimes, busy]);

  const deleteItem = (id: string) => {
    setQueue((current) => current.filter((item) => item.id !== id));
  };

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-8">
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
            NeoCloud Creator Studio
          </div>
          <h1 className="text-3xl font-semibold md:text-5xl">
            Creator Autopilot V1
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50 md:text-base">
            Set your content rules once. NeoCloud creates scripts on schedule,
            optionally renders them with your saved Creator Avatar, and keeps
            everything in a Review Queue.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[28px] border border-white/10 bg-[#171717] p-5 md:p-7">
            <h2 className="text-lg font-semibold">1. Autopilot Setup</h2>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/60">
                Content topic / niche
              </span>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm leading-6 outline-none"
              />
            </label>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-2 block text-sm text-white/60">
                  Videos per day
                </span>
                <select
                  value={videosPerDay}
                  onChange={(e) =>
                    setVideosPerDay(
                      Math.max(1, Math.min(4, Number(e.target.value)))
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
                >
                  <option value={1}>1 video</option>
                  <option value={2}>2 videos</option>
                  <option value={3}>3 videos</option>
                  <option value={4}>4 videos</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm text-white/60">
                  Video length
                </span>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
                >
                  <option value="30">~30 sec</option>
                  <option value="45">~45 sec</option>
                  <option value="60">~60 sec</option>
                </select>
              </label>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/60">
                Language
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
              >
                <option>English</option>
                <option>Bengali</option>
                <option>Hindi</option>
              </select>
            </label>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/60">
                Creator style
              </span>
              <textarea
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm leading-6"
              />
            </label>

            <div className="mt-5">
              <div className="mb-2 text-sm text-white/60">Daily times</div>
              <div className="grid grid-cols-2 gap-3">
                {activeTimes.map((value, index) => (
                  <input
                    key={index}
                    type="time"
                    value={value}
                    onChange={(e) => updateTime(index, e.target.value)}
                    className="rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-sm"
                  />
                ))}
              </div>
            </div>

            <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div>
                <div className="text-sm font-medium">
                  Auto-render avatar videos
                </div>
                <div className="mt-1 text-xs leading-5 text-white/35">
                  ON = script is sent to your saved Creator Avatar
                  automatically. This can consume HeyGen credits.
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoRender}
                onChange={(e) => setAutoRender(e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
              <div>
                <div className="text-sm font-medium">Autopilot</div>
                <div className="mt-1 text-xs leading-5 text-white/35">
                  V1 scheduling runs while this browser page remains open.
                </div>
              </div>
              <input
                type="checkbox"
                checked={autopilotOn}
                onChange={(e) => setAutopilotOn(e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-medium">
                Creator Avatar connection
              </div>
              <div className="mt-2 text-xs leading-5 text-white/40">
                {avatar.avatarId
                  ? `Connected ✓ ${avatar.name || "Saved NeoCloud Avatar"}`
                  : "No saved Creator Avatar found. Scripts still work, but automatic avatar rendering needs Creator Avatar V1.1 first."}
              </div>
            </div>

            <button
              type="button"
              disabled={busy || !topic.trim()}
              onClick={() => void createOne("manual")}
              className="mt-5 w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black disabled:bg-white/15 disabled:text-white/30"
            >
              {busy ? "Creating..." : "Create One Now"}
            </button>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#171717] p-5 md:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">2. Review Queue</h2>
                <p className="mt-1 text-sm text-white/40">
                  Nothing is auto-published in V1.
                </p>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/50">
                {queue.length} item{queue.length === 1 ? "" : "s"}
              </div>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl border border-blue-400/10 bg-blue-400/[0.04] p-4 text-sm text-blue-100/70">
                {message}
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-500/[0.06] p-4 text-sm text-red-200/80">
                {error}
              </div>
            )}

            {queue.length === 0 ? (
              <div className="mt-5 flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <div>
                  <div className="text-lg font-medium text-white/70">
                    Queue is empty
                  </div>
                  <div className="mt-2 max-w-sm text-sm leading-6 text-white/35">
                    Press “Create One Now” or turn Autopilot on and keep this
                    page open.
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {queue.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="mt-1 text-xs text-white/30">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div
                        className={`rounded-full px-3 py-1 text-[11px] ${
                          item.status === "ready"
                            ? "bg-emerald-500/10 text-emerald-200"
                            : item.status === "failed"
                            ? "bg-red-500/10 text-red-200"
                            : "bg-blue-500/10 text-blue-200"
                        }`}
                      >
                        {item.status}
                      </div>
                    </div>

                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/60">
                      {item.script}
                    </p>

                    {item.error && (
                      <div className="mt-4 rounded-xl bg-red-500/[0.06] p-3 text-xs text-red-200/75">
                        {item.error}
                      </div>
                    )}

                    {item.videoUrl && (
                      <video
                        src={item.videoUrl}
                        controls
                        className="mt-4 aspect-[9/16] max-h-[520px] w-full rounded-2xl bg-black object-contain"
                      />
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.status === "script-ready" && avatar.avatarId && (
                        <button
                          type="button"
                          onClick={() => void renderItem(item)}
                          className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black"
                        >
                          Render Avatar Video
                        </button>
                      )}

                      {item.videoUrl && (
                        <a
                          href={item.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-white/10 px-4 py-2 text-xs text-white/70"
                        >
                          Open Video
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        className="rounded-full bg-white/10 px-4 py-2 text-xs text-white/55"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}