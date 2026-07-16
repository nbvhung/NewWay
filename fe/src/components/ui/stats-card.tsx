interface StatsCardProps {
  icon: string;
  value: string | number;
  label: string;
}

export function StatsCard({ icon, value, label }: StatsCardProps) {
  return (
    <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl sm:text-3xl font-extrabold leading-none">{value}</div>
      <div className="text-xs text-[#64748b] mt-1.5 font-medium">{label}</div>
    </div>
  );
}
