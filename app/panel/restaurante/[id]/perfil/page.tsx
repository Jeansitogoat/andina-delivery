'use client';

import { use, useState, useEffect, useRef } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Store,
  MapPin,
  Phone,
  Clock,
  Camera,
  Check,
  CreditCard,
  FileText,
  Upload,
  Lock,
  Loader2,
  Tag,
} from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import NavPanel from '@/components/panel/NavPanel';
import PasswordInput from '@/components/PasswordInput';
import { getIdToken } from '@/lib/authToken';
import { getFirebaseAuth, getFirebaseStorage } from '@/lib/firebase/client';
import {
  hasEmailPasswordProvider,
  validatePasswordChangeFields,
  mapFirebasePasswordError,
} from '@/lib/passwordChangeHelpers';
import { useNotifications } from '@/lib/useNotifications';
import { getFCMTokenWithRetry } from '@/lib/fcm-client';
import type { Local } from '@/lib/data';
import { compressImage } from '@/lib/compressImage';
import { getSafeImageSrc, normalizeDataUrl, shouldBypassImageOptimizer } from '@/lib/validImageUrl';
import { uploadLocalQr } from '@/lib/storageUpload';
import CampoUbicacionConMapa from '@/components/CampoUbicacionConMapa';
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_CATEGORY_SET,
  mapLegacyTypeToDiscoveryCategory,
} from '@/lib/discovery-categorias';



const HORARIOS_DEFAULT = [
  { dia: 'Lunes', abierto: true, desde: '09:00', hasta: '22:00' },
  { dia: 'Martes', abierto: true, desde: '09:00', hasta: '22:00' },
  { dia: 'Miércoles', abierto: true, desde: '09:00', hasta: '22:00' },
  { dia: 'Jueves', abierto: true, desde: '09:00', hasta: '22:00' },
  { dia: 'Viernes', abierto: true, desde: '09:00', hasta: '23:00' },
  { dia: 'Sábado', abierto: true, desde: '10:00', hasta: '23:00' },
  { dia: 'Domingo', abierto: false, desde: '10:00', hasta: '22:00' },
];

