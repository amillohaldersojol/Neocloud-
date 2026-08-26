type TopbarProps = {
  email?: string;
  onLogout?: () => void;
};

export default function Topbar({
  email,
  onLogout,
}: TopbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-white/5 px-8 py-4">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Dashboard
        </h2>

        <p className="text-sm text-gray-400">
          Welcome back to NeoCloud
        </p>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search..."
          className="w-64 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none"
        />

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
          {email}
        </div>

        <button
          onClick={() => onLogout?.()}
          className="rounded-xl bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </header>
  );
}