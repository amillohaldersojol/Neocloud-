export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-white/10 bg-white/5 p-5">
      <h1 className="mb-8 text-2xl font-bold text-white">NeoCloud</h1>

      <nav className="space-y-3">
        <button className="w-full rounded-xl bg-blue-600 px-4 py-3 text-left font-semibold text-white">
          Dashboard
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-gray-300 hover:bg-white/10">
          AI Chat
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-gray-300 hover:bg-white/10">
          Projects
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-gray-300 hover:bg-white/10">
          Files
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-gray-300 hover:bg-white/10">
          Settings
        </button>
      </nav>
    </aside>
  );
}