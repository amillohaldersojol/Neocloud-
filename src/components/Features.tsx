export default function Features() {
  return (
    <section className="px-8 py-20">
      <h2 className="mb-12 text-center text-4xl font-bold text-white">
        Why Choose NeoCloud?
      </h2>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-3 text-xl font-semibold text-white">
            AI Agents
          </h3>
          <p className="text-gray-400">
            Build and deploy intelligent AI agents in minutes.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-3 text-xl font-semibold text-white">
            Secure Cloud
          </h3>
          <p className="text-gray-400">
            Enterprise-grade cloud infrastructure with high security.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-3 text-xl font-semibold text-white">
            Fast API
          </h3>
          <p className="text-gray-400">
            Powerful APIs for developers and businesses.
          </p>
        </div>
      </div>
    </section>
  );
}