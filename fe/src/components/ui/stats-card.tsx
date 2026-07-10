interface StatsCardProps {
  icon: string;
  value: string | number;
  label: string;
}

export function StatsCard({ icon, value, label }: StatsCardProps) {
  return (
    <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl sm:text-3xl font-extrabold leading-none">{value}</div>
      <div className="text-xs text-[#94a3b8] mt-1.5 font-medium">{label}</div>
    </div>
  );
}
