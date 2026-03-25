'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Plus, Trash2, Home, Briefcase, Star } from 'lucide-react';
import { formatDireccionCorta } from '@/lib/formatDireccion';

const AgregarDireccionModal = dynamic(() => import('./AgregarDireccionModal'), { ssr: false });

export interface DireccionGuardada {
  id: string;
  etiqueta: 'casa' | 'trabajo' | 'otro';
  nombre: string;
  detalle: string;
  /** Referencia para el rider: ej. "casa azul, al lado del parque" */
  referencia?: string;
  principal: boolean;
  lat?: number;
  lng?: number;
}

const ICONOS_ETIQUETA = {
  casa: Home,
  trabajo: Briefcase,
  otro: MapPin,
};

interface Props {
  direcciones: DireccionGuardada[];
  onActualizar: (_dirs: DireccionGuardada[]) => void;
  telefonoUsuario?: string | null;
}

export default function SeccionDirecciones({ direcciones, onActualizar, telefonoUsuario }: Props) {
  const [showModal, setShowModal] = useState(false);

  function eliminar(id: string) {
    onActualizar(direcciones.filter((d) => d.id !== id));
  }

  function setPrincipal(id: string) {
    onActualizar(
      direcciones.map((d) => ({ ...d, principal: d.id === id }))
    );
  }

  function handleGuardar(d: Omit<DireccionGuardada, 'id'>) {
    const nueva: DireccionGuardada = { ...d, id: crypto.randomUUID() };
    onActualizar([...direcciones, nueva]);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">Mis direcciones</p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-xs font-bold text-rojo-andino hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {direcciones.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-400">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No tienes direcciones guardadas</p>
          </div>
        )}

        {direcciones.map((dir) => {
          const Icono = ICONOS_ETIQUETA[dir.etiqueta];
          return (
            <div key={dir.id} className="flex items-start gap-3 px-4 py-3.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                dir.principal ? 'bg-rojo-andino/10' : 'bg-gray-100'
              }`}>
                <Icono className={`w-4 h-4 ${dir.principal ? 'text-rojo-andino' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-semibold text-sm text-gray-900">{dir.nombre}</p>
                  {dir.principal && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-dorado-oro/15 text-dorado-oro px-1.5 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5" />
                      Principal
                    </span>
                  )}
                </div>
                {dir.detalle && <p className="text-xs text-gray-400">{formatDireccionCorta(dir.detalle)}</p>}
                {dir.referencia && <p className="text-xs text-gray-500 mt-0.5 italic">Ref: {dir.referencia}</p>}
                {!dir.principal && (
                  <button
                    type="button"
                    onClick={() => setPrincipal(dir.id)}
                    className="text-[11px] text-rojo-andino font-semibold hover:underline mt-0.5"
                  >
                    Establecer como principal
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => eliminar(dir.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <AgregarDireccionModal
          onClose={() => setShowModal(false)}
          onGuardar={handleGuardar}
          telefonoUsuario={telefonoUsuario}
        />
      )}
    </div>
  );
}
