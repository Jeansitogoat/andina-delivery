'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { getIdToken } from '@/lib/authToken';
import { getFirebaseStorage, getFirestoreDb, getFirebaseAuth } from '@/lib/firebase/client';
import { compressImage } from '@/lib/compressImage';
import { getSafeImageSrc } from '@/lib/validImageUrl';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import {
  Bike,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  Package,
  KeyRound,
  ChevronRight,
  ArrowLeft,
  Wallet,
  Star,
  History,
  AlertCircle,
  Navigation,
  X,
  Check,
  Bell,
  ShoppingBag,
  LogOut,
  Camera,
} from 'lucide-react';
import { useNotifications } from '@/lib/useNotifications';
import { useAuth } from '@/lib/useAuth';
import type { EstadoCarrera, EstadoRider, CarreraRider } from '@/lib/types';
import ModalCerrarSesion from '@/components/panel/ModalCerrarSesion';

function mapEstado(estadoPedido: string): EstadoCarrera {
  if (estadoPedido === 'en_camino') return 'en_camino';
  if (estadoPedido === 'entregado') return 'entregada';
  return 'asignada';
}

function docToCarrera(d: { id: string; data: () => Record<string, unknown> }): CarreraRider {
  const data = d.data();
  return {
    id: d.id,
    pedidoId: d.id,
    restaurante: (data.restaurante as string) || '—',
    restauranteDireccion: (data.restauranteDireccion as string) || '—',
    clienteNombre: (data.clienteNombre as string) || 'Cliente',
    clienteDireccion: (data.clienteDireccion as string) || '—',
    clienteTelefono: (data.clienteTelefono as string) || '',
    total: (data.total as number) || 0,
    propina: (data.propina as number) || 0,
    codigoVerificacion: (data.codigoVerificacion as string) || '',
    estado: mapEstado((data.estado as string) || 'asignado'),
    hora: (data.hora as string) || '',
    distancia: (data.distancia as string) || '—',
    items: Array.isArray(data.items) ? (data.items as string[]) : [],
    batchId: (data.batchId as string) ?? null,
    batchIndex: (data.batchIndex as number) ?? null,
    timestamp: (data.timestamp as number) ?? 0,
  };
}

const ESTADO_RIDER_CONFIG: Record<EstadoRider, { label: string; dot: string; bg: string }> = {
  disponible: { label: 'Disponible', dot: 'bg-green-400', bg: 'bg-green-500' },
  ocupado: { label: 'Ocupado', dot: 'bg-yellow-400', bg: 'bg-yellow-500' },
  ausente: { label: 'Ausente', dot: 'bg-orange-400', bg: 'bg-orange-500' },
  fuera_servicio: { label: 'Fuera de servicio', dot: 'bg-red-400', bg: 'bg-red-500' },
};

const ESTADOS_ACTIVOS = ['confirmado', 'preparando', 'listo', 'esperando_rider', 'asignado', 'en_camino'] as const;

