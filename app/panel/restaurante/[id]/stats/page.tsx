'use client';

import { use, useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Users, DollarSign, Flame, Percent, Loader2, MessageCircle, CreditCard, Copy } from 'lucide-react';
import NavPanel from '@/components/panel/NavPanel';
import type { MenuItem } from '@/lib/data';
import { getIdToken } from '@/lib/authToken';

const LABELS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface StatsData {
  hoy: { totalPedidos: number; totalIngresos: number; clientesUnicos: number; datosPedidos: number[]; datosIngresos: number[] };
  semana: { totalPedidos: number; totalIngresos: number; clientesUnicos: number; datosPedidos: number[]; datosIngresos: number[] };
  mes: { totalPedidos: number; totalIngresos: number; clientesUnicos: number; datosPedidos: number[]; datosIngresos: number[] };
  topItems?: Array<{ nombre: string; cantidad: number }>;
}

export default function PanelStatsIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [pageVisible, setPageVisible] = useState(false);
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('semana');
  const [comisionPendiente, setComisionPendiente] = useState<number | null>(null);
  const [comisionPagada, setComisionPagada] = useState<number | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [adminConfig, setAdminConfig] = useState<{ cuenta: string; banco: string; whatsappAdmin: string } | null>(null);
  const [localName, setLocalName] = useState('');
  const [_copiadoCuenta, setCopiadoCuenta] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/locales/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: { menu?: MenuItem[]; local?: { name?: string } } | null) => {
        if (!cancelled && data) {
          setItems(data.menu ?? []);
          setLocalName(data.local?.name ?? '');
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  /* Cargar comisiones reales */
  useEffect(() => {
    let cancelled = false;
    getIdToken().then(async (token) => {
      if (!token || cancelled) return;
      try {
        const res = await fetch(`/api/comisiones?localId=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { totalPendiente: number; totalPagado: number };
        if (!cancelled) {
          setComisionPendiente(data.totalPendiente ?? 0);
          setComisionPagada(data.totalPagado ?? 0);
        }
      } catch {
        // silencioso
      }
    });
    return () => { cancelled = true; };
  }, [id]);

  /* Cargar config administración (cuenta + WhatsApp) para Pagar comisión y Contactar */
  useEffect(() => {
    let cancelled = false;
    getIdToken().then(async (token) => {
      if (!token || cancelled) return;
      try {
        const res = await fetch('/api/config/transferencia', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { cuenta?: string; banco?: string; whatsappAdmin?: string };
        if (!cancelled) {
          setAdminConfig({
            cuenta: data.cuenta ?? '',
            banco: data.banco ?? '',
            whatsappAdmin: data.whatsappAdmin ?? '',
          });
        }
      } catch {
        // silencioso
      }
    });
    return () => { cancelled = true; };
  }, []);

  /* Cargar stats reales (pedidos, ingresos, clientes) */
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    getIdToken()
      .then(async (token) => {
        if (!token || cancelled) return;
        const res = await fetch(`/api/stats/local?localId=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json() as StatsData;
        if (!cancelled) setStatsData(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  const masVendidos = items.filter((i) => i.bestseller).slice(0, 5);
  const topItems = statsData?.topItems ?? [];
  const s = statsData?.[periodo];
  const totalPedidos = s?.totalPedidos ?? 0;
  const totalIngresos = s?.totalIngresos ?? 0;
  const clientesUnicos = s?.clientesUnicos ?? 0;
  const datosPedidos = s?.datosPedidos ?? (periodo === 'mes' ? [0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0]);
  const datosIngresos = s?.datosIngresos ?? (periodo === 'mes' ? [0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0]);
  const labels = periodo === 'mes' ? ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'] : LABELS_SEMANA;
  const maxPedidos = Math.max(...datosPedidos, 1);
  const _maxIngresos = Math.max(...datosIngresos, 1);

  return (
    <>
      <main
        className={`min-h-screen bg-gray-50 pb-24 transition-all duration-300 ${
          pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <header className="bg-rojo-andino text-white px-5 pt-10 pb-5">
          <h1 className="font-bold text-xl mb-1">Estadísticas</h1>
          <p className="text-white/80 text-sm">Rendimiento de tu negocio</p>
          <div className="flex gap-2 mt-3">
            {(['hoy', 'semana', 'mes'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize ${
                  periodo === p ? 'bg-white text-rojo-andino' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </header>

        <div className="p-4 space-y-6 max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-3">
            {statsLoading ? (
              <div className="col-span-3 flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              </div>
            ) : (
              [
                { icon: DollarSign, label: 'Ingresos', value: `$${totalIngresos.toFixed(2)}`, color: 'text-green-600' },
                { icon: ShoppingBag, label: 'Pedidos', value: String(totalPedidos), color: 'text-rojo-andino' },
                { icon: Users, label: 'Clientes', value: String(clientesUnicos), color: 'text-blue-600' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <Icon className={`w-5 h-5 ${color} mb-2`} />
                  <p className="font-black text-lg text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))
            )}
          </div>

          {/* Comisiones y administración */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Percent className="w-4 h-4 text-amber-600" />
              Comisión Andina (8% + 2% coste servicio)
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 border border-amber-100">
                <p className="text-xs text-gray-500 mb-1">Pendiente de pago</p>
                <p className="font-black text-xl text-amber-600">
                  {comisionPendiente !== null ? `$${comisionPendiente.toFixed(2)}` : '—'}
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-green-100">
                <p className="text-xs text-gray-500 mb-1">Ya pagado</p>
                <p className="font-black text-xl text-green-600">
                  {comisionPagada !== null ? `$${comisionPagada.toFixed(2)}` : '—'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Se calcula al entregar cada pedido (8% local). El cliente paga el 2% como coste de servicio.
            </p>
            <div className="mt-4 pt-3 border-t border-amber-200 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Comisiones y administración</p>
              {adminConfig && adminConfig.cuenta && (
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Pagar comisión — Número de cuenta</p>
                    <p className="font-mono text-sm font-semibold text-gray-900 truncate">{adminConfig.cuenta}</p>
                    {adminConfig.banco && <p className="text-xs text-gray-500">{adminConfig.banco}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (adminConfig.cuenta) {
                        navigator.clipboard.writeText(adminConfig.cuenta).catch(() => {});
                        setCopiadoCuenta(true);
                        setTimeout(() => setCopiadoCuenta(false), 2000);
                      }
                    }}
                    className="p-2 rounded-lg bg-white border border-amber-200 hover:bg-amber-50 text-gray-600"
                    title="Copiar cuenta"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
              {adminConfig && adminConfig.whatsappAdmin && (
                <a
                  href={`https://wa.me/${adminConfig.whatsappAdmin.replace(/\D/g, '')}?text=${encodeURIComponent(localName ? `Hola, soy ${localName} y tengo una consulta.` : 'Hola, tengo una consulta sobre mi negocio.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full py-2 px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
                >
                  <MessageCircle className="w-4 h-4 flex-shrink-0" />
                  Comunicate con administración
                </a>
              )}
            </div>
          </div>

          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rojo-andino" />
              Pedidos
            </h2>
            <div className="flex items-end gap-1 h-32">
              {datosPedidos.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-lg bg-rojo-andino/80 min-h-[4px] transition-all duration-300"
                    style={{ height: `${(val / maxPedidos) * 100}%` }}
                  />
                  <span className="text-[10px] text-gray-400 font-medium">{labels[i]}</span>
                </div>
              ))}
            </div>
          </section>

          {topItems.length > 0 && (
            <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rojo-andino" />
                Lo más vendido
              </h2>
              <p className="text-xs text-gray-500 mb-3">Por cantidad de unidades en pedidos entregados</p>
              <ul className="space-y-3">
                {topItems.map((item, i) => (
                  <li key={item.nombre + i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-rojo-andino/10 text-rojo-andino text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.nombre}</p>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full bg-rojo-andino/80"
                          style={{
                            width: `${Math.min(100, (item.cantidad / Math.max(topItems[0]?.cantidad ?? 1, 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-700 flex-shrink-0">{item.cantidad} ud.</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {masVendidos.length > 0 && (
            <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rojo-andino" />
                Destacados en menú
              </h2>
              <ul className="space-y-2">
                {masVendidos.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="font-semibold text-gray-900">${item.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <NavPanel />
    </>
  );
}
