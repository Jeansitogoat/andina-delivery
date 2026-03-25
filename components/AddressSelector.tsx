'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Plus, AlertCircle } from 'lucide-react';
import { useAddresses } from '@/lib/addressesContext';
import { useAuth } from '@/lib/useAuth';
import { formatDireccionCorta } from '@/lib/formatDireccion';
import AddressPicker from '@/components/AddressPicker';

interface AddressSelectorProps {
  className?: string;
  /** true = fondo claro (checkout), false = header rojo (home) */
  dark?: boolean;
  /** Coordenadas de locales para validar cobertura en checkout/multi-stop. */
  localCoords?: Array<{ lat: number; lng: number }>;
  /** Radio de cobertura en km (por defecto 10km). */
  coverageRadiusKm?: number;
  /** Distancia mínima a GPS en km para disparar popup anti-bromas (por defecto 1km). */
  proximityKm?: number;
}

export default function AddressSelector({
  className = '',
  dark = false,
  localCoords,
  coverageRadiusKm = 10,
  proximityKm = 1,
}: AddressSelectorProps) {
  const { direcciones, selectedId, setSelectedId, direccionEntregar, estaLejos } = useAddresses();
  useAuth();
  const [open, setOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 text-sm font-medium transition-colors ${dark ? 'text-gray-700 hover:text-gray-900' : 'text-white/95 hover:text-white'}`}
      >
        <MapPin className="w-4 h-4 text-dorado-oro flex-shrink-0" />
        <span>Entregar en: {formatDireccionCorta(direccionEntregar) || 'Agrega una dirección'}</span>
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
              setShowPicker(true);
            }}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 text-rojo-andino font-semibold border-t border-gray-100 mt-1 pt-2"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            Agregar ubicación
          </button>
        </div>
      )}

      {showPicker && (
        <AddressPicker
          onClose={() => setShowPicker(false)}
          locals={localCoords}
          coverageRadiusKm={coverageRadiusKm}
          proximityKm={proximityKm}
        />
      )}
    </div>
  );
}
