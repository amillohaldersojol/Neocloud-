"use client";

import { useRouter } from "next/navigation";

export default function DashboardHome() {
  const router = useRouter();

  const tools = [
    {
      title: "AI Chat",
      description: "Ask, research and solve anything.",
      action: () => router.push("/ai-chat"),
    },
    {
      title: "Creator Avatar",
      description: "Turn image + audio into AI video.",
      action: () => router.push("/creator-avatar"),
    },
    {
      title: "Video Translator",
      description: "Translate videos with AI.",
      action: () => router.push("/video-translator"),
    },
    {
      title: "Creator Autopilot",
      description: "Automate creator workflows.",
      action: () => router.push("/creator-autopilot"),
    },
    {
      title: "Projects",
      description: "Organize your work and generations.",
      action: () => router.push("/projects"),
    },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-[#0b1220] via-[#111827] to-[#090d16] p-8 shadow-2xl">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-32 h-56 w-56 rounded-full bg-purple-600/20 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
            NeoCloud AI Operating System
          </span>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Create Without Limits
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-400">
            Chat, create, automate and generate with NeoCloud.
            Your AI workspace for models, agents and creative workflows.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/creator-avatar")}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:scale-[1.02]"
            >
              Create with NEO V2
            </button>

            <button
              onClick={() => router.push("/projects")}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Open Projects
            </button>
          </div>
        </div>
      </section>

      {/* METRICS */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["AI Credits", "1,000", "Available balance"],
          ["Videos Generated", "1", "NEO V2 outputs"],
          ["Active Projects", "0", "Projects running"],
          ["Storage Used", "0 GB", "Out of 10 GB"],
        ].map(([title, value, desc]) => (
          <div
            key={title}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl transition hover:border-blue-500/30 hover:bg-white/[0.06]"
          >
            <p className="text-sm text-gray-400">{title}</p>
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
            <p className="mt-2 text-xs text-gray-500">{desc}</p>
          </div>
        ))}
      </section>

      {/* TOOLS */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Start Creating
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Everything you need in one workspace.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {tools.map((tool) => (
            <button
              key={tool.title}
              onClick={tool.action}
              className="group min-h-44 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 text-left transition hover:-translate-y-1 hover:border-blue-500/40 hover:bg-white/[0.08]"
            >
              <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 to-violet-500/30 text-xl">
                ✦
              </div>

              <h3 className="text-base font-semibold text-white">
                {tool.title}
              </h3>

              <p className="mt-2 text-sm leading-5 text-gray-500">
                {tool.description}
              </p>

              <div className="mt-5 text-sm text-blue-400 transition group-hover:translate-x-1">
                Open →
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* LOWER GRID */}
      <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Recent Activity
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Latest actions across your workspace.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              ["NEO V2 avatar generated", "Creator Avatar"],
              ["AI workspace connected", "NeoCloud"],
              ["Dashboard upgraded", "System"],
            ].map(([title, subtitle]) => (
              <div
                key={title}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
                </div>

                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
                  Success
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-blue-500/10 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
            NEO V2
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            Avatar Engine
          </h2>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            Generate AI presenter videos from a portrait and audio using
            NeoCloud&apos;s own generation pipeline.
          </p>

          <div className="mt-6 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="text-sm text-gray-300">
              Connected to NeoCloud
            </span>
          </div>

          <button
            onClick={() => router.push("/creator-avatar")}
            className="mt-6 w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-gray-200"
          >
            Launch NEO V2
          </button>
        </div>
      </section>
    </div>
  );
}