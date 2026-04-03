'use client';

import { CheckCircle2 } from 'lucide-react';

export type SeguimientoStepperProps = {
  labels: [string, string, string, string];
  pasoActual: number;
  className?: string;
};

/**
 * Stepper horizontal de 4 pasos (comida o mandado).
 * Ilumina pasos &lt;= pasoActual (0..3).
 */
export default function SeguimientoStepper({ labels, pasoActual, className = '' }: SeguimientoStepperProps) {
  const idx = Math.max(0, Math.min(3, pasoActual));
  return (
    <div className={'w-full ' + className}>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[0, 1, 2, 3].map((i) => {
          const ok = i <= idx;
          return (
            <div key={i} className="flex flex-col items-center min-w-0">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-black transition-colors shrink-0 ${
                  ok ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {ok ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <p
                className={`mt-2 text-[10px] sm:text-xs font-semibold text-center leading-tight px-0.5 ${
                  ok ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {labels[i]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
