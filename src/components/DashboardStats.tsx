export default function DashboardStats() {
  const stats = [
    {
      title: "AI Chats",
      value: "24",
      icon: "🤖",
      color: "from-blue-500 to-cyan-500",
    },
    {
      title: "Documents",
      value: "12",
      icon: "📄",
      color: "from-purple-500 to-pink-500",
    },
    {
      title: "Images",
      value: "8",
      icon: "🖼️",
      color: "from-green-500 to-emerald-500",
    },
    {
      title: "Credits",
      value: "0",
      icon: "⚡",
      color: "from-orange-500 to-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">
                {item.title}
              </p>

              <h2 className="mt-2 text-3xl font-bold text-white">
                {item.value}
              </h2>
            </div>

            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r ${item.color} text-2xl`}
            >
              {item.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}