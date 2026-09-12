"use client";

import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const items = [
    { name: "Dashboard", path: "/dashboard", icon: "⌂" },
    { name: "AI Chat", path: "/ai-chat", icon: "✦" },
    { name: "Projects", path: "/projects", icon: "▣" },
    { name: "Creator Avatar", path: "/creator-avatar", icon: "◉" },
    { name: "Creator Autopilot", path: "/creator-autopilot", icon: "⚡" },
    { name: "Video Translator", path: "/video-translator", icon: "▶" },
    { name: "Files", path: "/files", icon: "□" },
    { name: "Settings", path: "/settings", icon: "⚙" },
  ];

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r border-white/10 bg-white/[0.03] p-5">
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-8 text-left"
      >
        <h1 className="text-2xl font-bold tracking-tight text-white">
          NeoCloud
        </h1>
        <p className="mt-1 text-xs text-gray-500">AI Operating System</p>
      </button>

      <nav className="flex-1 space-y-2">
        {items.map((item) => {
          const active = pathname === item.path;

          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold text-white">NEO V2</p>
          <p className="mt-1 text-xs text-gray-500">
            Avatar Engine
          </p>

          <div className="mt-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span className="text-xs text-gray-400">
              Connecting...
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}