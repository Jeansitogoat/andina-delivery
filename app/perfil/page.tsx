'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import {
  ArrowLeft, Camera, LogOut, ChevronRight, ShoppingBag,
  History, Settings, Phone, Check, AlertTriangle, Bell,
} from 'lucide-react';
import TarjetaPedidoHistorial, {
  type PedidoHistorial,
} from '@/components/usuario/TarjetaPedidoHistorial';
import SeccionDirecciones from '@/components/usuario/SeccionDirecciones';
import SkeletonHistorial from '@/components/SkeletonHistorial';
import { useCart } from '@/lib/useCart';
import { useAddresses } from '@/lib/addressesContext';
import { useAuth } from '@/lib/useAuth';
import { useNotifications } from '@/lib/useNotifications';
import { ensureFCMServiceWorkerReady } from '@/lib/fcm-client';
import { getIdToken } from '@/lib/authToken';
import { getFirebaseStorage, getFirestoreDb } from '@/lib/firebase/client';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { compressImage } from '@/lib/compressImage';
import { getSafeImageSrc } from '@/lib/validImageUrl';
import { useToast } from '@/lib/ToastContext';

type TabPerfil = 'historial' | 'direcciones' | 'cuenta';

function formatFecha(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const hoy = now.toDateString() === d.toDateString();
  const ayer = new Date(now);
  ayer.setDate(ayer.getDate() - 1);
  const fueAyer = ayer.toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  if (hoy) return `Hoy · ${time}`;
  if (fueAyer) return `Ayer · ${time}`;
  const day = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
  return `${day} · ${time}`;
}

function mapEstadoToHistorial(estado: string): PedidoHistorial['estado'] {
  if (estado === 'entregado') return 'entregado';
  if (estado === 'en_camino' || estado === 'asignado') return 'en_camino';
  if (estado === 'cancelado') return 'cancelado';
  return 'preparando';
}

function primerNombreParaMostrar(displayName?: string | null, email?: string | null): string {
  const dn = (displayName ?? '').trim();
  if (dn) return dn.split(/\s+/)[0] || dn;
  if (email) return email.split('@')[0] || 'Usuario';
  return 'Usuario';
}

