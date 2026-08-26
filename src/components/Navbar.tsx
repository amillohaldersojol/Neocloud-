export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10 backdrop-blur-md">
      <h1 className="text-3xl font-bold text-white">
        NeoCloud
      </h1>

      <div className="hidden md:flex gap-8 text-gray-300">
        <a href="#" className="hover:text-white">Home</a>
        <a href="#" className="hover:text-white">Platform</a>
        <a href="#" className="hover:text-white">Pricing</a>
        <a href="#" className="hover:text-white">Docs</a>
      </div>

      <button className="rounded-xl bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 transition">
        Get Started
      </button>
    </nav>
  );
}