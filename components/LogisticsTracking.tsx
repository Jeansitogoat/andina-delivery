'use client';

import { useState, useEffect } from 'react';
import { Truck, Phone, X, CheckCircle2, Clock, ChevronUp, ChevronDown, MapPin } from 'lucide-react';

interface LogisticsTrackingProps {
  isActive: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: 0, label: 'Pedido confirmado', sublabel: 'El local recibió tu pedido', done: true },
  { id: 1, label: 'Preparando tu pedido', sublabel: 'El local está preparando todo', done: true },
  { id: 2, label: 'Socio en camino', sublabel: 'Cía. Virgen de la Merced · Est. 15-25 min', done: false, active: true },
  { id: 3, label: 'Entregado', sublabel: 'Tu pedido llegará pronto', done: false },
];

export default function LogisticsTracking({ isActive, onClose }: LogisticsTrackingProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState(2);

  useEffect(() => {
    if (!isActive) {
      setExpanded(false);
      setActiveStep(2);
      return;
    }
    const t = setTimeout(() => setActiveStep(3), 18000);
    return () => clearTimeout(t);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <>
      {/* Overlay oscuro cuando está expandido */}
      {expanded && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
          style={{ animation: 'fadeInOverlay 0.25s ease-out' }}
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40" style={{ animation: 'slideUp 0.35s ease-out' }}>

        {/* Panel expandido */}
        {expanded && (
          <div
            className="bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-4 max-w-2xl mx-auto"
            style={{ animation: 'expandPanel 0.3s ease-out' }}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* Header del panel */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-bold text-gray-900 text-base">Seguimiento de pedido</p>
                <p className="text-xs text-gray-500 mt-0.5">#{Math.floor(1000 + Math.random() * 9000)} · Andina</p>
              </div>
              <div className="flex items-center gap-2 bg-dorado-oro/10 border border-dorado-oro/30 rounded-2xl px-3 py-1.5">
                <Clock className="w-3.5 h-3.5 text-dorado-oro" />
                <span className="text-xs font-bold text-gray-800">15-25 min</span>
              </div>
            </div>

            {/* Pasos de seguimiento */}
            <div className="space-y-0 mb-5">
              {STEPS.map((step, i) => {
                const isDone = step.id < activeStep;
                const isActive = step.id === activeStep;
                const isPending = step.id > activeStep;
                return (
                  <div key={step.id} className="flex items-start gap-3">
                    {/* Icono + línea vertical */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                        isDone ? 'bg-green-500' :
                        isActive ? 'bg-rojo-andino ring-4 ring-rojo-andino/20' :
                        'bg-gray-100'
                      }`}>
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        ) : isActive ? (
                          <Truck className={`w-4 h-4 text-white ${isActive ? 'animate-bounce' : ''}`} />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-gray-300" />
                        )}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`w-0.5 h-8 mt-0.5 transition-all duration-500 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />
                      )}
                    </div>

                    {/* Texto del paso */}
                    <div className="pt-1 pb-7">
                      <p className={`text-sm font-semibold leading-tight transition-colors duration-300 ${
                        isPending ? 'text-gray-400' : 'text-gray-900'
                      }`}>
                        {step.label}
                      </p>
                      <p className={`text-xs mt-0.5 transition-colors duration-300 ${
                        isActive ? 'text-rojo-andino font-medium' : isPending ? 'text-gray-300' : 'text-gray-400'
                      }`}>
                        {step.sublabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Socio info */}
            <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-rojo-andino" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">Cía. Virgen de la Merced</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-500 truncate">En camino · Piñas, El Oro</p>
                </div>
              </div>
              <a
                href="https://wa.me/593992250333"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Barra compacta siempre visible */}
        <div
          className={`bg-rojo-andino border-t-2 border-dorado-oro/50 shadow-[0_-4px_20px_rgba(0,0,0,0.18)] px-4 py-3.5 cursor-pointer ${expanded ? '' : 'rounded-t-2xl'}`}
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            {/* Icono camión */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
              <Truck className="w-5 h-5 text-dorado-oro" />
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">
                {activeStep === 3 ? '¡Pedido entregado!' : 'Pedido en camino'}
              </p>
              <p className="text-white/75 text-xs truncate">
                {expanded ? 'Toca para cerrar detalle' : 'Toca para ver detalle del envío'}
              </p>
            </div>

            {/* Indicador expand */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              {expanded
                ? <ChevronDown className="w-4 h-4 text-white/80" />
                : <ChevronUp className="w-4 h-4 text-white/80" />
              }
            </div>

            {/* Botón cerrar — para propagación independiente */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); setExpanded(false); }}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
              aria-label="Cerrar tracking"
            >
              <X className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes expandPanel {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}
