'use client';

import { use, useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import NavPanel from '@/components/panel/NavPanel';
import PasswordInput from '@/components/PasswordInput';
import { getIdToken } from '@/lib/authToken';
import { getFirebaseAuth, getFirebaseStorage } from '@/lib/firebase/client';
import type { Local } from '@/lib/data';
import { compressImage } from '@/lib/compressImage';
import { getSafeImageSrc, normalizeDataUrl } from '@/lib/validImageUrl';
import { uploadLocalQr } from '@/lib/storageUpload';
import CampoUbicacionConMapa from '@/components/CampoUbicacionConMapa';

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
  const [codigoUrl, setCodigoUrl] = useState('');
  // Legacy: mantenemos codigoBase64 solo para mostrar datos existentes cargados de Firestore
  const [codigoBase64Legacy, setCodigoBase64Legacy] = useState('');
  const [codigoMimeType, setCodigoMimeType] = useState('');
  const [codigoFileName, setCodigoFileName] = useState('');
  const [codigoUploading, setCodigoUploading] = useState(false);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordNuevaConfirm, setPasswordNuevaConfirm] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [mensajePassword, setMensajePassword] = useState<{ tipo: 'ok' | 'error'; text: string } | null>(null);

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
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

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
      numeroCuenta.trim() || cooperativa.trim()
        ? {
            numeroCuenta: numeroCuenta.trim(),
            cooperativa: cooperativa.trim(),
            titular: titular.trim() || undefined,
            tipoCuenta: tipoCuenta.trim() || undefined,
            // Fase 1: preferir codigoUrl (Storage); mantener codigoBase64 legacy si no hay URL
            codigoUrl: codigoUrl || undefined,
            codigoBase64: !codigoUrl ? (codigoBase64Legacy || undefined) : undefined,
            codigoMimeType: codigoMimeType || undefined,
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
    if (!passwordActual.trim()) {
      setMensajePassword({ tipo: 'error', text: 'Ingresá tu contraseña actual.' });
      return;
    }
    if (passwordNueva.length < 6) {
      setMensajePassword({ tipo: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    if (passwordNueva !== passwordNuevaConfirm) {
      setMensajePassword({ tipo: 'error', text: 'La nueva contraseña y la confirmación no coinciden.' });
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
      const msg = err && typeof err === 'object' && 'code' in err
        ? (err as { code?: string }).code === 'auth/wrong-password'
          ? 'Contraseña actual incorrecta.'
          : (err as { message?: string }).message || 'Error al cambiar contraseña.'
        : 'Error al cambiar contraseña.';
      setMensajePassword({ tipo: 'error', text: msg });
    } finally {
      setCambiandoPassword(false);
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
                  unoptimized={cover?.startsWith('data:')}
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
                    unoptimized={logo?.startsWith('data:')}
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
                  Configurá tu ubicación exacta en el mapa para que los riders lleguen sin errores.
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
            </div>
          </section>

          {/* Cambiar contraseña */}
          <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 p-4 pb-2">
              <Lock className="w-4 h-4 text-rojo-andino" />
              <span className="font-semibold text-gray-900">Cambiar contraseña</span>
            </div>
            <p className="text-xs text-gray-500 px-4 pb-3">
              Por seguridad, cambiá la contraseña que te entregaron al registrarte.
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
                <p className={`text-sm font-medium ${mensajePassword.tipo === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
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
          </section>
        </div>
      </main>
      <NavPanel />
    </>
  );
}
