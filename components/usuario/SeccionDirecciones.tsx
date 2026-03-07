'use client';

import { useState } from 'react';
import { MapPin, Plus, Trash2, Home, Briefcase, Star } from 'lucide-react';
import { formatDireccionCorta } from '@/lib/formatDireccion';

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
}

export default function SeccionDirecciones({ direcciones, onActualizar }: Props) {
  const [agregando, setAgregando] = useState(false);
  const [nueva, setNueva] = useState({ nombre: '', detalle: '', referencia: '', etiqueta: 'otro' as DireccionGuardada['etiqueta'] });

  function agregar() {
    if (!nueva.nombre.trim()) return;
    const dir: DireccionGuardada = {
      id: `dir-${Date.now()}`,
      etiqueta: nueva.etiqueta,
      nombre: nueva.nombre.trim(),
      detalle: nueva.detalle.trim(),
      referencia: nueva.referencia.trim() || undefined,
      principal: direcciones.length === 0,
    };
    onActualizar([...direcciones, dir]);
    setNueva({ nombre: '', detalle: '', referencia: '', etiqueta: 'otro' });
    setAgregando(false);
  }

  function eliminar(id: string) {
    onActualizar(direcciones.filter((d) => d.id !== id));
  }

  function setPrincipal(id: string) {
    onActualizar(
      direcciones.map((d) => ({ ...d, principal: d.id === id }))
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">Mis direcciones</p>
        <button
          type="button"
          onClick={() => setAgregando(true)}
          className="flex items-center gap-1 text-xs font-bold text-rojo-andino hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {direcciones.length === 0 && !agregando && (
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

        {/* Formulario nueva dirección */}
        {agregando && (
          <div className="px-4 py-4 space-y-3 bg-gray-50/50">
            <div className="flex gap-2">
              {(['casa', 'trabajo', 'otro'] as const).map((e) => {
                const Icono = ICONOS_ETIQUETA[e];
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNueva((n) => ({ ...n, etiqueta: e }))}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-xs font-semibold capitalize transition-colors ${
                      nueva.etiqueta === e
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
            <input
              type="text"
              placeholder="Nombre (Ej. Mi casa)"
              value={nueva.nombre}
              onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rojo-andino transition-colors"
              autoFocus
            />
            <input
              type="text"
              placeholder="Dirección (calle, sector, Piñas)"
              value={nueva.detalle}
              onChange={(e) => setNueva((n) => ({ ...n, detalle: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rojo-andino transition-colors"
            />
            <input
              type="text"
              placeholder="Referencia para el rider (ej. casa azul, al lado del parque)"
              value={nueva.referencia}
              onChange={(e) => setNueva((n) => ({ ...n, referencia: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rojo-andino transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAgregando(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={agregar}
                disabled={!nueva.nombre.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rojo-andino hover:bg-rojo-andino/90 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
