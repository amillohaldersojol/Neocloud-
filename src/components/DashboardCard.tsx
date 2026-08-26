type DashboardCardProps = {
  title: string;
  value: string;
  description: string;
};

export default function DashboardCard({
  title,
  value,
  description,
}: DashboardCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20 hover:bg-white/10">
      <p className="text-sm text-gray-400">{title}</p>

      <h3 className="mt-3 text-3xl font-semibold text-white">
        {value}
      </h3>

      <p className="mt-2 text-sm text-gray-500">
        {description}
      </p>
    </div>
  );
}