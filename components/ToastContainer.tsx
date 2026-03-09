'use client';

import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastState {
  id: number;
  type: ToastType;
  message: string;
}

export function ToastContainer({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const colorClasses =
    toast.type === 'success'
      ? 'bg-green-600'
      : toast.type === 'error'
      ? 'bg-red-600'
      : 'bg-gray-900';
  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertTriangle : Info;

  return (
    <div className="fixed bottom-4 inset-x-0 z-[70] flex justify-center px-4 pointer-events-none">
      <div className={`pointer-events-auto max-w-sm w-full rounded-2xl text-white px-4 py-3 shadow-lg flex items-start gap-2 ${colorClasses}`}>
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
    </div>
  );
}

