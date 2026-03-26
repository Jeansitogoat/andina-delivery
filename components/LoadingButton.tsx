'use client';

import type React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean;
  tone?: 'client' | 'rider' | 'neutral';
}

const toneClassMap: Record<NonNullable<LoadingButtonProps['tone']>, string> = {
  client: 'btn-primary-ui',
  rider: 'btn-primary-rider',
  neutral: '',
};

export function LoadingButton({
  loading,
  children,
  className = '',
  disabled,
  tone = 'neutral',
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      {...rest}
      disabled={loading || disabled}
      className={`${toneClassMap[tone]} ${className} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </span>
    </button>
  );
}

