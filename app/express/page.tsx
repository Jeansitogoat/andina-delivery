'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Zap,
  MapPin,
  Phone,
  Truck,
  CheckCircle2,
  Package,
  Receipt,
  ShoppingCart,
  FileText,
  MoreHorizontal,
  ChevronRight,
  Clock,
} from 'lucide-react';
import CampoUbicacionConMapa from '@/components/CampoUbicacionConMapa';

// ---- Tipos ----
interface MandadoForm {
  que: string;
  desde: string;
  hasta: string;
  telefono: string;
}

// ---- Datos ----
const TIPO_MANDADO = [
  { label: 'Encomienda', icon: Package },
  { label: 'Pago de servicios', icon: Receipt },
  { label: 'Compras', icon: ShoppingCart },
  { label: 'Documentos', icon: FileText },
  { label: 'Otro', icon: MoreHorizontal },
];

const SUGERENCIAS_DESDE = [
  'RHK Asadero, Calle Bolívar',
  'Farmacia Mia, Calle Sucre',
  'Supermercado Gran Ideal',
  'Julieta Books & Coffee',
  'Banco del Pichincha',
  'CNEL - Planillas',
];

const SUGERENCIAS_HASTA = [
  'Calle Sucre, frente al parque',
  'Sector La Cadena',
  'Barrio El Retiro',
  'Av. Rocafuerte',
  'Sector Los Almendros',
];

