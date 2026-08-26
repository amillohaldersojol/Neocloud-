import DashboardCard from "@/components/DashboardCard";

export default function DashboardHome() {
  return (
    <div className="p-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white">
          Welcome to NeoCloud
        </h3>

        <p className="mt-2 text-gray-400">
          Your premium workspace is ready.
        </p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="AI Credits"
          value="1,000"
          description="Available credits"
        />

        <DashboardCard
          title="Active Projects"
          value="0"
          description="Projects currently running"
        />

        <DashboardCard
          title="Storage Used"
          value="0 GB"
          description="Out of 10 GB"
        />

        <DashboardCard
          title="AI Tasks"
          value="0"
          description="Tasks completed today"
        />
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">
          Quick Actions
        </h2>

        <div className="mt-4 flex flex-wrap gap-4">
          <button className="rounded-xl bg-blue-600 px-5 py-3 text-white hover:bg-blue-700">
            Start AI Chat
          </button>

          <button className="rounded-xl bg-green-600 px-5 py-3 text-white hover:bg-green-700">
            Create Project
          </button>

          <button className="rounded-xl bg-purple-600 px-5 py-3 text-white hover:bg-purple-700">
            Upload File
          </button>
        </div>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
  <h2 className="text-lg font-semibold text-white">
    Recent Activity
  </h2>

  <div className="mt-4 space-y-3">
    <div className="rounded-lg bg-white/5 p-3 text-gray-300">
      ✅ Welcome to NeoCloud
    </div>

    <div className="rounded-lg bg-white/5 p-3 text-gray-300">
      📁 No projects created yet
    </div>

    <div className="rounded-lg bg-white/5 p-3 text-gray-300">
      🤖 AI Workspace is ready
    </div>
  </div>
</div>
      </div>
    </div>
  );
}