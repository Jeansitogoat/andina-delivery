'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useFullScreenModal } from '@/lib/FullScreenModalContext';
import { MapPin, Home, Briefcase, X, ExternalLink, Phone } from 'lucide-react';
import type { DireccionGuardada } from './SeccionDirecciones';

const MapPicker = dynamic(() => import('./MapPicker'), { ssr: false });

const ICONOS = { casa: Home, trabajo: Briefcase, otro: MapPin };

type Props = {
  onClose: () => void;
  onGuardar: (_d: Omit<DireccionGuardada, 'id'>) => void;
  /** Teléfono del usuario (para mostrar y no pedirlo de nuevo) */
  telefonoUsuario?: string | null;
  /** Ubicación actual del usuario para centrar el mapa al abrir */
  initialLatLng?: { lat: number; lng: number } | null;
};

export default function AgregarDireccionModal({ onClose, onGuardar, telefonoUsuario, initialLatLng }: Props) {
  const { register, unregister } = useFullScreenModal();
  useEffect(() => {
    register();
    return () => unregister();
  }, [register, unregister]);

  const [etiqueta, setEtiqueta] = useState<DireccionGuardada['etiqueta']>('casa');
  const [nombre, setNombre] = useState('');
  const [detalle, setDetalle] = useState('');
  const [referencia, setReferencia] = useState('');
  const [lat, setLat] = useState<number | null>(initialLatLng?.lat ?? null);
  const [lng, setLng] = useState<number | null>(initialLatLng?.lng ?? null);
  const [buscando, setBuscando] = useState(false);

  function abrirEnMapa() {
    const q = lat != null && lng != null
      ? `${lat},${lng}`
      : encodeURIComponent(detalle.trim() || 'Piñas, El Oro, Ecuador');
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  async function buscarEnMapa() {
    const q = detalle.trim() || 'Piñas, El Oro, Ecuador';
    if (!q) return;
    setBuscando(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'es' } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const { lat: newLat, lon: newLon, display_name } = data[0];
        setLat(parseFloat(newLat));
        setLng(parseFloat(newLon));
        if (display_name && !detalle.trim()) setDetalle(display_name);
      }
    } catch {
      // silencioso
    } finally {
      setBuscando(false);
    }
  }

  function guardar() {
    if (!nombre.trim()) return;
    onGuardar({
      etiqueta,
      nombre: nombre.trim(),
      detalle: detalle.trim(),
      referencia: referencia.trim() || undefined,
      principal: false,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white w-full max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in"
      >
        <div className="sticky top-0 bg-white px-4 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900">Nueva ubicación</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-500">
            Esta dirección y la referencia se mostrarán al rider para la entrega.
          </p>

          {telefonoUsuario ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700">
              <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span>Tu teléfono para entregas: <strong>{telefonoUsuario}</strong></span>
            </div>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              Agregá tu teléfono en Mi perfil para que el rider te contacte.
            </p>
          )}

          <div className="flex gap-2">
            {(['casa', 'trabajo', 'otro'] as const).map((e) => {
              const Icono = ICONOS[e];
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEtiqueta(e)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    etiqueta === e
                      ? 'border-rojo-andino bg-rojo-andino/5 text-rojo-andino'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Icono className="w-4 h-4" />
                  {e === 'casa' ? 'Casa' : e === 'trabajo' ? 'Trabajo' : 'Otro'}
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Nombre del lugar
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Mi casa, Trabajo"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-rojo-andino transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Dirección (calle, número, sector, Piñas)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Ej. Calle Sucre 123, Sector La Cadena"
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-rojo-andino transition-colors"
              />
              <button
                type="button"
                onClick={buscarEnMapa}
                disabled={buscando}
                className="flex-shrink-0 px-3 py-3 rounded-xl bg-rojo-andino/10 hover:bg-rojo-andino/20 text-rojo-andino transition-colors disabled:opacity-50"
                title="Buscar en mapa"
              >
                <MapPin className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={abrirEnMapa}
                className="flex-shrink-0 px-3 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                title="Abrir en Google Maps"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Usa el ícono de ubicación para buscar y marcar en el mapa. El de enlace abre Google Maps.
            </p>

            <MapPicker
              lat={lat}
              lng={lng}
              onSelect={(newLat, newLng, addr) => {
                setLat(newLat);
                setLng(newLng);
                if (addr) setDetalle(addr);
              }}
              className="mt-2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Referencia para el rider
            </label>
            <textarea
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej. Casa azul, al lado del parque, segundo piso, portón blanco"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-rojo-andino transition-colors resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Detalles que ayuden al rider a encontrar tu domicilio.
            </p>
          </div>

          <div className="flex gap-2 pt-2 pb-8 sm:pb-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={!nombre.trim()}
              className="flex-1 py-3.5 rounded-xl bg-rojo-andino hover:bg-rojo-andino/90 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
            >
              Guardar ubicación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
