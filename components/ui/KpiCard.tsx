import { type ReactNode } from 'react';

type KpiCardProps = {
  icon?: ReactNode;
  label: string;
  value: string;
  className?: string;
  tone?: 'client' | 'rider';
};

const toneClasses: Record<NonNullable<KpiCardProps['tone']>, string> = {
  client: 'bg-surface-card border-gray-100 text-gray-900',
  rider: 'bg-gradient-to-b from-rider-700/95 to-rider-900/95 border-blue-300/30 text-white shadow-softlg',
};

export default function KpiCard({ icon, label, value, className = '', tone = 'client' }: KpiCardProps) {
  return (
    <div className={`rounded-3xl shadow-soft border p-4 text-center ${toneClasses[tone]} ${className}`}>
      {icon ? <div className="mb-1.5 flex justify-center opacity-90">{icon}</div> : null}
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}
