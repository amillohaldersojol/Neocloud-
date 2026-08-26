export default function DashboardPreview() {
  return (
    <section className="px-8 py-24">
      <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">

        <h2 className="mb-8 text-center text-4xl font-bold text-white">
          AI Dashboard Preview
        </h2>

        <div className="grid gap-6 md:grid-cols-3">

          <div className="rounded-2xl bg-black/40 p-6">
            <p className="text-gray-400">AI Requests</p>
            <h3 className="mt-2 text-4xl font-bold text-white">
              24.8K
            </h3>
          </div>

          <div className="rounded-2xl bg-black/40 p-6">
            <p className="text-gray-400">Running Agents</p>
            <h3 className="mt-2 text-4xl font-bold text-white">
              128
            </h3>
          </div>

          <div className="rounded-2xl bg-black/40 p-6">
            <p className="text-gray-400">Cloud Usage</p>
            <h3 className="mt-2 text-4xl font-bold text-white">
              98%
            </h3>
          </div>

        </div>

      </div>
    </section>
  );
}