'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Store,
  MapPin,
  Phone,
  Clock,
  Camera,
  Check,
} from 'lucide-react';
import NavPanel from '@/components/panel/NavPanel';
import LocalLogo from '@/components/LocalLogo';
import { compressImage } from '@/lib/compressImage';
import { getSafeImageSrc } from '@/lib/validImageUrl';

const HORARIOS_DEFAULT = [
  { dia: 'Lunes', abierto: true, desde: '09:00', hasta: '22:00' },
  { dia: 'Martes', abierto: true, desde: '09:00', hasta: '22:00' },
  { dia: 'Miércoles', abierto: true, desde: '09:00', hasta: '22:00' },
  { dia: 'Jueves', abierto: true, desde: '09:00', hasta: '22:00' },
  { dia: 'Viernes', abierto: true, desde: '09:00', hasta: '23:00' },
  { dia: 'Sábado', abierto: true, desde: '10:00', hasta: '23:00' },
  { dia: 'Domingo', abierto: false, desde: '10:00', hasta: '22:00' },
];

export default function PanelPerfilRestaurantePage() {
  const router = useRouter();
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const [pageVisible, setPageVisible] = useState(false);
  const [nombre, setNombre] = useState('Tu negocio');
  const [direccion, setDireccion] = useState('Calle Bolívar, Piñas');
  const [telefono, setTelefono] = useState('+593 099 225 0333');
  const [logo, setLogo] = useState('/logos/rhk.png');
  const [cover, setCover] = useState('/food/food-pollo-brasa-mitad.png');
  const [horarios, setHorarios] = useState(HORARIOS_DEFAULT);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 'logo').then((compressed) => {
      const reader = new FileReader();
      reader.onload = () => setLogo(reader.result as string);
      reader.readAsDataURL(compressed);
    });
  }

  function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 'cover').then((compressed) => {
      const reader = new FileReader();
      reader.onload = () => setCover(reader.result as string);
      reader.readAsDataURL(compressed);
    });
  }

  function guardar() {
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }

  function toggleHorario(index: number) {
    setHorarios((prev) =>
      prev.map((h, i) => (i === index ? { ...h, abierto: !h.abierto } : h))
    );
  }

  function setHorarioHora(index: number, campo: 'desde' | 'hasta', valor: string) {
    setHorarios((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [campo]: valor } : h))
    );
  }

  return (
    <>
      <main
        className={`min-h-screen bg-gray-50 pb-24 transition-all duration-300 ${
          pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <header className="bg-rojo-andino text-white px-5 pt-10 pb-5">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-bold text-xl">Perfil del negocio</h1>
            <button
              type="button"
              onClick={guardar}
              className="flex items-center gap-1.5 bg-white text-rojo-andino font-bold text-sm px-4 py-2 rounded-2xl shadow-md hover:bg-gray-50"
            >
              {guardado && <Check className="w-4 h-4 text-green-500" />}
              {guardado ? 'Guardado' : 'Guardar'}
            </button>
          </div>
          <p className="text-white/80 text-sm">Datos visibles para tus clientes</p>
        </header>

        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Portada */}
          <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="relative h-36 bg-gray-200">
              {getSafeImageSrc(cover) ? (
                <Image src={getSafeImageSrc(cover)!} alt="Portada" fill className="object-cover" sizes="100vw" priority unoptimized={cover?.startsWith('data:')} />
              ) : null}
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCover}
              />
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                className="absolute bottom-2 right-2 p-2 rounded-xl bg-black/50 text-white hover:bg-black/70"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-end gap-4 -mt-10">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-white flex-shrink-0">
                {logo ? (
                  <LocalLogo src={logo} alt={nombre} fill className="object-contain" sizes="80px" iconClassName="w-8 h-8 text-gray-400" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <Store className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogo}
                />
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <label className="text-xs text-gray-500 block mb-0.5">Nombre del negocio</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full font-bold text-gray-900 text-lg bg-transparent border-b border-transparent hover:border-gray-200 focus:border-rojo-andino focus:outline-none pb-1"
                />
              </div>
            </div>
          </section>

          {/* Dirección */}
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Dirección</span>
            </div>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Calle, número, ciudad"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            />
          </section>

          {/* Teléfono / contacto */}
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Teléfono de contacto</span>
            </div>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+593 ..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            />
          </section>

          {/* Horarios */}
          <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 p-4 pb-2">
              <Clock className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Horarios de atención</span>
            </div>
            <div className="divide-y divide-gray-50">
              {horarios.map((h, index) => (
                <div key={h.dia} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">{h.dia}</span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={h.abierto}
                          onChange={() => toggleHorario(index)}
                          className="rounded border-gray-300 text-rojo-andino focus:ring-rojo-andino"
                        />
                        <span className="text-xs text-gray-600">Abierto</span>
                      </label>
                      {h.abierto && (
                        <div className="flex items-center gap-1 text-xs">
                          <input
                            type="time"
                            value={h.desde}
                            onChange={(e) => setHorarioHora(index, 'desde', e.target.value)}
                            className="w-20 py-1 px-2 rounded-lg border border-gray-200"
                          />
                          <span className="text-gray-400">-</span>
                          <input
                            type="time"
                            value={h.hasta}
                            onChange={(e) => setHorarioHora(index, 'hasta', e.target.value)}
                            className="w-20 py-1 px-2 rounded-lg border border-gray-200"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <NavPanel />
    </>
  );
}
