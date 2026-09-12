interface StatsCardProps {
  icon: string;
  value: string | number;
  label: string;
}

export function StatsCard({ icon, value, label }: StatsCardProps) {
  return (
    <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl sm:text-3xl font-extrabold leading-none">{value}</div>
      <div className="text-xs text-[#78716c] mt-1.5 font-medium">{label}</div>
    </div>
  );
}
