"use client";

import Link from "next/link";

export default function ProjectWorkspace() {
  return (
    <main className="min-h-screen bg-[#0F172A] text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">NeoCloud AI Chat</h1>
          <p className="mt-2 text-gray-400">
            Project Workspace
          </p>
        </div>

        <Link
          href="/projects"
          className="rounded-xl bg-blue-600 px-5 py-3 hover:bg-blue-700"
        >
          ← Back
        </Link>
      </div>

      {/* Cards */}
      <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">

        <Link
          href="/ai-chat"
          className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-blue-500"
        >
          <div className="text-3xl">💬</div>
          <h2 className="mt-4 text-xl font-semibold">
            AI Chat
          </h2>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-3xl">📄</div>
          <h2 className="mt-4 text-xl font-semibold">
            Documents
          </h2>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-3xl">🖼️</div>
          <h2 className="mt-4 text-xl font-semibold">
            Images
          </h2>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-3xl">🎥</div>
          <h2 className="mt-4 text-xl font-semibold">
            Video
          </h2>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-3xl">📊</div>
          <h2 className="mt-4 text-xl font-semibold">
            Analytics
          </h2>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-3xl">⚙️</div>
          <h2 className="mt-4 text-xl font-semibold">
            Settings
          </h2>
        </div>

      </div>
    </main>
  );
}