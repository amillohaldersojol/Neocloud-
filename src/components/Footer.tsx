export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        <div>
          <h3 className="text-2xl font-bold text-white">
            NeoCloud
          </h3>

          <p className="mt-2 text-sm text-gray-400">
            The Future of AI Cloud Computing.
          </p>
        </div>

        <div className="flex gap-6 text-gray-400">
          <a href="#" className="hover:text-white">Home</a>
          <a href="#" className="hover:text-white">Docs</a>
          <a href="#" className="hover:text-white">Pricing</a>
          <a href="#" className="hover:text-white">Contact</a>
        </div>
      </div>
    </footer>
  );
}