export default function PanelPerfilIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  const [local, setLocal] = useState<Local | null>(null);
  const [pageVisible, setPageVisible] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [telefono, setTelefono] = useState('');
  const [tiempoEntrega, setTiempoEntrega] = useState('');
  const [logo, setLogo] = useState('');
  const [cover, setCover] = useState('');
  const [horarios, setHorarios] = useState(HORARIOS_DEFAULT);
  const [guardado, setGuardado] = useState(false);
  const [guardadoError, setGuardadoError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [cooperativa, setCooperativa] = useState('');
  const [titular, setTitular] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('');
  const [qrEnabled, setQrEnabled] = useState(false);
  const [codigoUrl, setCodigoUrl] = useState('');
  // Legacy: mantenemos codigoBase64 solo para mostrar datos existentes cargados de Firestore
  const [codigoBase64Legacy, setCodigoBase64Legacy] = useState('');
  const [codigoMimeType, setCodigoMimeType] = useState('');
  const [codigoFileName, setCodigoFileName] = useState('');
  const [codigoUploading, setCodigoUploading] = useState(false);
  const [ivaEnabled, setIvaEnabled] = useState(false);
  const [ivaRate, setIvaRate] = useState('15');

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordNuevaConfirm, setPasswordNuevaConfirm] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [mensajePassword, setMensajePassword] = useState<{ tipo: 'ok' | 'error'; text: string } | null>(null);
  const [categoriasDiscovery, setCategoriasDiscovery] = useState<string[]>(['cafes']);
  const [fbUserState, setFbUserState] = useState<FirebaseUser | null>(null);
  const { permission: notifPermission, requestPermission, reintentarRegistro, loading: notifLoading } = useNotifications('local', { localId: id });
  const [tokenActivo, setTokenActivo] = useState<boolean | null>(null);
  const [syncingDevice, setSyncingDevice] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    setFbUserState(auth.currentUser);
    return auth.onAuthStateChanged((u) => setFbUserState(u));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/locales/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: { local: Local } | null) => {
        if (!cancelled && data?.local) {
          const loc = data.local;
          setLocal(loc);
          setNombre(loc.name);
          setDireccion(loc.address ?? '');
          setLat(loc.lat ?? null);
          setLng(loc.lng ?? null);
          setLogo(loc.logo ?? '');
          setCover(loc.cover ?? '');
          setTelefono(loc.telefono ?? '');
          setTiempoEntrega(loc.time ?? '');
          if (loc.horarios?.length) setHorarios(loc.horarios);
          if (loc.transferencia) {
            setNumeroCuenta(loc.transferencia.numeroCuenta ?? '');
            setCooperativa(loc.transferencia.cooperativa ?? '');
            setTitular(loc.transferencia.titular ?? '');
            setTipoCuenta(loc.transferencia.tipoCuenta ?? '');
            setQrEnabled(loc.transferencia.qrEnabled === true);
            // Fase 1: preferir codigoUrl; fallback a codigoBase64 legacy
            if (loc.transferencia.codigoUrl) {
              setCodigoUrl(loc.transferencia.codigoUrl);
              setCodigoFileName('Código subido');
            } else if (loc.transferencia.codigoBase64) {
              setCodigoBase64Legacy(loc.transferencia.codigoBase64);
              setCodigoMimeType(loc.transferencia.codigoMimeType ?? '');
              setCodigoFileName('Código subido (legacy)');
            }
          }
          setIvaEnabled(loc.ivaEnabled === true);
          if (typeof loc.ivaRate === 'number' && !Number.isNaN(loc.ivaRate) && loc.ivaRate > 0) {
            setIvaRate(String(loc.ivaRate > 1 ? loc.ivaRate : loc.ivaRate * 100));
          }
          const rawCats =
            Array.isArray(loc.categorias) && loc.categorias.length > 0
              ? loc.categorias
              : Array.isArray(loc.type)
                ? loc.type
                    .map((t) => mapLegacyTypeToDiscoveryCategory(t))
                    .filter((v): v is NonNullable<typeof v> => v !== null)
                : [];
          const picked = rawCats.filter((x) => DISCOVERY_CATEGORY_SET.has(x));
          setCategoriasDiscovery(picked.length > 0 ? picked : ['cafes']);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id || notifPermission !== 'granted') {
      setTokenActivo(null);
      return;
    }
    let cancelled = false;
    const loadStatus = async () => {
      const tok = await getIdToken();
      if (!tok || cancelled) return;
      const stored =
        typeof window !== 'undefined' ? localStorage.getItem('andina_fcm_token_local') ?? '' : '';
      const res = await fetch('/api/fcm/status?role=local', {
        headers: {
          Authorization: `Bearer ${tok}`,
          ...(stored ? { 'x-fcm-token': stored } : {}),
        },
      }).catch(() => null);
      if (!res || !res.ok || cancelled) {
        if (!cancelled) setTokenActivo(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { hasCurrentToken?: boolean };
      if (!cancelled) setTokenActivo(Boolean(data.hasCurrentToken));
    };
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [id, notifPermission, notifLoading]);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setLogoUploading(true);
    try {
      const compressed = await compressImage(file, 'logo');
      const storage = getFirebaseStorage();
      const path = `locales/${id}/logo`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressed);
      const url = await getDownloadURL(storageRef);
      setLogo(url);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setLogo(dataUrl.startsWith('data:') ? normalizeDataUrl(dataUrl) : dataUrl);
      };
      reader.readAsDataURL(await compressImage(file, 'logo'));
    } finally {
      setLogoUploading(false);
    }
    e.target.value = '';
  }

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setCoverUploading(true);
    try {
      const compressed = await compressImage(file, 'cover');
      const storage = getFirebaseStorage();
      const path = `locales/${id}/cover`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressed);
      const url = await getDownloadURL(storageRef);
      setCover(url);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setCover(dataUrl.startsWith('data:') ? normalizeDataUrl(dataUrl) : dataUrl);
      };
      reader.readAsDataURL(await compressImage(file, 'cover'));
    } finally {
      setCoverUploading(false);
    }
    e.target.value = '';
  }

  async function handleCodigoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setCodigoUploading(true);
    try {
      // Fase 1: subir QR directamente a Firebase Storage
      const url = await uploadLocalQr(id, file);
      setCodigoUrl(url);
      setCodigoBase64Legacy('');
      setCodigoMimeType(file.type);
      setCodigoFileName(file.name);
    } catch {
      // Fallback legacy: si falla el upload, usar Base64
      const reader = new FileReader();
      reader.onload = () => {
        setCodigoBase64Legacy(reader.result as string);
        setCodigoMimeType(file.type);
        setCodigoFileName(file.name);
      };
      reader.readAsDataURL(file);
    } finally {
      setCodigoUploading(false);
    }
    e.target.value = '';
  }

  async function guardar() {
    if (!id) return;

    const transferenciaPayload =
      numeroCuenta.trim() || cooperativa.trim() || qrEnabled
        ? {
            numeroCuenta: numeroCuenta.trim(),
            cooperativa: cooperativa.trim(),
            titular: titular.trim() || undefined,
            tipoCuenta: tipoCuenta.trim() || undefined,
            qrEnabled,
            // Fase 1: preferir codigoUrl (Storage); mantener codigoBase64 legacy si no hay URL
            codigoUrl: qrEnabled ? (codigoUrl || undefined) : undefined,
            codigoBase64: qrEnabled && !codigoUrl ? (codigoBase64Legacy || undefined) : undefined,
            codigoMimeType: qrEnabled ? (codigoMimeType || undefined) : undefined,
          }
        : null;

    const logoPayload = logo
      ? (logo.startsWith('data:') ? normalizeDataUrl(logo) : logo)
      : undefined;
    const coverPayload = cover
      ? (cover.startsWith('data:') ? normalizeDataUrl(cover) : cover)
      : undefined;

    setGuardadoError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/locales/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: nombre.trim() || undefined,
          address: direccion.trim() || undefined,
          lat: lat != null ? lat : undefined,
          lng: lng != null ? lng : undefined,
          telefono: telefono.trim() || undefined,
          time: tiempoEntrega.trim() || undefined,
          logo: logoPayload,
          cover: coverPayload,
          horarios,
          transferencia: transferenciaPayload,
          ...(local?.ivaPermitidoMaestro
            ? {
                ivaEnabled,
                ivaRate: ivaEnabled ? Number(ivaRate) || 15 : 0,
              }
            : {}),
          categorias: categoriasDiscovery,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGuardadoError(typeof data?.error === 'string' ? data.error : 'No se pudo guardar. Revisa tu conexión o usa imágenes más pequeñas.');
        return;
      }
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
      router.refresh();
    } catch {
      setGuardadoError('Error de conexión. Revisa tu internet o intenta con imágenes más pequeñas.');
    }
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

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setMensajePassword(null);
    const v = validatePasswordChangeFields({
      passwordActual,
      passwordNueva,
      passwordNuevaConfirm,
    });
    if (!v.ok) {
      setMensajePassword({ tipo: 'error', text: v.message });
      return;
    }
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user?.email) {
      setMensajePassword({ tipo: 'error', text: 'Solo puedes cambiar la contraseña si iniciaste sesión con correo.' });
      return;
    }
    setCambiandoPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, passwordActual);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordNueva);
      setMensajePassword({ tipo: 'ok', text: 'Contraseña actualizada.' });
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordNuevaConfirm('');
    } catch (err: unknown) {
      setMensajePassword({ tipo: 'error', text: mapFirebasePasswordError(err) });
    } finally {
      setCambiandoPassword(false);
    }
  }

  const showPasswordFormRestaurante = hasEmailPasswordProvider(fbUserState);
  const showGoogleMessageRestaurante = fbUserState && !showPasswordFormRestaurante;

  async function syncCurrentDevice() {
    setSyncingDevice(true);
    try {
      if (notifPermission !== 'granted') {
        await requestPermission();
      } else {
        await reintentarRegistro();
      }
      const token = await getFCMTokenWithRetry({ maxAttempts: 3, delayMs: 1500 });
      if (token && typeof window !== 'undefined') {
        localStorage.setItem('andina_fcm_token_local', token);
      }
      const tok = await getIdToken();
      if (tok) {
        const res = await fetch('/api/fcm/status?role=local', {
          headers: {
            Authorization: `Bearer ${tok}`,
            ...(token ? { 'x-fcm-token': token } : {}),
          },
        }).catch(() => null);
        const data = res && res.ok ? ((await res.json().catch(() => ({}))) as { hasCurrentToken?: boolean }) : null;
        setTokenActivo(Boolean(data?.hasCurrentToken));
      }
    } finally {
      setSyncingDevice(false);
    }
  }

  if (!local) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </main>
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
          {guardadoError && (
            <div className="mt-3 px-4 py-2 rounded-xl bg-white/20 text-white text-sm">
              {guardadoError}
            </div>
          )}
        </header>

        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Portada */}
          <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="relative h-36 bg-gray-200">
              {getSafeImageSrc(cover) ? (
                <Image
                  src={getSafeImageSrc(cover)!}
                  alt="Portada"
                  fill
                  className="object-cover"
                  sizes="100vw"
                  unoptimized={shouldBypassImageOptimizer(cover)}
                />
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
                disabled={coverUploading}
                className="absolute bottom-2 right-2 p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 disabled:opacity-70"
              >
                {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>
            <div className="p-4 flex items-end gap-4 -mt-10">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-white flex-shrink-0">
                {getSafeImageSrc(logo) ? (
                  <Image
                    src={getSafeImageSrc(logo)!}
                    alt={nombre}
                    fill
                    className="object-contain"
                    sizes="80px"
                    unoptimized={shouldBypassImageOptimizer(logo)}
                  />
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
                  disabled={logoUploading}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity disabled:opacity-70"
                >
                  {logoUploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
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
            {lat == null && lng == null && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 font-medium">
                  Configura tu ubicación exacta en el mapa para que los riders lleguen sin errores.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Dirección del negocio</span>
            </div>
            <CampoUbicacionConMapa
              value={direccion}
              onChange={setDireccion}
              onCoordsChange={(newLat, newLng) => {
                setLat(newLat);
                setLng(newLng);
              }}
              initialLat={lat}
              initialLng={lng}
              label=""
              placeholder="Ej. Av. Rocafuerte, Piñas"
            />
          </section>

          {/* Teléfono */}
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

          {/* Categorías discovery (Home) */}
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Tipo de negocio en la app</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Elige en qué pestañas puede aparecer tu local en el inicio. Puedes marcar varias.
            </p>
            <div className="flex flex-wrap gap-2">
              {DISCOVERY_CATEGORIES.map(({ key, label }) => {
                const on = categoriasDiscovery.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setCategoriasDiscovery((prev) => {
                        const next = on ? prev.filter((k) => k !== key) : [...prev, key];
                        return next.length ? next : ['cafes'];
                      });
                    }}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      on
                        ? 'bg-rojo-andino text-white border-rojo-andino'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-rojo-andino/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Tiempo estimado de entrega */}
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Tiempo estimado de entrega</span>
            </div>
            <input
              type="text"
              value={tiempoEntrega}
              onChange={(e) => setTiempoEntrega(e.target.value)}
              placeholder="Ej: 20-30 min"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            />
            <p className="text-xs text-gray-500 mt-1">Lo verán los clientes al elegir tu local.</p>
          </section>

          {/* Horarios de atención */}
          <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 p-4 pb-2">
              <Clock className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Días y horarios de atención</span>
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

          {/* Pago por transferencia */}
          <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 p-4 pb-2">
              <CreditCard className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Datos para pago por transferencia</span>
            </div>
            <p className="text-xs text-gray-500 px-4 pb-3">
              Los clientes verán estos datos al elegir transferencia en el checkout.
            </p>
            <div className="px-4 pb-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Habilitar cobro con Deuna / QR</p>
                
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={qrEnabled}
                  onClick={() => setQrEnabled((prev) => !prev)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${qrEnabled ? 'bg-rojo-andino' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${qrEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cooperativa o banco</label>
                <input
                  type="text"
                  value={cooperativa}
                  onChange={(e) => setCooperativa(e.target.value)}
                  placeholder="Ej. Banco Pichincha, Coop. San José"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Número de cuenta</label>
                <input
                  type="text"
                  value={numeroCuenta}
                  onChange={(e) => setNumeroCuenta(e.target.value)}
                  placeholder="Número de cuenta"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Titular (opcional)</label>
                <input
                  type="text"
                  value={titular}
                  onChange={(e) => setTitular(e.target.value)}
                  placeholder="Nombre del titular"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de cuenta (opcional)</label>
                <input
                  type="text"
                  value={tipoCuenta}
                  onChange={(e) => setTipoCuenta(e.target.value)}
                  placeholder="Ej. Cuenta de ahorros"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                />
              </div>
              {qrEnabled && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Código QR / Deuna (foto o PDF)</label>
                  <p className="text-xs text-gray-500 mb-2">Imagen o PDF para que el cliente escanee o vea al pagar.</p>
                  <input
                    ref={codigoRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleCodigoChange}
                  />
                  <button
                    type="button"
                    onClick={() => codigoRef.current?.click()}
                    disabled={codigoUploading}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-dorado-oro/50 hover:bg-amber-50/30 transition-colors text-sm font-semibold text-gray-700 disabled:opacity-60"
                  >
                    {codigoUploading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Upload className="w-5 h-5 text-gray-500" />}
                    {codigoUploading ? 'Subiendo...' : (codigoFileName || 'Subir imagen o PDF del código')}
                  </button>
                  {(codigoUrl || codigoBase64Legacy) && (
                    <div className="mt-2 flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      {codigoUrl ? (
                        codigoMimeType?.startsWith('image/') ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={codigoUrl}
                            alt="Código"
                            className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-red-100 flex items-center justify-center">
                            <FileText className="w-7 h-7 text-red-600" />
                          </div>
                        )
                      ) : codigoMimeType?.startsWith('image/') && getSafeImageSrc(codigoBase64Legacy) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getSafeImageSrc(codigoBase64Legacy)}
                          alt="Código"
                          className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-red-100 flex items-center justify-center">
                          <FileText className="w-7 h-7 text-red-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{codigoFileName}</p>
                        <p className="text-xs text-gray-500">
                          {codigoMimeType?.startsWith('image/') ? 'Imagen' : 'PDF'}
                          {codigoUrl && <span className="ml-1 text-green-600">· En Storage</span>}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCodigoUrl('');
                          setCodigoBase64Legacy('');
                          setCodigoMimeType('');
                          setCodigoFileName('');
                        }}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 p-4 pb-2">
              <FileText className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">IVA del local</span>
            </div>
            <div className="px-4 pb-4 space-y-3">
              {!local.ivaPermitidoMaestro ? (
                <p className="text-sm text-gray-600 leading-relaxed rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  La opción de cobrar IVA solo está disponible si el administrador de Andina la habilita para tu
                  negocio. Si necesitas facturar con IVA, contacta a soporte.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Cobrar IVA al cliente</p>
                      <p className="text-xs text-gray-500">La comisión Andina (8%) sigue según los términos vigentes; el envío no entra en esa base.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ivaEnabled}
                      onClick={() => setIvaEnabled((prev) => !prev)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${ivaEnabled ? 'bg-rojo-andino' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${ivaEnabled ? 'translate-x-5' : ''}`}
                      />
                    </button>
                  </div>
                  {ivaEnabled && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tasa de IVA (%)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ivaRate}
                        onChange={(e) => setIvaRate(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 p-4 pb-2">
              <Phone className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Estado del dispositivo</span>
            </div>
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-gray-600">
                Permiso: <strong>{notifPermission === 'granted' ? 'Activo' : notifPermission === 'denied' ? 'Bloqueado' : 'Pendiente'}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Token actual: <strong>{notifPermission !== 'granted' ? 'Sin permiso' : tokenActivo ? 'Activo' : 'No sincronizado'}</strong>
              </p>
              <button
                type="button"
                disabled={syncingDevice || notifLoading}
                onClick={() => void syncCurrentDevice()}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-70"
              >
                {syncingDevice ? 'Sincronizando...' : 'Sincronizar dispositivo'}
              </button>
            </div>
          </section>

          {/* Seguridad / contraseña */}
          <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 p-4 pb-2">
              <Lock className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Seguridad</span>
            </div>
            {fbUserState === null && (
              <div className="mx-4 mb-4 h-24 rounded-xl bg-gray-100 animate-pulse" aria-hidden />
            )}
            {fbUserState !== null && showGoogleMessageRestaurante && (
              <p className="text-sm text-gray-600 px-4 pb-4 leading-relaxed">
                Tu cuenta está vinculada a Google. Puedes gestionar tu seguridad directamente desde tu perfil de Google.
              </p>
            )}
            {fbUserState !== null && showPasswordFormRestaurante && (
              <>
                <p className="text-xs text-gray-500 px-4 pb-3">
                  Por seguridad, cambia la contraseña que te entregaron al registrarte.
                </p>
                <form onSubmit={handleCambiarPassword} className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña actual</label>
                    <PasswordInput
                      value={passwordActual}
                      onChange={(e) => setPasswordActual(e.target.value)}
                      placeholder="••••••••"
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nueva contraseña (mín. 6)</label>
                    <PasswordInput
                      value={passwordNueva}
                      onChange={(e) => setPasswordNueva(e.target.value)}
                      placeholder="••••••••"
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                      autoComplete="new-password"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                    <PasswordInput
                      value={passwordNuevaConfirm}
                      onChange={(e) => setPasswordNuevaConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                      autoComplete="new-password"
                      minLength={6}
                    />
                  </div>
                  {mensajePassword && (
                    <p
                      className={`text-sm font-medium ${mensajePassword.tipo === 'ok' ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {mensajePassword.text}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={cambiandoPassword}
                    className="w-full py-2.5 rounded-xl bg-rojo-andino text-white text-sm font-semibold hover:bg-rojo-andino/90 disabled:opacity-70"
                  >
                    {cambiandoPassword ? 'Cambiando...' : 'Cambiar contraseña'}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
      <NavPanel />
    </>
  );
}
