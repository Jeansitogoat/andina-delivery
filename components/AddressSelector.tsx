'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, ChevronDown, Plus, AlertCircle } from 'lucide-react';
import { useAddresses } from '@/lib/addressesContext';
import { useAuth } from '@/lib/useAuth';
import { formatDireccionCorta } from '@/lib/formatDireccion';
import type { DireccionGuardada } from '@/components/usuario/SeccionDirecciones';

const AgregarDireccionModal = dynamic(() => import('@/components/usuario/AgregarDireccionModal'), { ssr: false });

interface AddressSelectorProps {
  className?: string;
  /** true = fondo claro (checkout), false = header rojo (home) */
  dark?: boolean;
  compact?: 'default' | 'icon_only';
}

export default function AddressSelector({ className = '', dark = false, compact = 'default' }: AddressSelectorProps) {
  const {
    direcciones,
    selectedId,
    setSelectedId,
    direccionEntregar,
    estaLejos,
    addDireccion,
    userLocationLatLng,
  } = useAddresses();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleGuardar(d: Omit<DireccionGuardada, 'id'>) {
    addDireccion(d);
    setShowModal(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 text-sm font-medium transition-colors ${dark ? 'text-gray-700 hover:text-gray-900' : 'text-white/95 hover:text-white'}`}
      >
        <MapPin className="w-4 h-4 text-dorado-oro flex-shrink-0" />
        {compact === 'icon_only' ? (
          <span className="max-w-[210px] truncate">
            Entregar en: {formatDireccionCorta(direccionEntregar) || 'Agrega una dirección'}
          </span>
        ) : (
          <span>Entregar en: {formatDireccionCorta(direccionEntregar) || 'Agrega una dirección'}</span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 py-2 bg-white rounded-2xl shadow-xl min-w-[260px] max-w-[90vw] z-50 animate-fade-in border border-gray-100">
          {estaLejos && (
            <div className="px-4 py-3 mx-2 mb-2 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800">Estás un poco lejos</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Agrega tu nueva ubicación para ver si te podemos entregar en Piñas.
                </p>
              </div>
            </div>
          )}
          {direcciones.map((dir) => (
            <button
              key={dir.id}
              type="button"
              onClick={() => {
                setSelectedId(dir.id);
                setOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                selectedId === dir.id ? 'bg-rojo-andino/5 text-rojo-andino font-semibold' : 'text-gray-700'
              }`}
            >
              <MapPin className="w-4 h-4 text-dorado-oro flex-shrink-0" />
              <span className="truncate">{dir.nombre} · {formatDireccionCorta(dir.detalle)}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setShowModal(true);
            }}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 text-rojo-andino font-semibold border-t border-gray-100 mt-1 pt-2"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            Agregar ubicación
          </button>
        </div>
      )}

      {showModal && (
        <AgregarDireccionModal
          onClose={() => setShowModal(false)}
          onGuardar={handleGuardar}
          initialLatLng={userLocationLatLng}
          telefonoUsuario={user?.telefono ?? null}
        />
      )}
    </div>
  );
}