// ---- Componente barra de progreso ----
function ProgressBar({ step }: { step: number }) {
  const labels = ['¿Qué?', '¿Dónde?', 'Contacto'];
  return (
    <div className="px-5 py-4 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between mb-3">
        {labels.map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                i + 1 < step
                  ? 'bg-green-500 text-white'
                  : i + 1 === step
                  ? 'bg-dorado-oro text-gray-900 shadow-md scale-110'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1 < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-[10px] font-semibold transition-colors ${
                i + 1 <= step ? 'text-gray-800' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
        {/* Líneas conectoras */}
        <div className="absolute left-0 right-0 flex px-12 -z-0 pointer-events-none" style={{ top: '2.25rem' }}>
          <div className={`h-0.5 flex-1 transition-all duration-500 mx-2 ${step > 1 ? 'bg-dorado-oro' : 'bg-gray-200'}`} />
          <div className={`h-0.5 flex-1 transition-all duration-500 mx-2 ${step > 2 ? 'bg-dorado-oro' : 'bg-gray-200'}`} />
        </div>
      </div>
      {/* Barra continua */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-dorado-oro to-amber-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5 text-right font-medium">Paso {step} de 3</p>
    </div>
  );
}

// ---- Página principal ----
export default function ExpressPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<MandadoForm>({ que: '', desde: '', hasta: '', telefono: '' });
  const [confirmed, setConfirmed] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  const handleTipoClick = (tipo: string) => {
    if (form.que.includes(tipo)) return;
    setForm((f) => ({ ...f, que: tipo + (f.que ? ': ' + f.que : '') }));
  };

  const handleNext = () => {
    if (step < 3) setStep((s) => s + 1);
    else handleConfirm();
  };

  const handleConfirm = () => {
    setConfirmed(true);
  };

  const canNext =
    step === 1
      ? form.que.trim().length > 0
      : step === 2
      ? form.desde.trim().length > 0 && form.hasta.trim().length > 0
      : true;

  // ---- CONFIRMACIÓN ----
  if (confirmed) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 to-white flex flex-col items-center justify-center px-4">
        <div
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center"
          style={{ animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
        >
          {/* Ícono éxito */}
          <div className="w-20 h-20 rounded-full bg-dorado-oro/20 flex items-center justify-center mx-auto mb-5">
            <div className="w-14 h-14 rounded-full bg-dorado-oro flex items-center justify-center">
              <Zap className="w-8 h-8 text-gray-900" />
            </div>
          </div>
          <h2 className="font-black text-2xl text-gray-900 mb-2">¡Mandado solicitado!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Tu socio de la Compañía Virgen de la Merced está en camino.
          </p>

          {/* Tiempo estimado */}
          <div className="flex items-center justify-center gap-2 bg-dorado-oro/10 border border-dorado-oro/30 rounded-2xl py-3 px-5 mb-5">
            <Clock className="w-4 h-4 text-dorado-oro" />
            <span className="text-sm font-semibold text-gray-800">
              Tiempo estimado: <span className="text-rojo-andino font-black">15-30 min</span>
            </span>
          </div>

          {/* Resumen */}
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-dorado-oro/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium">Mandado</p>
                <p className="text-sm text-gray-800 font-semibold">{form.que}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-dorado-oro/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium">Desde</p>
                <p className="text-sm text-gray-800 font-semibold">{form.desde}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-rojo-andino/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-rojo-andino" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium">Hasta</p>
                <p className="text-sm text-gray-800 font-semibold">{form.hasta}</p>
              </div>
            </div>
          </div>

          {/* Socio */}
          <div className="flex items-center gap-3 bg-rojo-andino/5 border border-rojo-andino/15 rounded-2xl p-3 mb-6 text-left">
            <div className="w-10 h-10 rounded-full bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5 text-rojo-andino" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">Cía. Virgen de la Merced</p>
              <p className="text-xs text-gray-500 mt-0.5">Socio asignado · En camino</p>
            </div>
          </div>

          <a
            href={`https://wa.me/593992250333?text=${encodeURIComponent(
              `Hola! Solicité un mandado:\n¿Qué? ${form.que}\nDesde: ${form.desde}\nHasta: ${form.hasta}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm mb-3 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Contactar por WhatsApp · 099 225 0333
          </a>
          <button
            type="button"
            onClick={() => {
              setConfirmed(false);
              setStep(1);
              setForm({ que: '', desde: '', hasta: '', telefono: '' });
            }}
            className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm mb-2 transition-colors"
          >
            Solicitar otro mandado
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm transition-colors"
          >
            Volver al inicio
          </button>
        </div>

        <style>{`
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.85); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-gray-50 flex flex-col transition-all duration-300 ${
        pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* ---- HEADER ---- */}
      <header className="bg-gradient-to-r from-amber-500 to-dorado-oro sticky top-0 z-10 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
            className="w-10 h-10 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-gray-900" />
            </div>
            <div>
              <h1 className="font-black text-gray-900 text-base leading-none">Mandados</h1>
              <p className="text-gray-900/60 text-xs font-medium">Andina · Mandados en minutos</p>
            </div>
          </div>
        </div>
      </header>

      {/* ---- HERO (solo en paso 1) ---- */}
      {step === 1 && (
        <div className="bg-gradient-to-b from-dorado-oro/10 to-transparent px-4 pt-5 pb-2 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-dorado-oro/20 p-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-dorado-oro flex items-center justify-center shadow-md flex-shrink-0">
              <Zap className="w-7 h-7 text-gray-900" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-base">¿Qué necesitas hacer?</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Mandados, encomiendas, pagos y más · Piñas, El Oro
              </p>
            </div>
          </div>
          {/* Chips de tipo */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {TIPO_MANDADO.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleTipoClick(label)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-sm font-semibold transition-all ${
                  form.que.startsWith(label)
                    ? 'bg-dorado-oro border-dorado-oro text-gray-900 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-dorado-oro/50 hover:bg-dorado-oro/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- PROGRESS BAR ---- */}
      <div className="relative max-w-2xl mx-auto w-full">
        <ProgressBar step={step} />
      </div>

      {/* ---- CONTENIDO POR PASO ---- */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 pb-32">

        {/* PASO 1 — ¿Qué necesitas? */}
        {step === 1 && (
          <div
            key="step1"
            className="space-y-4"
            style={{ animation: 'fadeSlideIn 0.25s ease-out' }}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Descríbenos tu mandado *
                </label>
                <textarea
                  value={form.que}
                  onChange={(e) => setForm((f) => ({ ...f, que: e.target.value }))}
                  placeholder="Ej: Pagar planilla de luz en CNEL, recoger encomienda en el banco..."
                  rows={5}
                  maxLength={300}
                  className="w-full px-0 py-0 text-sm text-gray-800 placeholder-gray-400 border-none outline-none resize-none bg-transparent leading-relaxed"
                />
              </div>
              <div className="px-4 pb-3 flex justify-between items-center border-t border-gray-50 pt-2">
                <p className="text-xs text-gray-400">Sé específico para que tu socio entienda bien</p>
                <span className={`text-xs font-semibold ${form.que.length > 250 ? 'text-rojo-andino' : 'text-gray-300'}`}>
                  {form.que.length}/300
                </span>
              </div>
            </div>

            {/* Ejemplos */}
            <div className="bg-dorado-oro/5 border border-dorado-oro/20 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide">Ejemplos populares</p>
              <div className="space-y-2">
                {[
                  'Pagar planilla de luz en CNEL',
                  'Recoger encomienda en el correo',
                  'Comprar medicamentos en Farmacia Mia',
                ].map((ejemplo) => (
                  <button
                    key={ejemplo}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, que: ejemplo }))}
                    className="w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl bg-white border border-dorado-oro/20 hover:border-dorado-oro/50 hover:bg-dorado-oro/5 transition-colors group"
                  >
                    <span className="text-sm text-gray-700 font-medium">{ejemplo}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-dorado-oro transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PASO 2 — ¿Dónde? */}
        {step === 2 && (
          <div
            key="step2"
            className="space-y-4"
            style={{ animation: 'fadeSlideIn 0.25s ease-out' }}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Recoger en */}
              <div className="px-4 py-4">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-dorado-oro/20 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  Recoger en *
                </label>
                <CampoUbicacionConMapa
                  value={form.desde}
                  onChange={(v) => setForm((f) => ({ ...f, desde: v }))}
                  label=""
                  placeholder="¿Dónde recogemos el mandado?"
                  compact
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SUGERENCIAS_DESDE.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, desde: s }))}
                      className="px-2.5 py-1 rounded-lg bg-dorado-oro/10 text-amber-700 text-xs font-medium hover:bg-dorado-oro/20 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Línea conectora visual */}
              <div className="relative flex items-center px-4">
                <div className="w-6 flex flex-col items-center gap-0.5">
                  <div className="w-0.5 h-2 bg-gray-200 rounded" />
                  <div className="w-0.5 h-2 bg-gray-200 rounded" />
                  <div className="w-0.5 h-2 bg-gray-200 rounded" />
                </div>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Entregar en */}
              <div className="px-4 py-4">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-rojo-andino/10 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-rojo-andino" />
                  </div>
                  Entregar en *
                </label>
                <CampoUbicacionConMapa
                  value={form.hasta}
                  onChange={(v) => setForm((f) => ({ ...f, hasta: v }))}
                  label=""
                  placeholder="¿A dónde lo llevamos?"
                  compact
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SUGERENCIAS_HASTA.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, hasta: s }))}
                      className="px-2.5 py-1 rounded-lg bg-rojo-andino/10 text-rojo-andino text-xs font-medium hover:bg-rojo-andino/20 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Info de costo */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start gap-3">
              <Truck className="w-5 h-5 text-dorado-oro flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p className="font-bold text-gray-900">Socio Cía. Virgen de la Merced</p>
                <p className="text-gray-500 text-xs mt-0.5">Costo según distancia · Tiempo estimado 15-30 min</p>
              </div>
            </div>
          </div>
        )}

        {/* PASO 3 — Tu contacto */}
        {step === 3 && (
          <div
            key="step3"
            className="space-y-4"
            style={{ animation: 'fadeSlideIn 0.25s ease-out' }}
          >
            {/* Resumen del mandado */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">Resumen del mandado</p>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-dorado-oro/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium">¿Qué necesitas?</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{form.que}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-dorado-oro/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium">Recoger en</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{form.desde}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-rojo-andino" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium">Entregar en</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{form.hasta}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full px-4 py-3 border-t border-gray-50 text-xs text-rojo-andino font-semibold hover:bg-gray-50 transition-colors text-left"
              >
                Editar información →
              </button>
            </div>

            {/* Teléfono */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-4">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  Tu teléfono
                  <span className="text-gray-400 font-normal text-xs">(opcional)</span>
                </label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="09X XXX XXXX"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-dorado-oro/40 focus:border-dorado-oro transition-colors"
                />
                <p className="text-xs text-gray-400 mt-2">Para que el socio pueda contactarte si hay algún inconveniente</p>
              </div>
            </div>

            {/* Info socio */}
            <div className="bg-gradient-to-br from-rojo-andino to-rojo-andino/80 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6 text-dorado-oro" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Cía. Virgen de la Merced</p>
                <p className="text-white/70 text-xs mt-0.5">Tu mandado llega en 15-30 min · Costo según distancia</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- BOTÓN STICKY INFERIOR ---- */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent px-4 pb-6 pt-4 z-30">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={handleNext}
            disabled={!canNext}
            className={`w-full py-4 rounded-2xl font-bold text-base shadow-2xl transition-all flex items-center justify-center gap-2 ${
              canNext
                ? 'bg-rojo-andino hover:bg-rojo-andino/90 text-white active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {step < 3 ? (
              <>
                Siguiente
                <ChevronRight className="w-5 h-5" />
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Solicitar mandado
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </main>
  );
}