export default function PerfilPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser, logout } = useAuth();
  const { clearCart, replaceCartAndSave } = useCart();
  const { direcciones, updateDirecciones } = useAddresses();
  const { permission, requestPermission, reintentarRegistro, desactivar, loading: notifLoading, error: notifError, isSupported, optedOut } = useNotifications('user');
  const { showToast } = useToast();
  const fotoRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabPerfil>('historial');
  const [pageVisible, setPageVisible] = useState(false);
  const [historial, setHistorial] = useState<PedidoHistorial[]>([]);
  const [historialLoading, setHistorialLoading] = useState(true);
  const [fotoPreview, setFotoPreview] = useState('');
  const [nombre, setNombre] = useState('');
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [editandoTelefono, setEditandoTelefono] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [confirmarDesactivarNotif, setConfirmarDesactivarNotif] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [tokenRegistrado, setTokenRegistrado] = useState<boolean | null>(null);
  const [reintentandoNotif, setReintentandoNotif] = useState(false);
  const [refreshNotifStatus, setRefreshNotifStatus] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    ensureFCMServiceWorkerReady();
  }, []);

  // Ver si el usuario tiene token FCM registrado (para mostrar "Token registrado" en notificaciones)
  useEffect(() => {
    if (!user || permission !== 'granted' || optedOut) {
      setTokenRegistrado(null);
      return;
    }
    let cancelled = false;
    getIdToken()
      .then((token) => {
        if (!token || cancelled) return;
        return fetch('/api/fcm/status', { headers: { Authorization: `Bearer ${token}` } });
      })
      .then((res) => {
        if (!res || cancelled) return res?.json?.();
        return res.json();
      })
      .then((data: { hasToken?: boolean } | undefined) => {
        if (!cancelled && data && typeof data.hasToken === 'boolean') setTokenRegistrado(data.hasToken);
      })
      .catch(() => { if (!cancelled) setTokenRegistrado(false); });
    return () => { cancelled = true; };
  }, [user, permission, optedOut, notifLoading, refreshNotifStatus]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) {
      setNombre('');
      setTelefono('');
      setHistorial([]);
      setHistorialLoading(false);
      return;
    }
    setNombre(user.displayName ?? user.email ?? '');
    setTelefono(user.telefono ?? '');
  }, [user]);

  const nombreParaMostrar = primerNombreParaMostrar(user?.displayName, user?.email);

  useEffect(() => {
    if (!user || user.rol !== 'cliente') {
      setHistorialLoading(false);
      return;
    }
    let cancelled = false;
    getIdToken()
      .then((token) => {
        if (!token || cancelled) return null;
        return fetch('/api/mis-pedidos', { headers: { Authorization: `Bearer ${token}` } });
      })
      .then((res) => {
        if (res == null) return { pedidos: [] };
        return res.ok ? res.json() : { pedidos: [] };
      })
      .then((data: { pedidos?: Array<{ id: string; restaurante: string; items: string[]; total: number; timestamp: number; estado: string; localId?: string; itemsCart?: { localId: string; items: { id: string; qty: number; note?: string }[] } }> }) => {
        if (cancelled) return;
        const list: PedidoHistorial[] = (data.pedidos || []).map((p) => ({
          id: `#${p.id}`,
          orderId: p.id,
          fecha: formatFecha(p.timestamp || 0),
          restaurante: p.restaurante || '—',
          logoRestaurante: p.localId ? `/logos/${p.localId}.png` : '',
          localId: p.localId ?? null,
          items: p.items || [],
          total: p.total || 0,
          estado: mapEstadoToHistorial(p.estado || 'confirmado'),
          tiempo: '—',
          ...(p.itemsCart && p.itemsCart.localId && Array.isArray(p.itemsCart.items) ? { itemsCart: p.itemsCart } : {}),
        }));
        setHistorial(list);
      })
      .catch(() => { if (!cancelled) setHistorial([]); })
      .finally(() => { if (!cancelled) setHistorialLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    setSubiendoFoto(true);
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, `users/${user.uid}/avatar`);
    const compressed = await compressImage(file, 'avatar');
    uploadBytes(storageRef, compressed)
      .then(() => getDownloadURL(storageRef))
      .then(async (url) => {
        const db = getFirestoreDb();
        await setDoc(doc(db, 'users', user.uid), { photoURL: url, updatedAt: serverTimestamp() }, { merge: true });
        const auth = getFirebaseAuth();
        if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL: url });
      })
      .catch(() => showToast({ type: 'error', message: 'No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.' }))
      .finally(() => setSubiendoFoto(false));
  }

  function guardarCambios() {
    setEditandoNombre(false);
    setEditandoTelefono(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
    if (!user?.uid) return;
    const nombreTrim = nombre.trim();
    const telefonoTrim = telefono.trim() || null;
    const db = getFirestoreDb();
    const auth = getFirebaseAuth();
    setDoc(doc(db, 'users', user.uid), {
      displayName: nombreTrim || null,
      telefono: telefonoTrim,
      updatedAt: serverTimestamp(),
    }, { merge: true })
      .then(() => {
        if (auth.currentUser && nombreTrim) {
          return updateProfile(auth.currentUser, { displayName: nombreTrim });
        }
      })
      .then(() => refreshUser?.())
      .catch(() => showToast({ type: 'error', message: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.' }));
  }

  function cerrarSesion() {
    setConfirmarCierre(false);
    logout().then(() => {
      clearCart();
      router.replace('/auth');
    });
  }

  async function volverAPedir(pedido: PedidoHistorial) {
    if (pedido.itemsCart?.localId && Array.isArray(pedido.itemsCart.items) && pedido.itemsCart.items.length > 0) {
      await replaceCartAndSave([{ localId: pedido.itemsCart.localId, items: pedido.itemsCart.items }]);
      router.push('/carrito');
    } else {
      // Pedidos antiguos sin itemsCart: ir al menú del local si tenemos localId
      const localId = pedido.localId || (pedido.logoRestaurante ? pedido.logoRestaurante.replace(/^\/logos\/|\.png$/g, '').trim() : null);
      if (localId) {
        router.push(`/restaurante/${localId}`);
      } else {
        router.push('/');
      }
    }
  }

  const pedidosEntregados = historial.filter((p) => p.estado === 'entregado').length;

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }
  if (!user) {
    return null;
  }

  return (
    <main
      className={`min-h-screen bg-gray-50 pb-8 transition-all duration-300 ${
        pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* Header */}
      <div className="bg-rojo-andino text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg flex-1">Mi perfil</h1>
          <button
            type="button"
            onClick={guardarCambios}
            className="flex items-center gap-1.5 bg-white text-rojo-andino font-bold text-sm px-4 py-2 rounded-2xl shadow-md hover:bg-gray-50 transition-colors"
          >
            {guardado && <Check className="w-4 h-4 text-green-500" />}
            {guardado ? 'Guardado' : 'Guardar'}
          </button>
        </div>

        {/* Avatar + info */}
        <div className="max-w-2xl mx-auto px-4 pb-6 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/20 border-4 border-white/30 shadow-xl relative">
              {fotoPreview ? (
                <Image src={fotoPreview} alt={nombreParaMostrar} fill className="object-cover" sizes="80px" />
              ) : getSafeImageSrc(user?.photoURL) ? (
                <Image
                  src={getSafeImageSrc(user?.photoURL)!}
                  alt={nombreParaMostrar}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/10">
                  <span className="font-black text-2xl text-white">{nombreParaMostrar ? nombreParaMostrar[0] : '?'}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fotoRef.current?.click()}
              disabled={subiendoFoto}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-70"
            >
              {subiendoFoto ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-rojo-andino border-t-transparent animate-spin block" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-rojo-andino" />
              )}
            </button>
            <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
          </div>

          <div className="flex-1 min-w-0">
            {editandoNombre ? (
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onBlur={() => setEditandoNombre(false)}
                autoFocus
                className="font-black text-xl text-white bg-transparent border-b-2 border-white/50 focus:outline-none w-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditandoNombre(true)}
                className="font-black text-xl text-white hover:text-white/80 transition-colors text-left flex items-center gap-2"
              >
                {nombreParaMostrar}
                <Camera className="w-3.5 h-3.5 opacity-60 hidden" />
              </button>
            )}
            <p className="text-white/70 text-sm mt-0.5">{telefono}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-white/70">
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" />
                {historial.length} pedidos
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                {pedidosEntregados} entregados
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto flex border-b border-white/20">
          {([
            { key: 'historial', label: 'Historial', icon: History },
            { key: 'direcciones', label: 'Direcciones', icon: Settings },
            { key: 'cuenta', label: 'Cuenta', icon: Settings },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === key
                  ? 'border-white text-white'
                  : 'border-transparent text-white/60 hover:text-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* === TAB: HISTORIAL === */}
        {tab === 'historial' && (
          <>
            {historialLoading ? (
              <SkeletonHistorial />
            ) : historial.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Aún no tienes pedidos</p>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="mt-3 text-rojo-andino font-semibold text-sm hover:underline"
                >
                  Explorar restaurantes
                </button>
              </div>
            ) : (
              historial.map((pedido) => (
                <TarjetaPedidoHistorial
                  key={pedido.id}
                  pedido={pedido}
                  onVolverAPedir={volverAPedir}
                />
              ))
            )}
          </>
        )}

        {/* === TAB: DIRECCIONES === */}
        {tab === 'direcciones' && (
            <SeccionDirecciones
              direcciones={direcciones}
              onActualizar={updateDirecciones}
            />
        )}

        {/* === TAB: CUENTA === */}
        {tab === 'cuenta' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">
                  Información personal
                </p>
              </div>
              <div className="px-4 divide-y divide-gray-50">
                {/* Nombre */}
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Nombre</p>
                    {editandoNombre ? (
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        onBlur={() => setEditandoNombre(false)}
                        autoFocus
                        className="text-sm font-semibold text-gray-900 bg-transparent border-b-2 border-rojo-andino focus:outline-none w-full"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-gray-900">{nombre}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditandoNombre((v) => !v)}
                    className="text-xs text-rojo-andino font-semibold hover:underline ml-3 flex-shrink-0"
                  >
                    {editandoNombre ? 'Listo' : 'Editar'}
                  </button>
                </div>

                {/* Teléfono */}
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Teléfono</p>
                    {editandoTelefono ? (
                      <input
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        onBlur={() => setEditandoTelefono(false)}
                        autoFocus
                        className="text-sm font-semibold text-gray-900 bg-transparent border-b-2 border-rojo-andino focus:outline-none w-full"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {telefono || '—'}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditandoTelefono((v) => !v)}
                    className="text-xs text-rojo-andino font-semibold hover:underline ml-3 flex-shrink-0"
                  >
                    {editandoTelefono ? 'Listo' : 'Editar'}
                  </button>
                </div>

                {/* Email (solo lectura por ahora) */}
                <div className="py-3.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Correo</p>
                  <p className="text-sm font-semibold text-gray-900">{user?.email ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Vinculado con Google · No editable aquí</p>
                </div>
              </div>
            </div>

            {/* Opciones extra */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-4 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-gray-500" />
                  Notificaciones
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {permission === 'granted' && !optedOut
                    ? tokenRegistrado === true
                      ? 'Activadas · Token registrado (recibirás avisos de pedidos)'
                      : tokenRegistrado === false
                        ? 'Activadas · No se pudo completar el registro.'
                        : 'Activadas · Te avisamos del estado de tus pedidos'
                    : notifError
                      ? notifError
                      : notifLoading
                        ? 'Activando...'
                        : optedOut
                          ? 'Desactivadas · Tocá abajo para volver a activar'
                          : 'Tocá abajo para activar avisos de pedidos'}
                </p>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  {permission === 'granted' && !optedOut ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmarDesactivarNotif(true)}
                        className="text-xs font-semibold text-red-500 hover:underline"
                      >
                        Desactivar
                      </button>
                      {tokenRegistrado === false && (
                        <button
                          type="button"
                          onClick={async () => {
                            setReintentandoNotif(true);
                            const ok = await reintentarRegistro();
                            setRefreshNotifStatus((n) => n + 1);
                            setReintentandoNotif(false);
                          }}
                          disabled={reintentandoNotif}
                          className="text-sm font-semibold text-rojo-andino hover:underline disabled:opacity-70"
                        >
                          {reintentandoNotif ? 'Reintentando…' : 'Reintentar'}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => isSupported && requestPermission()}
                      disabled={!isSupported || notifLoading}
                      className="text-sm font-semibold text-rojo-andino hover:underline disabled:opacity-70 flex items-center gap-2"
                    >
                      {notifLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-rojo-andino border-t-transparent animate-spin block flex-shrink-0" />
                          Activando…
                        </>
                      ) : (
                        'Activar notificaciones'
                      )}
                    </button>
                  )}
                </div>
                </div>
              {[
                { label: 'Términos y condiciones', sub: 'Política de uso', onClick: () => router.push('/terminos') },
                { label: 'Política de privacidad', sub: 'Cómo usamos tus datos', onClick: () => router.push('/privacidad') },
              ].map(({ label, sub, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Cerrar sesión */}
            <button
              type="button"
              onClick={() => setConfirmarCierre(true)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-red-200 text-red-500 hover:bg-red-50 font-bold text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Modal confirmar desactivar notificaciones */}
      {confirmarDesactivarNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5">
          <div
            className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center"
            style={{ animation: 'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          >
            <h3 className="font-black text-lg text-gray-900 mb-1">¿Desactivar notificaciones?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Dejarás de recibir avisos del estado de tus pedidos en este dispositivo.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmarDesactivarNotif(false)}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                No
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmarDesactivarNotif(false);
                  await desactivar();
                }}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
              >
                Sí, desactivar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar cierre de sesión */}
      {confirmarCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5">
          <div
            className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center"
            style={{ animation: 'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          >
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="font-black text-lg text-gray-900 mb-1">¿Cerrar sesión?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tendrás que volver a iniciar sesión para acceder a tu cuenta y pedidos.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmarCierre(false)}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={cerrarSesion}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
              >
                Sí, cerrar sesión
              </button>
            </div>
          </div>
          <style>{`
            @keyframes scaleIn {
              from { opacity: 0; transform: scale(0.85); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}

      {/* Toast */}
      {guardado && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" />
          Cambios guardados
        </div>
      )}
    </main>
  );
}