/* ─────────────── componente ─────────────── */
export default function PanelRiderPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { permission, requestPermission, loading: notifLoading } = useNotifications('rider');
  const [carreras, setCarreras] = useState<CarreraRider[]>([]);
  const [historialHoy, setHistorialHoy] = useState<CarreraRider[]>([]);
  const [tab, setTab] = useState<'activas' | 'historial'>('activas');
  const [filtroHistorial, setFiltroHistorial] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [carreraActiva, setCarreraActiva] = useState<CarreraRider | null>(null);
  const [mostrarVerificacion, setMostrarVerificacion] = useState(false);
  const [codigoIngresado, setCodigoIngresado] = useState('');
  const [errorCodigo, setErrorCodigo] = useState(false);
  const [codigoOk, setCodigoOk] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [toast, setToast] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [miEstado, setMiEstado] = useState<EstadoRider>('disponible');
  const [sessionInvalid, setSessionInvalid] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [avanzandoKey, setAvanzandoKey] = useState<string | null>(null);

  const prevCarreraIdsRef = useRef<Set<string>>(new Set());
  const newOrderSoundRef = useRef<HTMLAudioElement | null>(null);
  function playNewCarreraSound() {
    try {
      if (!newOrderSoundRef.current) newOrderSoundRef.current = new Audio('/sounds/new-order.mp3');
      newOrderSoundRef.current.volume = 1.0;
      newOrderSoundRef.current.play().catch(() => {});
    } catch {
      // ignorar
    }
  }

  /* Sincronizar miEstado con user.estadoRider y con carreras activas (ocupado) */
  useEffect(() => {
    if (!user) return;
    if (carreras.filter((c) => c.estado !== 'entregada').length > 0) {
      setMiEstado('ocupado');
    } else {
      const manual = (user as { estadoRider?: EstadoRider }).estadoRider ?? 'disponible';
      setMiEstado(manual);
    }
  }, [user, carreras]);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.rol !== 'rider' && user.rol !== 'maestro')) {
      router.replace('/auth');
    }
  }, [user, loading, router]);

  /* Suscripción en tiempo real: activos (solo no entregados) + historial (últimos 20 entregados) para optimizar lecturas */
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.uid || (user.rol !== 'rider' && user.rol !== 'maestro')) return;
    const db = getFirestoreDb();
    const uid = user.uid;

    const qActivas = query(
      collection(db, 'pedidos'),
      where('riderId', '==', uid),
      where('estado', 'in', [...ESTADOS_ACTIVOS])
    );
    const unsubActivas = onSnapshot(qActivas, (snap) => {
      const activas: CarreraRider[] = snap.docs.map((d) => docToCarrera({ id: d.id, data: () => d.data() }));
      const newIds = new Set(activas.map((c) => c.id));
      if (activas.some((c) => !prevCarreraIdsRef.current.has(c.id))) {
        playNewCarreraSound();
      }
      prevCarreraIdsRef.current = newIds;
      setCarreras(activas);
    }, (err) => {
      console.error('onSnapshot pedidos rider (activas)', err);
    });

    const qHistorial = query(
      collection(db, 'pedidos'),
      where('riderId', '==', uid),
      where('estado', '==', 'entregado'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubHistorial = onSnapshot(qHistorial, (snap) => {
      const list: CarreraRider[] = snap.docs.map((d) => docToCarrera({ id: d.id, data: () => d.data() }));
      const now = Date.now();
      const hoyInicio = new Date();
      hoyInicio.setHours(0, 0, 0, 0);
      const hoyTs = hoyInicio.getTime();
      const semanaAtras = now - 7 * 24 * 60 * 60 * 1000;
      const mesAtras = now - 30 * 24 * 60 * 60 * 1000;
      const desde = filtroHistorial === 'mes' ? mesAtras : filtroHistorial === 'semana' ? semanaAtras : hoyTs;
      setHistorialHoy(list.filter((c) => (c.timestamp ?? 0) >= desde));
    }, (err) => {
      console.error('onSnapshot pedidos rider (historial)', err);
    });

    return () => {
      unsubActivas();
      unsubHistorial();
    };
  }, [user?.uid, user?.rol, filtroHistorial]);

  /* Cargar carreras desde API como respaldo inicial (token fresco en cada llamada para evitar expiración) */
  const cargarCarreras = useCallback(async () => {
    const tok = await getIdToken();
    if (!tok) return;
    try {
      const res = await fetch(`/api/rider?filtro=${filtroHistorial}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.status === 401) {
        setSessionInvalid(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json() as { carreras: CarreraRider[]; historial: CarreraRider[] };
      if (Array.isArray(data.carreras)) setCarreras(data.carreras);
      if (Array.isArray(data.historial)) setHistorialHoy(data.historial);
    } catch {
      // silencioso
    }
  }, [filtroHistorial]);

  useEffect(() => {
    if (!user) return;
    if (sessionInvalid) {
      router.replace('/auth');
      return;
    }
    cargarCarreras();
    let t: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (t) return;
      t = setInterval(cargarCarreras, 20000);
    };
    const stopPolling = () => {
      if (t) {
        clearInterval(t);
        t = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cargarCarreras();
        startPolling();
      } else {
        stopPolling();
      }
    };
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, filtroHistorial, cargarCarreras, sessionInvalid, router]);

  /* Agrupar carreras activas por batch solo cuando hay 2+ pedidos con el mismo batchId (multi-stop real) */
  const carrerasAgrupadas = useMemo(() => {
    const activas = carreras.filter((c) => c.estado !== 'entregada');
    const batchCounts = new Map<string, number>();
    activas.forEach((c) => {
      if (c.batchId) batchCounts.set(c.batchId, (batchCounts.get(c.batchId) ?? 0) + 1);
    });
    const byBatch = new Map<string, CarreraRider[]>();
    activas.forEach((c) => {
      const isRealBatch = !!(c.batchId && (batchCounts.get(c.batchId) ?? 0) >= 2);
      const key = isRealBatch ? c.batchId! : c.id;
      if (!byBatch.has(key)) byBatch.set(key, []);
      byBatch.get(key)!.push(c);
    });
    return Array.from(byBatch.values()).map((group) =>
      group.length > 1 ? group.sort((a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0)) : group
    );
  }, [carreras]);

  /* stats del día */
  const todasEntregadas = [...historialHoy, ...carreras.filter((c) => c.estado === 'entregada')];
  const GANANCIA_BASE_POR_CARRERA = 1.5;
  const gananciasHoy = todasEntregadas.reduce((s, c) => s + (c.propina ?? 0), 0) + todasEntregadas.length * GANANCIA_BASE_POR_CARRERA;
  const carrerasHoy = todasEntregadas.length;

  /* mostrar toast */
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /* avanzar estado */
  async function avanzarEstado(id: string, nuevoEstado: EstadoCarrera, batchId?: string | null) {
    const carrera = carreras.find((c) => c.id === id);
    if (!carrera) return;
    if (nuevoEstado !== 'en_camino') return;
    const key = batchId ?? id;
    setAvanzandoKey(key);
    const prevCarreras = carreras;
    setCarreras((prev) =>
      prev.map((c) => (c.id === id || (batchId && c.batchId === batchId) ? { ...c, estado: nuevoEstado } : c))
    );
    showToast('¡En camino! El cliente fue notificado.');
    try {
      const tok = await getIdToken();
      if (!tok) {
        setCarreras(prevCarreras);
        showToast('No se pudo avanzar. Revisá la sesión.');
        return;
      }
      const url = batchId
        ? `/api/pedidos/batch/${encodeURIComponent(batchId)}/estado`
        : `/api/pedidos/${id}`;
      const body = JSON.stringify({ estado: 'en_camino' });
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body,
      });
      if (!res.ok) {
        setCarreras(prevCarreras);
        showToast('No se pudo avanzar. Revisá la conexión.');
      }
    } finally {
      setAvanzandoKey(null);
    }
  }

  /* verificar código */
  function verificarCodigo() {
    if (!carreraActiva) return;
    if (codigoIngresado !== carreraActiva.codigoVerificacion) {
      setErrorCodigo(true);
      setTimeout(() => setErrorCodigo(false), 2000);
      return;
    }
    setCodigoOk(true);
    const id = carreraActiva.id;
    const propina = carreraActiva.propina ?? 0;
    const batchId = carreraActiva.batchId;

    getIdToken().then((tok) => {
      if (!tok) return;
      if (batchId) {
        fetch('/api/pedidos/batch/cerrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ batchId, codigo: codigoIngresado }),
        }).then((res) => {
        if (res.ok) {
          const batchCarreras = carreras.filter((c) => c.batchId === batchId);
          const totalPropina = batchCarreras
            .reduce((s, c) => s + (c.propina ?? 0), 0) + batchCarreras.length * GANANCIA_BASE_POR_CARRERA;
          setTimeout(() => {
            setMostrarVerificacion(false);
            setCarreraActiva(null);
            setCodigoIngresado('');
            setCodigoOk(false);
            showToast('¡Carrera completada! +$' + totalPropina.toFixed(2) + ' ganados');
          }, 1500);
        } else {
          setCodigoOk(false);
          setErrorCodigo(true);
          setTimeout(() => setErrorCodigo(false), 2000);
        }
      }).catch(() => {
        setCodigoOk(false);
      });
    } else {
      fetch(`/api/pedidos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ estado: 'entregado' }),
      }).then((res) => {
        if (res.ok) {
          setTimeout(() => {
            setCarreras((prev) => prev.map((c) => (c.id === id ? { ...c, estado: 'entregada' } : c)));
            setMostrarVerificacion(false);
            setCarreraActiva(null);
            setCodigoIngresado('');
            setCodigoOk(false);
            showToast('¡Carrera completada! +$' + (propina + GANANCIA_BASE_POR_CARRERA).toFixed(2) + ' ganados');
          }, 1500);
        } else {
          setCodigoOk(false);
          setErrorCodigo(true);
          setTimeout(() => setErrorCodigo(false), 2000);
        }
      }).catch(() => {
        setCodigoOk(false);
      });
    }
  });
  }

  const activasCount = carreras.filter((c) => c.estado !== 'entregada').length;

  if (loading || !user || (user.rol !== 'rider' && user.rol !== 'maestro')) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando panel de rider...</p>
      </main>
    );
  }

  const CENTRAL_NAME = 'Central Virgen de la Merced';
  if (user.rol === 'rider' && user.riderStatus !== 'approved') {
    const status = user.riderStatus ?? 'pending';
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
          {status === 'pending' && (
            <>
              <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h1 className="font-black text-xl text-gray-900 mb-2">Central todavía no valida tus credenciales</h1>
              <p className="text-gray-600">
                Tu cuenta está pendiente de aprobación por parte de <strong>{CENTRAL_NAME}</strong>.
              </p>
              <p className="text-sm text-gray-500 mt-4">
                Cuando te aprueben podrás usar el panel de riders. Te notificaremos cuando esté listo.
              </p>
            </>
          )}
          {status === 'rejected' && (
            <>
              <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="font-black text-xl text-gray-900 mb-2">Solicitud rechazada</h1>
              <p className="text-gray-600">
                Tu solicitud para ser rider no fue aprobada. Contacta a <strong>{CENTRAL_NAME}</strong> si tienes dudas.
              </p>
            </>
          )}
          {status === 'suspended' && (
            <>
              <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h1 className="font-black text-xl text-gray-900 mb-2">Cuenta suspendida</h1>
              <p className="text-gray-600">
                Tu cuenta de rider está suspendida. Contacta a <strong>{CENTRAL_NAME}</strong> para más información.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-8 w-full py-3 rounded-2xl bg-gray-900 text-white font-bold"
          >
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <main
        className={`min-h-screen bg-gray-50 pb-6 transition-all duration-300 ${
          pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {/* ── encabezado ── */}
        <header
          className="text-white px-4 pt-10 pb-6"
          style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 60%, #2563eb 100%)' }}
        >
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors"
                  title="Ir como cliente"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span className="hidden sm:inline">Ir a pedir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Cerrar sesión</span>
                </button>
                {permission === 'default' && (
                  <button
                    type="button"
                    onClick={requestPermission}
                    disabled={notifLoading}
                    className="text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-70"
                  >
                    {notifLoading ? '...' : 'Activar notificaciones'}
                  </button>
                )}
                {permission === 'granted' && (
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5" />
                    Notificaciones activadas
                  </span>
                )}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ESTADO_RIDER_CONFIG[miEstado].dot} ${miEstado === 'disponible' ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-semibold text-white/90">{ESTADO_RIDER_CONFIG[miEstado].label}</span>
              </div>
            </div>

            {/* Selector de estado del rider: se persiste en Firestore y la central lo refleja. */}
            <div className="mb-5">
              <p className="text-xs text-white/70 font-semibold mb-2">Mi estado</p>
              <div className="flex flex-wrap gap-2">
                {(['disponible', 'ocupado', 'ausente', 'fuera_servicio'] as EstadoRider[]).map((estado) => {
                  const cfg = ESTADO_RIDER_CONFIG[estado];
                  const activo = miEstado === estado;
                  const tieneCarrera = carreras.filter((c) => c.estado !== 'entregada').length > 0;
                  const deshabilitado = estado !== 'ocupado' && tieneCarrera;
                  return (
                    <button
                      key={estado}
                      type="button"
                      disabled={deshabilitado}
                      onClick={async () => {
                        if (estado === 'ocupado') return;
                        setMiEstado(estado);
                        const tok = await getIdToken();
                        if (tok && user?.uid) {
                          try {
                            await fetch(`/api/riders/${user.uid}/estado`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
                              body: JSON.stringify({ estadoRider: estado }),
                            });
                          } catch {
                            setMiEstado(miEstado);
                          }
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        deshabilitado ? 'opacity-60 cursor-not-allowed' : ''
                      } ${
                        activo ? 'bg-white text-gray-900 shadow-md' : 'bg-white/15 text-white/90 hover:bg-white/25'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              {carreras.filter((c) => c.estado !== 'entregada').length > 0 && (
                <p className="text-xs text-white/60 mt-1.5">Tienes una carrera activa; al entregar podrás cambiar tu estado.</p>
              )}
            </div>

            <div className="flex items-center gap-4 mb-5">
              <div className="relative flex-shrink-0">
                {getSafeImageSrc(user?.photoURL) ? (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getSafeImageSrc(user?.photoURL)!} alt={user.displayName ?? 'Rider'} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-xl">
                    {(user
                      ? (() => {
                          const dn = (user.displayName ?? '').trim();
                          if (dn) return (dn.split(/\s+/)[0] || dn).charAt(0);
                          if (user.email) return (user.email.split('@')[0] || 'R').charAt(0);
                          return 'R';
                        })()
                      : 'R'
                    ).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fotoRef.current?.click()}
                  disabled={subiendoFoto}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-70"
                  title="Cambiar foto de perfil"
                >
                  {subiendoFoto ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </button>
                <input
                  ref={fotoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user?.uid) return;
                    e.target.value = '';
                    setSubiendoFoto(true);
                    const storage = getFirebaseStorage();
                    const storageRef = ref(storage, `users/${user.uid}/avatar`);
                    try {
                      const compressed = await compressImage(file, 'avatar');
                      await uploadBytes(storageRef, compressed);
                      const url = await getDownloadURL(storageRef);
                      const db = getFirestoreDb();
                      await setDoc(doc(db, 'users', user.uid), { photoURL: url, updatedAt: serverTimestamp() }, { merge: true });
                      const auth = getFirebaseAuth();
                      if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL: url });
                    } catch (err) {
                      console.error('Error subiendo foto', err);
                    } finally {
                      setSubiendoFoto(false);
                    }
                  }}
                />
              </div>
              <div>
                <h1 className="font-black text-xl">
                  {user
                    ? (() => {
                        const dn = (user.displayName ?? '').trim();
                        if (dn) return dn.split(/\s+/)[0] || dn;
                        if (user.email) return user.email.split('@')[0] || 'Usuario';
                        return 'Rider';
                      })()
                    : 'Rider'}
                </h1>
                <p className="text-white/70 text-sm">Rider · Cía. Virgen de la Merced</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
                  <span className="text-sm font-bold text-yellow-300">
                    {user?.ratingPromedio != null && user.ratingPromedio > 0 ? user.ratingPromedio.toFixed(1) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* stats rápidas */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Carreras hoy', value: carrerasHoy.toString(), icon: Bike },
                { label: 'Activas', value: activasCount.toString(), icon: Package },
                { label: 'Ganancias', value: `$${gananciasHoy.toFixed(2)}`, icon: Wallet },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/15 rounded-2xl p-3 text-center">
                  <Icon className="w-4 h-4 text-white/70 mx-auto mb-1" />
                  <p className="font-black text-base text-white">{value}</p>
                  <p className="text-[10px] text-white/60 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* ── tabs ── */}
        <div className="max-w-lg mx-auto px-4 -mt-1">
          <div className="bg-white rounded-2xl p-1 flex shadow-sm mb-4 mt-4">
            {([
              { id: 'activas', label: `Carreras activas (${activasCount})`, icon: Bike },
              { id: 'historial', label: 'Historial de hoy', icon: History },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  tab === id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── carreras activas ── */}
          {tab === 'activas' && (
            <div className="space-y-4">
              {carrerasAgrupadas.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
                  <Bike className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="font-bold text-gray-400">No tienes carreras activas</p>
                  <p className="text-xs text-gray-300 mt-1">Espera la asignación de la central</p>
                </div>
              ) : (
                carrerasAgrupadas.map((group) => {
                  const leader = group[0];
                  const esBatch = group.length > 1;
                  return esBatch ? (
                    <TarjetaCarreraBatch
                      key={leader.batchId!}
                      carreras={group}
                      avanzandoKey={avanzandoKey}
                      onVerDetalle={() => setCarreraActiva(leader)}
                      onEnCamino={() => avanzarEstado(leader.id, 'en_camino', leader.batchId ?? undefined)}
                      onVerificar={() => {
                        setCarreraActiva(leader);
                        setMostrarVerificacion(true);
                      }}
                    />
                  ) : (
                    <TarjetaCarrera
                      key={leader.id}
                      carrera={leader}
                      avanzandoKey={avanzandoKey}
                      onVerDetalle={() => setCarreraActiva(leader)}
                      onEnCamino={() => avanzarEstado(leader.id, 'en_camino')}
                      onVerificar={() => {
                        setCarreraActiva(leader);
                        setMostrarVerificacion(true);
                      }}
                    />
                  );
                })
              )}
            </div>
          )}

          {/* ── historial ── */}
          {tab === 'historial' && (
            <div className="space-y-3">
              <div className="flex gap-2 mb-2">
                {(['hoy', 'semana', 'mes'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltroHistorial(f)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      filtroHistorial === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Semana' : 'Mes'}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded-3xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">
                    Total ganado{filtroHistorial === 'hoy' ? ' hoy' : filtroHistorial === 'semana' ? ' esta semana' : ' este mes'}
                  </p>
                  <p className="font-black text-2xl text-blue-600">${gananciasHoy.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Carreras completadas</p>
                  <p className="font-black text-2xl text-gray-900">{historialHoy.length}</p>
                </div>
              </div>

              {[...carreras.filter((c) => c.estado === 'entregada'), ...historialHoy].map((c) => (
                <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-bold text-sm text-gray-900 truncate">{c.clienteNombre}</p>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{c.hora}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{c.restaurante} → {c.clienteDireccion}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((c.clienteDireccion || '') + ', Piñas, Ecuador')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-blue-600"
                    >
                      <Navigation className="w-3 h-3" />
                      Ver en mapa
                    </a>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-semibold text-blue-600">
                        +${(c.propina + GANANCIA_BASE_POR_CARRERA).toFixed(2)} ganados
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{c.distancia}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>

      <ModalCerrarSesion
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          logout().then(() => router.replace('/auth'));
        }}
      />

      {/* ── modal detalle carrera ── */}
      {carreraActiva && !mostrarVerificacion && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50">
          <div
            className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
            style={{ animation: 'slideUp 0.3s ease forwards' }}
          >
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-black text-gray-900">Detalle de carrera</h3>
              <button
                type="button"
                onClick={() => setCarreraActiva(null)}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* restaurante */}
              <div className="bg-blue-50 rounded-2xl p-4">
                <p className="text-xs font-semibold text-blue-500 mb-1">RECOGER EN</p>
                <p className="font-bold text-gray-900">{carreraActiva.restaurante}</p>
                <p className="text-sm text-gray-500 mt-0.5">{carreraActiva.restauranteDireccion}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(carreraActiva.restauranteDireccion + ', Piñas, Ecuador')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-blue-600"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Abrir en Maps
                </a>
              </div>

              {/* cliente */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 mb-1">ENTREGAR A</p>
                <p className="font-bold text-gray-900">{carreraActiva.clienteNombre}</p>
                <p className="text-sm text-gray-500 mt-0.5">{carreraActiva.clienteDireccion}</p>
                <div className="flex items-center gap-3 mt-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(carreraActiva.clienteDireccion + ', Piñas, Ecuador')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Abrir en Maps
                  </a>
                  <a
                    href={`tel:${carreraActiva.clienteTelefono}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Llamar
                  </a>
                </div>
              </div>

              {/* productos */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 mb-2">PRODUCTOS</p>
                <div className="space-y-1">
                  {carreraActiva.items.map((item, i) => (
                    <p key={i} className="text-sm text-gray-700">{item}</p>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                  <span className="text-sm text-gray-500">Total del pedido</span>
                  <span className="font-bold text-gray-900">${carreraActiva.total.toFixed(2)}</span>
                </div>
              </div>

              {/* propina */}
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs text-green-600 font-semibold">Tu ganancia estimada</p>
                    <p className="text-xs text-green-500">Propina + tarifa base</p>
                  </div>
                </div>
                <p className="font-black text-xl text-green-600">
                  +${(carreraActiva.propina + GANANCIA_BASE_POR_CARRERA).toFixed(2)}
                </p>
              </div>

              {/* botones de acción */}
              {carreraActiva.estado === 'asignada' && (
                <button
                  type="button"
                  disabled={!!avanzandoKey}
                  onClick={() => {
                    avanzarEstado(carreraActiva.id, 'en_camino', carreraActiva.batchId ?? undefined);
                    setCarreraActiva({ ...carreraActiva, estado: 'en_camino' });
                  }}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-base flex items-center justify-center gap-2 transition-colors"
                >
                  <Bike className="w-5 h-5" />
                  Estoy en camino
                </button>
              )}
              {carreraActiva.estado === 'en_camino' && (
                <button
                  type="button"
                  onClick={() => setMostrarVerificacion(true)}
                  className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-base flex items-center justify-center gap-2 transition-colors"
                >
                  <KeyRound className="w-5 h-5" />
                  Ingresar código de entrega
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── modal verificación ── */}
      {mostrarVerificacion && carreraActiva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl"
            style={{ animation: 'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          >
            {codigoOk ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-9 h-9 text-green-500" />
                </div>
                <h3 className="font-black text-xl text-gray-900 mb-1">¡Código correcto!</h3>
                <p className="text-sm text-gray-500">Marcando como entregado...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-gray-900">Código de entrega</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarVerificacion(false);
                      setCodigoIngresado('');
                      setErrorCodigo(false);
                    }}
                    className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-2xl p-3 mb-5">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700">
                    Pídele al cliente que te muestre el código de 6 dígitos desde su aplicación.
                  </p>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={codigoIngresado}
                  onChange={(e) => {
                    setCodigoIngresado(e.target.value.replace(/\D/g, ''));
                    setErrorCodigo(false);
                  }}
                  placeholder="000000"
                  className={`w-full text-center font-black text-3xl tracking-[0.4em] py-4 rounded-2xl border-2 mb-2 outline-none transition-colors font-mono ${
                    errorCodigo
                      ? 'border-red-400 bg-red-50 text-red-600'
                      : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-blue-400'
                  }`}
                />
                {errorCodigo && (
                  <p className="text-xs text-red-500 text-center mb-3 font-semibold">
                    Código incorrecto. Inténtalo de nuevo.
                  </p>
                )}

                <button
                  type="button"
                  onClick={verificarCodigo}
                  disabled={codigoIngresado.length !== 6}
                  className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-base transition-colors mt-2"
                >
                  Confirmar entrega
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl"
          style={{ animation: 'fadeSlideIn 0.3s ease forwards' }}
        >
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
}

/* ─────────────── tarjeta de carrera ─────────────── */
function TarjetaCarreraBatch({
  carreras,
  avanzandoKey = null,
  onVerDetalle,
  onEnCamino,
  onVerificar,
}: {
  carreras: CarreraRider[];
  avanzandoKey?: string | null;
  onVerDetalle: () => void;
  onEnCamino: () => void;
  onVerificar: () => void;
}) {
  const leader = carreras[0];
  const esAsignada = leader.estado === 'asignada';
  const esEnCamino = leader.estado === 'en_camino';
  const totalGanancia = carreras.reduce((s, c) => s + (c.propina ?? 0), 0) + carreras.length * 1.5;

  return (
    <div
      className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100"
      style={{ animation: 'fadeSlideIn2 0.4s ease forwards' }}
    >
      <div
        className={`px-5 py-2 flex items-center gap-2 text-xs font-bold ${
          esEnCamino
            ? 'bg-blue-600 text-white'
            : 'bg-dorado-oro/10 text-dorado-oro border-b border-dorado-oro/15'
        }`}
      >
        {esEnCamino ? (
          <>
            <Bike className="w-3.5 h-3.5" />
            EN CAMINO · Multi-parada
          </>
        ) : (
          <>
            <Clock className="w-3.5 h-3.5" />
            NUEVA CARRERA · {carreras.length} paradas · {leader.hora}
          </>
        )}
      </div>
      <div className="p-5">
        <div className="flex flex-col gap-2 mb-4">
          {carreras.map((c, i) => (
            <div key={c.id} className="flex items-start gap-2">
              <span className="text-xs font-bold text-gray-400 w-16 flex-shrink-0">
                Parada {i + 1}
              </span>
              <div>
                <p className="font-semibold text-sm text-gray-900">{c.restaurante}</p>
                <p className="text-xs text-gray-500 truncate">{c.restauranteDireccion}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-2 pt-1 border-t border-gray-100">
            <span className="text-xs font-bold text-rojo-andino w-16 flex-shrink-0">Destino</span>
            <div>
              <p className="font-semibold text-sm text-gray-900">{leader.clienteNombre}</p>
              <p className="text-xs text-gray-500 truncate">{leader.clienteDireccion}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((leader.clienteDireccion || '') + ', Piñas, Ecuador')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-blue-600"
              >
                <Navigation className="w-3 h-3" />
                Ver en mapa
              </a>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400">Ganancia estimada</p>
          <p className="font-black text-green-600">+${totalGanancia.toFixed(2)}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onVerDetalle}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
          >
            Ver detalle
            <ChevronRight className="w-4 h-4" />
          </button>
          {esAsignada && (
            <button
              type="button"
              disabled={!!avanzandoKey}
              onClick={onEnCamino}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <Bike className="w-4 h-4" />
              En camino
            </button>
          )}
          {esEnCamino && (
            <button
              type="button"
              onClick={onVerificar}
              className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-4 h-4" />
              Entregar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaCarrera({
  carrera,
  avanzandoKey = null,
  onVerDetalle,
  onEnCamino,
  onVerificar,
}: {
  carrera: CarreraRider;
  avanzandoKey?: string | null;
  onVerDetalle: () => void;
  onEnCamino: () => void;
  onVerificar: () => void;
}) {
  const esAsignada = carrera.estado === 'asignada';
  const esEnCamino = carrera.estado === 'en_camino';

  return (
    <div
      className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100"
      style={{ animation: 'fadeSlideIn2 0.4s ease forwards' }}
    >
      {/* badge estado */}
      <div
        className={`px-5 py-2 flex items-center gap-2 text-xs font-bold ${
          esEnCamino
            ? 'bg-blue-600 text-white'
            : 'bg-dorado-oro/10 text-dorado-oro border-b border-dorado-oro/15'
        }`}
      >
        {esEnCamino ? (
          <>
            <Bike className="w-3.5 h-3.5" />
            EN CAMINO
          </>
        ) : (
          <>
            <Clock className="w-3.5 h-3.5" />
            NUEVA CARRERA · {carrera.hora}
          </>
        )}
        <span className="ml-auto flex items-center gap-1 opacity-70">
          <MapPin className="w-3 h-3" />
          {carrera.distancia}
        </span>
      </div>

      <div className="p-5">
        {/* ruta */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex flex-col items-center gap-1 mt-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <div className="w-0.5 h-6 bg-gray-200" />
            <div className="w-3 h-3 rounded-full bg-rojo-andino" />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <p className="text-xs text-gray-400">Recoger en</p>
              <p className="font-bold text-sm text-gray-900 leading-tight">{carrera.restaurante}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Entregar a</p>
              <p className="font-bold text-sm text-gray-900 leading-tight">{carrera.clienteNombre}</p>
              <p className="text-xs text-gray-500 truncate">{carrera.clienteDireccion}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((carrera.clienteDireccion || '') + ', Piñas, Ecuador')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <Navigation className="w-3 h-3" />
                Ver en mapa
              </a>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Ganancia</p>
            <p className="font-black text-green-600">+${(carrera.propina + 1.5).toFixed(2)}</p>
          </div>
        </div>

        {/* botones */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onVerDetalle}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
          >
            Ver detalle
            <ChevronRight className="w-4 h-4" />
          </button>
          {esAsignada && (
            <button
              type="button"
              disabled={!!avanzandoKey}
              onClick={onEnCamino}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <Bike className="w-4 h-4" />
              En camino
            </button>
          )}
          {esEnCamino && (
            <button
              type="button"
              onClick={onVerificar}
              className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-4 h-4" />
              Entregar
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn2 {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
