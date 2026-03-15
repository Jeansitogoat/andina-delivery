'use client';

import { AlertTriangle } from 'lucide-react';

type ModalCerrarSesionProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Texto opcional bajo el título */
  descripcion?: string;
};

export default function ModalCerrarSesion({
  open,
  onClose,
  onConfirm,
  descripcion = 'Tendrás que volver a iniciar sesión para acceder a tu cuenta.',
}: ModalCerrarSesionProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5">
      <div
        className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center overflow-hidden"
        style={{ animation: 'modalCerrarSesionScaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
      >
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="font-black text-lg text-gray-900 mb-1">¿Cerrar sesión?</h3>
        <p className="text-sm text-gray-500 mb-6">{descripcion}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
          >
            Sí, cerrar sesión
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalCerrarSesionScaleIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
