import { type ReactNode } from 'react';

type MobileHeaderProps = {
  title?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  tone?: 'brand' | 'rider' | 'surface';
};

const toneClasses: Record<NonNullable<MobileHeaderProps['tone']>, { title: string; subtitle: string }> = {
  brand: {
    title: 'text-white',
    subtitle: 'text-white/80',
  },
  rider: {
    title: 'text-white',
    subtitle: 'text-blue-100',
  },
  surface: {
    title: 'text-gray-900',
    subtitle: 'text-gray-500',
  },
};

export default function MobileHeader({ title, subtitle, left, right, className = '', tone = 'brand' }: MobileHeaderProps) {
  const textTone = toneClasses[tone];

  return (
    <div className={`safe-x py-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">{left}</div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
      {(title || subtitle) && (
        <div className="mt-3">
          {title && <h1 className={`text-xl font-black tracking-tight ${textTone.title}`}>{title}</h1>}
          {subtitle && <p className={`mt-0.5 text-sm ${textTone.subtitle}`}>{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
