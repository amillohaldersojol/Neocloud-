import Link from "next/link";
export default function Hero() {
  return (
    <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-6 text-center">

      <div className="absolute h-96 w-96 rounded-full bg-blue-600/20 blur-3xl"></div>

      <p className="relative rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
        🚀 Next Generation AI Cloud
      </p>

      <h1 className="relative mt-8 max-w-5xl text-5xl font-extrabold leading-tight text-white md:text-7xl">
        Build, Deploy & Scale
        <span className="block bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          AI Applications
        </span>
      </h1>

      <p className="relative mt-8 max-w-2xl text-lg text-gray-400">
        NeoCloud is an AI-first cloud platform that helps developers,
        startups and enterprises build intelligent applications faster than ever.
      </p>

      <div className="relative mt-10 flex gap-4">
        <Link
  href="/signup"
  className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white transition hover:scale-105"
>
  Get Started
</Link>

        <button className="rounded-xl border border-white/20 px-7 py-3 text-white transition hover:bg-white/10">
          Live Demo
        </button>
      </div>
    </section>
  );
}