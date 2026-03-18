'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  ExternalLink,
  RefreshCw,
  Building2,
  UserPlus,
  Loader2,
  Ban,
  MessageCircle,
  CheckSquare,
  Pencil,
  Trash2,
  DollarSign,
  TrendingUp,
  CreditCard,
  Check,
  LogOut,
  Camera,
  ImageIcon,
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage } from '@/lib/firebase/client';
import { useAuth } from '@/lib/useAuth';
import { getIdToken } from '@/lib/authToken';
import type { Local } from '@/lib/data';
import { compressImage } from '@/lib/compressImage';
import PasswordInput from '@/components/PasswordInput';
import ModalCerrarSesion from '@/components/panel/ModalCerrarSesion';
import { getSafeImageSrc } from '@/lib/validImageUrl';
import { formatDireccionCorta } from '@/lib/formatDireccion';
import CampoUbicacionConMapa from '@/components/CampoUbicacionConMapa';
import { useAndinaConfig } from '@/lib/AndinaContext';

interface Solicitud {
  id: string;
  status: string;
  createdAt: string;
  nombreLocal: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  telefonoLocal: string;
  direccion: string;
  tipoNegocio: string;
  localId?: string;
}

/** Logo de local con fallback si la imagen falla (corrupt/truncated), evita errores en consola. */
function LocaleLogoWithFallback({ logo }: { logo: string | undefined }) {
  const [loadError, setLoadError] = useState(false);
  const safeSrc = getSafeImageSrc(logo);
  if (!safeSrc || loadError) {
    return (
      <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center border border-gray-100">
        <Store className="w-7 h-7 text-gray-400" />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-100">
      <Image
        src={safeSrc}
        alt=""
        width={56}
        height={56}
        className="w-full h-full object-cover"
        onError={() => setLoadError(true)}
      />
    </div>
  );
}

export default function PanelMaestroPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { localesLight, config: andinaConfig } = useAndinaConfig();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [solicitudesLoading, setSolicitudesLoading] = useState(true);
  const [aprobandoId, setAprobandoId] = useState<string | null>(null);
  const [suspendandoId, setSuspendandoId] = useState<string | null>(null);
  const [locales, setLocales] = useState<Local[]>([]);
  const [localesLoading, setLocalesLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [pageVisible, setPageVisible] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState({
    email: '',
    password: '',
    displayName: '',
    rol: 'local' as 'central' | 'local',
    localId: '',
  });
  const [creandoUsuario, setCreandoUsuario] = useState(false);
  const [usuarioCreado, setUsuarioCreado] = useState<{ email: string; password: string; rol: string; localId?: string } | null>(null);
  const [editandoLocal, setEditandoLocal] = useState<Local | null>(null);
  const [editLocalForm, setEditLocalForm] = useState({
    name: '',
    address: '',
    telefono: '',
    time: '',
    email: '',
    password: '',
    logo: '',
    cover: '',
    lat: null as number | null,
    lng: null as number | null,
    isFeatured: false,
  });
  const [guardandoLocal, setGuardandoLocal] = useState(false);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [confirmarAccionLocal, setConfirmarAccionLocal] = useState<{
    tipo: 'borrar' | 'suspender';
    localId: string;
    nombre: string;
    suspended?: boolean;
  } | null>(null);
  const [statsComisiones, setStatsComisiones] = useState<{
    totalPendiente: number;
    totalPagado: number;
    total: number;
    hoy: { pendiente: number; pagado: number; total: number };
    semana: { pendiente: number; pagado: number; total: number };
    mes: { pendiente: number; pagado: number; total: number };
    porLocal: { localId: string; nombre: string; pendiente: number; pagado: number; total: number }[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [configTransferencia, setConfigTransferencia] = useState({
    cuenta: '',
    banco: '',
    qr: '',
    whatsappAdmin: '',
    cycleDays: 15 as 7 | 15 | 30,
    programStartDate: '',
  });
  const [configTransferenciaLoading, setConfigTransferenciaLoading] = useState(false);
  const [configTransferenciaSaving, setConfigTransferenciaSaving] = useState(false);
  const [comisionesByLocal, setComisionesByLocal] = useState<Record<string, { comisiones: { id: string; pedidoId: string; montoComision: number; fecha: number; pagado: boolean }[] }>>({});
  const [expandedLocalId, setExpandedLocalId] = useState<string | null>(null);
  const [comisionesLoadingLocalId, setComisionesLoadingLocalId] = useState<string | null>(null);
  const [comisionMarcandoId, setComisionMarcandoId] = useState<string | null>(null);

  const LOCALES_POR_PAGINA = 10;
  const [localesPaginaActual, setLocalesPaginaActual] = useState(1);
  const [seccionActiva, setSeccionActiva] = useState<'comisiones' | 'config' | 'usuarios' | 'solicitudes' | 'locales' | 'publicidad'>('comisiones');
  const [migrandoLocales, setMigrandoLocales] = useState(false);
  const [eliminarBannerId, setEliminarBannerId] = useState<string | null>(null);
  const [showMigrarModal, setShowMigrarModal] = useState(false);

  /** Banners publicidad */
  type BannerItem = { id: string; imageUrl: string; alt: string; linkType: string; linkValue: string; order: number; active?: boolean };
  const [bannersList, setBannersList] = useState<BannerItem[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerForm, setBannerForm] = useState({ imageUrl: '', alt: '', linkType: 'route' as 'category' | 'route' | 'url', linkValue: '/express', order: 0, active: true });
  const [editBannerId, setEditBannerId] = useState<string | null>(null);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerImageRef = useRef<HTMLInputElement>(null);
  const [carruselIntervalSeconds, setCarruselIntervalSeconds] = useState(4);
  const [carruselIntervalSaving, setCarruselIntervalSaving] = useState(false);
  const [lastFcmSync, setLastFcmSync] = useState<Date | null>(null);

  const [nuevoLocalManual, setNuevoLocalManual] = useState({
    name: '',
    address: '',
    telefono: '',
    time: '25-35 min',
    logo: '',
    cover: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerName: '',
    ownerPhone: '',
    lat: null as number | null,
    lng: null as number | null,
  });
  const [creandoLocalManual, setCreandoLocalManual] = useState(false);
  const [localCreadoResult, setLocalCreadoResult] = useState<{ localId: string; email: string; password: string } | null>(null);
  const nuevoLocalLogoRef = useRef<HTMLInputElement>(null);
  const nuevoLocalCoverRef = useRef<HTMLInputElement>(null);
  const editLocalLogoRef = useRef<HTMLInputElement>(null);
  const editLocalCoverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || user.rol !== 'maestro') {
      router.replace('/auth');
    }
  }, [user, loading, router]);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSolicitudesLoading(true);
    getIdToken()
      .then(async (token) => {
        if (!token || cancelled) {
          if (!cancelled) setSolicitudesLoading(false);
          return;
        }
        const res = await fetch('/api/solicitudes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) router.replace('/auth');
          return;
        }
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setSolicitudes(Array.isArray(data) ? data : Array.isArray(data?.solicitudes) ? data.solicitudes : []);
      })
      .catch(() => {
        if (!cancelled) setSolicitudes([]);
      })
      .finally(() => {
        if (!cancelled) setSolicitudesLoading(false);
      });
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/fcm/last-sync')
      .then((res) => (res.ok ? res.json() : { lastSync: null }))
      .then((data: { lastSync: number | null }) => {
        if (cancelled) return;
        if (typeof data.lastSync === 'number') {
          setLastFcmSync(new Date(data.lastSync));
        } else {
          setLastFcmSync(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLastFcmSync(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLocalesLoading(true);
    fetch('/api/locales?incluirSuspendidos=1')
      .then((res) => res.ok ? res.json() : { locales: [] })
      .then((data: { locales: Local[] }) => {
        if (!cancelled && Array.isArray(data.locales)) setLocales(data.locales);
      })
      .catch(() => {
        if (!cancelled) setLocales([]);
      })
      .finally(() => {
        if (!cancelled) setLocalesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (loading || !user || user.rol !== 'maestro') return;
    let cancelled = false;
    setStatsLoading(true);
    getIdToken()
      .then(async (token) => {
        if (!token || cancelled) return;
        const res = await fetch('/api/stats/maestro', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setStatsComisiones(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, loading]);

  /* Cargar config transferencia Andina (cuenta donde la app recibe pagos) */
  useEffect(() => {
    let cancelled = false;
    setConfigTransferenciaLoading(true);
    getIdToken()
      .then(async (token) => {
        if (!token || cancelled) return;
        const res = await fetch('/api/config/transferencia', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json() as {
          cuenta?: string;
          banco?: string;
          qr?: string;
          whatsappAdmin?: string;
          cycleDays?: number;
          programStartDate?: string;
        };
        if (!cancelled) {
          setConfigTransferencia({
            cuenta: data.cuenta ?? '',
            banco: data.banco ?? '',
            qr: data.qr ?? '',
            whatsappAdmin: data.whatsappAdmin ?? '',
            cycleDays: [7, 15, 30].includes(Number(data.cycleDays)) ? (data.cycleDays as 7 | 15 | 30) : 15,
            programStartDate: data.programStartDate ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setConfigTransferenciaLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const solicitudesPendientes = solicitudes.filter((s) => s.status === 'pending');
  const solicitudesAprobadas = solicitudes.filter((s) => s.status === 'approved');

  const localesOrdenados = [...locales].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const totalPaginasLocales = Math.max(1, Math.ceil(localesOrdenados.length / LOCALES_POR_PAGINA));
  const localesPaginados = localesOrdenados.slice(
    (localesPaginaActual - 1) * LOCALES_POR_PAGINA,
    localesPaginaActual * LOCALES_POR_PAGINA
  );
  const desdeLocales = localesOrdenados.length === 0 ? 0 : (localesPaginaActual - 1) * LOCALES_POR_PAGINA + 1;
  const hastaLocales = Math.min(localesPaginaActual * LOCALES_POR_PAGINA, localesOrdenados.length);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const refreshSolicitudes = () => {
    setSolicitudesLoading(true);
    getIdToken()
      .then(async (token) => {
        if (!token) {
          setSolicitudesLoading(false);
          router.replace('/auth');
          return;
        }
        const res = await fetch('/api/solicitudes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          router.replace('/auth');
          return;
        }
        const data = await res.ok ? await res.json() : [];
        setSolicitudes(Array.isArray(data) ? data : Array.isArray(data?.solicitudes) ? data.solicitudes : []);
      })
      .catch(() => setSolicitudes([]))
      .finally(() => setSolicitudesLoading(false));
  };

  const refreshLocales = () => {
    setLocalesLoading(true);
    fetch('/api/locales?incluirSuspendidos=1')
      .then((res) => res.ok ? res.json() : { locales: [] })
      .then((data: { locales: Local[] }) => {
        if (Array.isArray(data.locales)) {
          setLocales(data.locales);
          setLocalesPaginaActual(1);
        }
      })
      .catch(() => {})
      .finally(() => setLocalesLoading(false));
  };

  const loadBanners = useCallback(async () => {
    setBannersLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/banners?admin=1', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = res.ok ? (await res.json()) as { banners: BannerItem[]; intervalSeconds?: number } : { banners: [], intervalSeconds: 4 };
      setBannersList(Array.isArray(data.banners) ? data.banners : []);
      const interval = typeof data.intervalSeconds === 'number' && data.intervalSeconds >= 2 && data.intervalSeconds <= 60
        ? Math.round(data.intervalSeconds)
        : 4;
      setCarruselIntervalSeconds(interval);
    } catch {
      setBannersList([]);
    } finally {
      setBannersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (seccionActiva === 'publicidad') loadBanners();
  }, [seccionActiva, loadBanners]);

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    e.target.value = '';
    setBannerUploading(true);
    try {
      const storage = getFirebaseStorage();
      const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const storageRef = ref(storage, path);
      const compressed = await compressImage(file, 'banner');
      await uploadBytes(storageRef, compressed);
      const url = await getDownloadURL(storageRef);
      setBannerForm((prev) => ({ ...prev, imageUrl: url }));
    } catch (err) {
      console.error(err);
      showToast('Error al subir imagen');
    } finally {
      setBannerUploading(false);
    }
  };

  const guardarBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.imageUrl.trim()) {
      showToast('Sube una imagen primero');
      return;
    }
    setBannerSaving(true);
    try {
      const token = await getIdToken();
      if (!token) {
        showToast('Sesión expirada');
        return;
      }
      if (editBannerId) {
        const res = await fetch(`/api/banners/${editBannerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            imageUrl: bannerForm.imageUrl,
            alt: bannerForm.alt,
            linkType: bannerForm.linkType,
            linkValue: bannerForm.linkValue,
            order: bannerForm.order,
            active: bannerForm.active,
          }),
        });
        if (res.ok) {
          showToast('Banner actualizado');
          setEditBannerId(null);
          setBannerForm({ imageUrl: '', alt: '', linkType: 'route', linkValue: '/express', order: 0, active: true });
          loadBanners();
          router.refresh();
        } else {
          const d = await res.json().catch(() => ({}));
          showToast(d?.error || 'Error al actualizar');
        }
      } else {
        const res = await fetch('/api/banners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            imageUrl: bannerForm.imageUrl,
            alt: bannerForm.alt,
            linkType: bannerForm.linkType,
            linkValue: bannerForm.linkValue,
            order: bannerForm.order,
            active: bannerForm.active,
          }),
        });
        if (res.ok) {
          showToast('Banner creado');
          setBannerForm({ imageUrl: '', alt: '', linkType: 'route', linkValue: '/express', order: 0, active: true });
          loadBanners();
          router.refresh();
        } else {
          const d = await res.json().catch(() => ({}));
          showToast(d?.error || 'Error al crear');
        }
      }
    } catch {
      showToast('Error de conexión');
    } finally {
      setBannerSaving(false);
    }
  };

  const eliminarBanner = async (id: string) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/banners/${id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) {
        showToast('Banner eliminado');
        setEliminarBannerId(null);
        router.refresh();
        if (editBannerId === id) {
          setEditBannerId(null);
          setBannerForm({ imageUrl: '', alt: '', linkType: 'route', linkValue: '/express', order: 0, active: true });
        }
        loadBanners();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d?.error || 'Error al eliminar');
      }
    } catch {
      showToast('Error de conexión');
    }
  };

  const guardarIntervaloCarrusel = async () => {
    const value = Math.min(60, Math.max(2, Math.round(carruselIntervalSeconds)));
    setCarruselIntervalSeconds(value);
    setCarruselIntervalSaving(true);
    try {
      const token = await getIdToken();
      if (!token) {
        showToast('Sesión expirada');
        return;
      }
      const res = await fetch('/api/config/carrusel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intervalSeconds: value }),
      });
      if (res.ok) {
        showToast('Intervalo del carrusel guardado');
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d?.error || 'Error al guardar');
      }
    } catch {
      showToast('Error de conexión');
    } finally {
      setCarruselIntervalSaving(false);
    }
  };

  const handleMigrarLocales = async () => {
    setShowMigrarModal(false);
    setMigrandoLocales(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/maestro/migrar-locales', {
        method: 'POST',
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      const data = await res.json();
      if (res.ok && data.migrated != null) {
        showToast(`Migrados ${data.migrated} locales a la base de datos.`);
        refreshLocales();
      } else {
        showToast(data.error || 'Error al migrar');
      }
    } catch {
      showToast('Error al migrar');
    } finally {
      setMigrandoLocales(false);
    }
  };

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleNuevoLocalLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    try {
      const compressed = await compressImage(file, 'solicitudLogo');
      const dataUrl = await fileToBase64(compressed);
      setNuevoLocalManual((prev) => ({ ...prev, logo: dataUrl }));
    } catch {
      showToast('Error al comprimir imagen');
    }
    e.target.value = '';
  };

  const handleNuevoLocalCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    try {
      const compressed = await compressImage(file, 'solicitudCover');
      const dataUrl = await fileToBase64(compressed);
      setNuevoLocalManual((prev) => ({ ...prev, cover: dataUrl }));
    } catch {
      showToast('Error al comprimir imagen');
    }
    e.target.value = '';
  };

  const handleCrearLocalManual = async (e: React.FormEvent) => {
    e.preventDefault();
      const { name, address, telefono, time, logo, cover, ownerEmail, ownerPassword, ownerName, ownerPhone, lat, lng } = nuevoLocalManual;
    if (!name.trim()) {
      showToast('Nombre del local es obligatorio');
      return;
    }
    setCreandoLocalManual(true);
    setLocalCreadoResult(null);
    try {
      const token = await getIdToken();
      if (!token) {
        showToast('Sesión expirada. Vuelve a iniciar sesión.');
        setCreandoLocalManual(false);
        return;
      }
      const resLocales = await fetch('/api/locales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || undefined,
          telefono: telefono.trim() || undefined,
          time: time.trim() || undefined,
          logo: logo || undefined,
          cover: cover || undefined,
          ownerName: ownerName.trim() || undefined,
          ownerPhone: ownerPhone.trim() || undefined,
          ownerEmail: ownerEmail.trim() || undefined,
          lat: lat != null ? lat : undefined,
          lng: lng != null ? lng : undefined,
        }),
      });
      const dataLocales = await resLocales.json();
      if (!resLocales.ok) {
        showToast(dataLocales.error || 'Error al crear local');
        setCreandoLocalManual(false);
        return;
      }
      const localId = dataLocales.localId as string;
      if (ownerEmail.trim() && ownerPassword.length >= 6) {
        const resUser = await fetch('/api/maestro/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: ownerEmail.trim(),
            password: ownerPassword,
            rol: 'local',
            localId,
            displayName: ownerName.trim() || undefined,
          }),
        });
        const dataUser = await resUser.json();
        if (!resUser.ok) {
          showToast(`Local creado (${localId}), pero no se pudo crear usuario: ${dataUser.error || 'Error'}`);
          setLocalCreadoResult({ localId, email: ownerEmail.trim(), password: ownerPassword });
        } else {
          showToast('Local y usuario creados. Entrega las credenciales al dueño.');
          setLocalCreadoResult({ localId, email: ownerEmail.trim(), password: ownerPassword });
        }
      } else {
        showToast('Local creado. Agregá después un usuario desde "Usuarios" o al editar el local.');
        setLocalCreadoResult({ localId, email: '', password: '' });
      }
      setNuevoLocalManual({
        name: '',
        address: '',
        telefono: '',
        time: '25-35 min',
        logo: '',
        cover: '',
        ownerEmail: '',
        ownerPassword: '',
        ownerName: '',
        ownerPhone: '',
        lat: null,
        lng: null,
      });
      refreshLocales();
    } catch {
      showToast('Error al crear local');
    } finally {
      setCreandoLocalManual(false);
    }
  };

  const handleEditarLocal = (loc: Local) => {
    setEditandoLocal(loc);
    setEditLocalForm({
      name: loc.name,
      address: loc.address ?? '',
      telefono: loc.telefono ?? '',
      time: loc.time ?? '',
      email: '',
      password: '',
      logo: loc.logo ?? '',
      cover: loc.cover ?? '',
      lat: typeof loc.lat === 'number' ? loc.lat : null,
      lng: typeof loc.lng === 'number' ? loc.lng : null,
      isFeatured: Boolean((loc as { isFeatured?: boolean }).isFeatured ?? loc.destacado),
    });
  };

  const handleEditLocalLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    try {
      const compressed = await compressImage(file, 'solicitudLogo');
      const dataUrl = await fileToBase64(compressed);
      setEditLocalForm((prev) => ({ ...prev, logo: dataUrl }));
    } catch {
      showToast('Error al comprimir imagen');
    }
    e.target.value = '';
  };

  const handleEditLocalCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    try {
      const compressed = await compressImage(file, 'solicitudCover');
      const dataUrl = await fileToBase64(compressed);
      setEditLocalForm((prev) => ({ ...prev, cover: dataUrl }));
    } catch {
      showToast('Error al comprimir imagen');
    }
    e.target.value = '';
  };

  const handleGuardarLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editandoLocal) return;
    setGuardandoLocal(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/locales/${editandoLocal.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          name: editLocalForm.name.trim(),
          address: editLocalForm.address.trim() || undefined,
          telefono: editLocalForm.telefono.trim() || undefined,
          time: editLocalForm.time.trim() || undefined,
          logo: editLocalForm.logo || undefined,
          cover: editLocalForm.cover || undefined,
          lat: editLocalForm.lat != null ? editLocalForm.lat : undefined,
          lng: editLocalForm.lng != null ? editLocalForm.lng : undefined,
          isFeatured: editLocalForm.isFeatured,
        }),
      });
      if (res.ok) {
        setLocales((prev) =>
          prev.map((l) =>
            l.id === editandoLocal.id
              ? {
                  ...l,
                  name: editLocalForm.name.trim(),
                  address: editLocalForm.address.trim() || undefined,
                  telefono: editLocalForm.telefono.trim() || undefined,
                  time: editLocalForm.time.trim() || l.time,
                  logo: editLocalForm.logo || l.logo,
                  cover: editLocalForm.cover || l.cover,
                  isFeatured: editLocalForm.isFeatured,
                }
              : l
          )
        );
        showToast('Local actualizado');

        const email = editLocalForm.email.trim();
        const password = editLocalForm.password;
        if (email && password && password.length >= 6) {
          const resUser = await fetch('/api/maestro/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              email,
              password,
              rol: 'local',
              localId: editandoLocal.id,
              displayName: editLocalForm.name.trim(),
            }),
          });
          const dataUser = await resUser.json();
          if (resUser.ok) {
            showToast('Local actualizado. Credenciales creadas. Entrega el correo y contraseña al local.');
            setEditandoLocal(null);
          } else if (dataUser.error?.includes('ya está registrado') || dataUser.error?.includes('correo')) {
            showToast('Local actualizado, pero ese correo ya está registrado. Prueba otro.');
            return;
          } else {
            showToast(dataUser.error || 'Local actualizado, pero no se pudo crear usuario.');
            return;
          }
        }
        setEditandoLocal(null);
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al guardar');
      }
    } catch {
      showToast('Error al guardar');
    } finally {
      setGuardandoLocal(false);
    }
  };

  const handleBorrarLocal = async (localId: string) => {
    setConfirmarAccionLocal(null);
    setBorrandoId(localId);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/locales/${localId}`, {
        method: 'DELETE',
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      if (res.ok) {
        setLocales((prev) => prev.filter((l) => l.id !== localId));
        showToast('Local eliminado');
        refreshLocales();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al eliminar');
      }
    } catch {
      showToast('Error al eliminar');
    } finally {
      setBorrandoId(null);
    }
  };

  const handleSuspender = async (localId: string, suspended: boolean) => {
    setConfirmarAccionLocal(null);
    setSuspendandoId(localId);
    try {
      const token = await getIdToken();
      if (!token) {
        showToast('Sesión expirada. Vuelve a iniciar sesión.');
        setSuspendandoId(null);
        return;
      }
      const res = await fetch(`/api/locales/${localId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: suspended ? 'suspended' : 'active' }),
      });
      if (res.ok) {
        setLocales((prev) => prev.map((l) => (l.id === localId ? { ...l, status: suspended ? 'suspended' : 'active' } : l)));
        showToast(suspended ? 'Local suspendido' : 'Local reactivado');
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al cambiar estado');
      }
    } catch {
      showToast('Error al cambiar estado del local');
    } finally {
      setSuspendandoId(null);
    }
  };

  const guardarConfigTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigTransferenciaSaving(true);
    try {
      const token = await getIdToken();
      if (!token) {
        showToast('Sesión expirada. Vuelve a iniciar sesión.');
        return;
      }
      const res = await fetch('/api/config/transferencia', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(configTransferencia),
      });
      if (res.ok) showToast('Configuración de transferencia guardada');
      else showToast('Error al guardar');
      if (res.ok) router.refresh();
    } catch {
      showToast('Error al guardar');
    } finally {
      setConfigTransferenciaSaving(false);
    }
  };

  const cargarComisionesLocal = async (localId: string) => {
    const token = await getIdToken();
    if (!token) {
      showToast('Sesión expirada');
      router.replace('/auth');
      return;
    }
    setComisionesLoadingLocalId(localId);
    try {
      const res = await fetch(`/api/comisiones?localId=${encodeURIComponent(localId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        router.replace('/auth');
        return;
      }
      if (!res.ok) return;
      const data = await res.json() as { comisiones: { id: string; pedidoId: string; montoComision: number; fecha: number; pagado: boolean }[] };
      setComisionesByLocal((prev) => ({ ...prev, [localId]: { comisiones: data.comisiones || [] } }));
      setExpandedLocalId(localId);
    } finally {
      setComisionesLoadingLocalId(null);
    }
  };

  const marcarComisionPagada = async (comisionId: string, localId: string) => {
    const token = await getIdToken();
    if (!token) {
      showToast('Sesión expirada');
      router.replace('/auth');
      return;
    }
    setComisionMarcandoId(comisionId);
    try {
      const res = await fetch(`/api/comisiones/${comisionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pagado: true }),
      });
      if (res.status === 401 || res.status === 403) {
        router.replace('/auth');
        return;
      }
      if (res.ok) {
        showToast('Comisión marcada como pagada');
        setComisionesByLocal((prev) => {
          const next = { ...prev };
          for (const localId of Object.keys(next)) {
            next[localId] = {
              comisiones: next[localId].comisiones.map((c) =>
                c.id === comisionId ? { ...c, pagado: true } : c
              ),
            };
          }
          return next;
        });
        setStatsComisiones(null);
        getIdToken().then(async (t) => {
          if (!t) return;
          const r = await fetch('/api/stats/maestro', { headers: { Authorization: `Bearer ${t}` } });
          if (r.ok) {
            const d = await r.json();
            setStatsComisiones(d);
          }
          cargarComisionesLocal(localId);
        });
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al marcar');
      }
    } catch {
      showToast('Error al marcar');
    } finally {
      setComisionMarcandoId(null);
    }
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUsuario.email.trim() || !nuevoUsuario.password || nuevoUsuario.password.length < 6) {
      showToast('Correo y contraseña (mín. 6 caracteres) son obligatorios');
      return;
    }
    if (nuevoUsuario.rol === 'local' && !nuevoUsuario.localId) {
      showToast('Selecciona un local para el usuario tipo Local');
      return;
    }
    setCreandoUsuario(true);
    setUsuarioCreado(null);
    try {
      const token = await getIdToken();
      if (!token) {
        showToast('Sesión expirada. Vuelve a iniciar sesión.');
        setCreandoUsuario(false);
        return;
      }
      const res = await fetch('/api/maestro/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: nuevoUsuario.email.trim(),
          password: nuevoUsuario.password,
          displayName: nuevoUsuario.displayName.trim() || undefined,
          rol: nuevoUsuario.rol,
          localId: nuevoUsuario.rol === 'local' ? nuevoUsuario.localId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Error al crear usuario');
        setCreandoUsuario(false);
        return;
      }
      setUsuarioCreado({
        email: nuevoUsuario.email.trim(),
        password: nuevoUsuario.password,
        rol: nuevoUsuario.rol,
        localId: nuevoUsuario.rol === 'local' ? nuevoUsuario.localId : undefined,
      });
      setNuevoUsuario({ email: '', password: '', displayName: '', rol: 'local', localId: '' });
      showToast('Usuario creado. Entrega las credenciales al usuario.');
    } catch {
      showToast('Error al crear usuario');
    } finally {
      setCreandoUsuario(false);
    }
  };

  if (loading || !user || user.rol !== 'maestro') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-rojo-andino border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-gray-50 pb-8 transition-all duration-300 ${
        pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <header className="bg-rojo-andino text-white px-5 pt-10 pb-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="w-9" />
          <div className="flex items-center gap-2">
            <span className="bg-dorado-oro text-gray-900 font-bold text-sm px-2.5 py-1 rounded-lg">ANDINA</span>
            <span className="text-white/90 text-sm font-semibold">Panel Maestro</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
        <h1 className="font-bold text-xl">Panel Maestro</h1>
        <p className="text-white/80 text-sm mt-0.5">Solicitudes de socios y locales</p>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Estado del sistema (resumen rápido desde AndinaContext) */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">
            Estado del sistema
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-blue-50 px-3 py-2.5 flex flex-col">
              <span className="text-xs text-blue-600 font-semibold">Locales activos</span>
              <span className="text-lg font-black text-blue-900">
                {localesLight.length}
              </span>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2.5 flex flex-col">
              <span className="text-xs text-emerald-600 font-semibold">Tarifa base envío</span>
              <span className="text-lg font-black text-emerald-900">
                {andinaConfig.tarifas.tiers.length > 0
                  ? `$${andinaConfig.tarifas.tiers[0].tarifa.toFixed(2)}`
                  : '—'}
              </span>
            </div>
          </div>
          {lastFcmSync && (
            <p className="mt-3 text-[11px] text-gray-400">
              Última sincronización de notificaciones:{' '}
              {lastFcmSync.toLocaleString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              })}
            </p>
          )}
        </section>

        {toast && (
          <div className="rounded-2xl bg-gray-800 text-white px-4 py-3 text-sm font-medium">
            {toast}
          </div>
        )}

        {/* Tabs de secciones */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'comisiones' as const, label: 'Comisiones' },
            { id: 'config' as const, label: 'Configuración' },
            { id: 'usuarios' as const, label: 'Usuarios' },
            { id: 'solicitudes' as const, label: 'Solicitudes' },
            { id: 'locales' as const, label: 'Locales' },
            { id: 'publicidad' as const, label: 'Publicidad' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSeccionActiva(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                seccionActiva === tab.id
                  ? 'bg-rojo-andino text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {seccionActiva === 'comisiones' && (
          <>
        {/* Stats comisiones */}
        <section>
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-dorado-oro" />
            Estadísticas de comisiones
          </h2>
          {statsLoading ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300 mx-auto" />
            </div>
          ) : statsComisiones ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">Total pendiente</p>
                  <p className="text-lg font-bold text-amber-600">${statsComisiones.totalPendiente.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">Total pagado</p>
                  <p className="text-lg font-bold text-green-600">${statsComisiones.totalPagado.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">Total general</p>
                  <p className="text-lg font-bold text-rojo-andino">${statsComisiones.total.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase mb-3">Por período</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Hoy</p>
                    <p className="font-bold text-gray-900">${statsComisiones.hoy.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Semana</p>
                    <p className="font-bold text-gray-900">${statsComisiones.semana.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Mes</p>
                    <p className="font-bold text-gray-900">${statsComisiones.mes.total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              {statsComisiones.porLocal.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-3">Por local</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {statsComisiones.porLocal
                      .sort((a, b) => b.total - a.total)
                      .map((l) => (
                        <div
                          key={l.localId}
                          className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                        >
                          <span className="font-medium text-gray-900 truncate">{l.nombre}</span>
                          <span className="text-sm font-bold text-gray-700">${l.total.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
              <p className="text-gray-500">No se pudieron cargar las estadísticas</p>
            </div>
          )}
        </section>

        {/* Comisiones por local: listar y marcar como pagadas */}
        {statsComisiones && statsComisiones.porLocal.length > 0 && (
          <section>
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-dorado-oro" />
              Comisiones por local
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              Expande un local para ver sus comisiones y marcar como pagadas.
            </p>
            <div className="space-y-2">
              {statsComisiones.porLocal
                .sort((a, b) => b.total - a.total)
                .map((l) => {
                  const expanded = expandedLocalId === l.localId;
                  const data = comisionesByLocal[l.localId];
                  const loading = comisionesLoadingLocalId === l.localId;
                  return (
                    <div key={l.localId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          if (expanded) setExpandedLocalId(null);
                          else if (!data) cargarComisionesLocal(l.localId);
                          else setExpandedLocalId(l.localId);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-gray-900 truncate">{l.nombre}</span>
                        <span className="text-sm font-bold text-gray-700">${l.total.toFixed(2)}</span>
                      </button>
                      {expanded && (
                        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                          {loading ? (
                            <div className="flex justify-center py-6">
                              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                          ) : data?.comisiones.length ? (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {data.comisiones.map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0 text-sm"
                                >
                                  <div className="min-w-0">
                                    <span className="font-mono text-gray-600">{c.pedidoId}</span>
                                    <span className="text-gray-400 ml-2">
                                      {new Date(c.fecha).toLocaleDateString('es')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="font-semibold text-gray-900">${c.montoComision.toFixed(2)}</span>
                                    {c.pagado ? (
                                      <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">Pagado</span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={comisionMarcandoId === c.id}
                                        onClick={() => marcarComisionPagada(c.id, l.localId)}
                                        className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded disabled:opacity-60"
                                      >
                                        {comisionMarcandoId === c.id ? '...' : 'Marcar pagado'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm py-2">Sin comisiones</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        </>
        )}

        {seccionActiva === 'config' && (
        <>
        {/* Cuenta donde Andina recibe pagos (transferencias de clientes/locales) */}
        <section>
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2 mb-3">
            <CreditCard className="w-5 h-5 text-dorado-oro" />
            Cuenta para pagos Andina
          </h2>
          <p className="text-sm text-gray-500 mb-3">
            Datos bancarios y QR para que los clientes paguen por transferencia. Solo tú (maestro) gestionas esto.
          </p>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            {configTransferenciaLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              </div>
            ) : (
              <form onSubmit={guardarConfigTransferencia} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cuenta</label>
                  <input
                    type="text"
                    value={configTransferencia.cuenta}
                    onChange={(e) => setConfigTransferencia((c) => ({ ...c, cuenta: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                    placeholder="Ej. 1234567890"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Banco</label>
                  <input
                    type="text"
                    value={configTransferencia.banco}
                    onChange={(e) => setConfigTransferencia((c) => ({ ...c, banco: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                    placeholder="Ej. Banco Pichincha"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL o data URL del QR</label>
                  <input
                    type="text"
                    value={configTransferencia.qr}
                    onChange={(e) => setConfigTransferencia((c) => ({ ...c, qr: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                    placeholder="https://... o data:image/..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp de administración</label>
                  <input
                    type="text"
                    value={configTransferencia.whatsappAdmin}
                    onChange={(e) => setConfigTransferencia((c) => ({ ...c, whatsappAdmin: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                    placeholder="Ej. 593992250333"
                  />
                  <p className="text-xs text-gray-500 mt-1">Número donde los locales contactan (Comunicate con administración).</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ciclo de cobro</label>
                  <select
                    value={configTransferencia.cycleDays}
                    onChange={(e) => setConfigTransferencia((c) => ({ ...c, cycleDays: Number(e.target.value) as 7 | 15 | 30 }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  >
                    <option value={7}>Semanal (7 días)</option>
                    <option value={15}>Quincenal (15 días)</option>
                    <option value={30}>Mensual (30 días)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha de inicio del programa de comisiones</label>
                  <input
                    type="date"
                    value={configTransferencia.programStartDate ? configTransferencia.programStartDate.slice(0, 10) : ''}
                    onChange={(e) => setConfigTransferencia((c) => ({ ...c, programStartDate: e.target.value || '' }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  />
                  <p className="text-xs text-gray-500 mt-1">Antes de esta fecha no se cobra comisión. Locales existentes cuentan desde esta fecha; locales nuevos desde el día en que se crean o aprueban.</p>
                </div>
                {configTransferencia.programStartDate && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
                    El programa inicia el {new Date(configTransferencia.programStartDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}. Ciclo {configTransferencia.cycleDays === 7 ? 'semanal' : configTransferencia.cycleDays === 15 ? 'quincenal' : 'mensual'}.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={configTransferenciaSaving}
                  className="w-full py-3 rounded-xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {configTransferenciaSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {configTransferenciaSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </form>
            )}
          </div>
        </section>

        </>
        )}

        {seccionActiva === 'usuarios' && (
        <>
        {/* Crear usuario (Central o Local) */}
        <section>
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2 mb-3">
            <UserPlus className="w-5 h-5 text-dorado-oro" />
            Crear usuario
          </h2>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            {usuarioCreado ? (
              <div className="space-y-3">
                <p className="text-sm font-bold text-green-700">Usuario creado. Entrega estas credenciales:</p>
                <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm font-mono">
                  <p><span className="text-gray-500">Correo:</span> {usuarioCreado.email}</p>
                  <p><span className="text-gray-500">Contraseña:</span> {usuarioCreado.password}</p>
                  <p><span className="text-gray-500">Rol:</span> {usuarioCreado.rol === 'central' ? 'Central' : 'Local'}</p>
                  {usuarioCreado.localId && <p><span className="text-gray-500">Local:</span> {usuarioCreado.localId}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setUsuarioCreado(null)}
                  className="text-sm font-semibold text-rojo-andino hover:underline"
                >
                  Crear otro usuario
                </button>
              </div>
            ) : (
              <form onSubmit={handleCrearUsuario} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo</label>
                  <input
                    type="email"
                    value={nuevoUsuario.email}
                    onChange={(e) => setNuevoUsuario((u) => ({ ...u, email: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                    placeholder="usuario@ejemplo.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña (mín. 6)</label>
                  <input
                    type="text"
                    value={nuevoUsuario.password}
                    onChange={(e) => setNuevoUsuario((u) => ({ ...u, password: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                    placeholder="Contraseña"
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre (opcional)</label>
                  <input
                    type="text"
                    value={nuevoUsuario.displayName}
                    onChange={(e) => setNuevoUsuario((u) => ({ ...u, displayName: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                    placeholder="Ej. María Central"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rol</label>
                  <select
                    value={nuevoUsuario.rol}
                    onChange={(e) => setNuevoUsuario((u) => ({ ...u, rol: e.target.value as 'central' | 'local', localId: u.rol === 'local' ? u.localId : '' }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  >
                    <option value="central">Central</option>
                    <option value="local">Local (restaurante)</option>
                  </select>
                </div>
                {nuevoUsuario.rol === 'local' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Local</label>
                    <select
                      value={nuevoUsuario.localId}
                      onChange={(e) => setNuevoUsuario((u) => ({ ...u, localId: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                      required
                    >
                      <option value="">Selecciona un local</option>
                      {locales.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.id})</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={creandoUsuario}
                  className="w-full py-3 rounded-xl bg-rojo-andino text-white font-bold disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {creandoUsuario ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {creandoUsuario ? 'Creando...' : 'Crear usuario'}
                </button>
              </form>
            )}
          </div>
        </section>

        </>
        )}

        {seccionActiva === 'solicitudes' && (
        <>
        {/* Socios */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Store className="w-5 h-5 text-dorado-oro" />
              Solicitudes de socios
            </h2>
            <button
              type="button"
              onClick={refreshSolicitudes}
              disabled={solicitudesLoading}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${solicitudesLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {solicitudesLoading ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <p className="text-gray-500">Cargando solicitudes...</p>
            </div>
          ) : solicitudesPendientes.length === 0 && solicitudesAprobadas.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Store className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="font-bold text-gray-400">No hay solicitudes de socios</p>
              <p className="text-xs text-gray-400 mt-1">Las nuevas solicitudes aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-4">
              {solicitudesPendientes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Pendientes de aprobar
                  </p>
                  <div className="space-y-3">
                    {solicitudesPendientes.map((sol) => (
                      <div
                        key={sol.id}
                        className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-bold text-gray-900">{sol.nombreLocal}</p>
                            <p className="text-xs text-gray-500">
                              {sol.nombre} {sol.apellido} · {sol.tipoNegocio}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDireccionCorta(sol.direccion)}</p>
                            <p className="text-xs text-gray-400">{sol.email} · {sol.telefonoLocal}</p>
                          </div>
                          <button
                            type="button"
                            disabled={aprobandoId === sol.id}
                            onClick={async () => {
                              setAprobandoId(sol.id);
                              try {
                                const token = await getIdToken();
                                if (!token) {
                                  showToast('Sesión expirada. Vuelve a iniciar sesión.');
                                  router.replace('/auth');
                                  setAprobandoId(null);
                                  return;
                                }
                                const res = await fetch(`/api/solicitudes/${sol.id}/aprobar`, {
                                  method: 'POST',
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                                const data = await res.json();
                                if (res.status === 401 || res.status === 403) {
                                  showToast('Sesión expirada');
                                  router.replace('/auth');
                                  setAprobandoId(null);
                                  return;
                                }
                                if (res.ok && data.localId) {
                                  setSolicitudes((prev) =>
                                    prev.map((s) =>
                                      s.id === sol.id ? { ...s, status: 'approved', localId: data.localId } : s
                                    )
                                  );
                                  showToast(`¡Registro exitoso! ${sol.nombreLocal} aprobado.`);
                                } else {
                                  showToast(data.error || 'Error al aprobar');
                                }
                              } catch {
                                showToast('Error al aprobar');
                              } finally {
                                setAprobandoId(null);
                              }
                            }}
                            className="flex-shrink-0 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white text-sm font-bold transition-colors"
                          >
                            {aprobandoId === sol.id ? '...' : 'Aprobar'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {new Date(sol.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {solicitudesAprobadas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">
                    Aprobados
                  </p>
                  <div className="space-y-3">
                    {solicitudesAprobadas.map((sol) => {
                      const waPhone = sol.telefonoLocal?.replace(/\D/g, '');
                      return (
                        <div
                          key={sol.id}
                          className="bg-white rounded-2xl p-4 shadow-sm border border-green-100"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-gray-900">{sol.nombreLocal}</p>
                              <p className="text-xs text-green-600 font-semibold">{sol.localId ?? '—'}</p>
                              <p className="text-xs text-gray-400">{sol.telefonoLocal}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              {waPhone && (
                                <a
                                  href={`https://wa.me/593${waPhone.replace(/^0/, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  WA
                                </a>
                              )}
                              {sol.localId && (
                                <button
                                  type="button"
                                  onClick={() => router.push(`/panel/restaurante/${sol.localId}`)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rojo-andino/10 text-rojo-andino text-xs font-semibold hover:bg-rojo-andino/20 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Panel
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        </>
        )}

        {seccionActiva === 'locales' && (
        <>
        {/* Crear local (manual) — para casos WhatsApp, etc. */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-rojo-andino/5 to-dorado-oro/5 px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <Store className="w-5 h-5 text-rojo-andino" />
                Crear local
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Para negocios por WhatsApp u otro medio. Creás el local y las credenciales; después configurás menú desde el panel del restaurante.
              </p>
            </div>
            {localCreadoResult ? (
              <div className="p-5">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="font-bold text-green-800 mb-1">Local creado</p>
                  <p className="text-sm text-green-700 mb-3">
                    Entrega estas credenciales al dueño. Luego puedes configurar menú y fotos desde el panel del restaurante.
                  </p>
                  {localCreadoResult.email && (
                    <div className="bg-white rounded-lg p-3 mb-3 text-sm font-mono space-y-1 border border-green-100">
                      <p><span className="text-gray-500">Correo:</span> <span className="text-gray-900">{localCreadoResult.email}</span></p>
                      <p><span className="text-gray-500">Contraseña:</span> <span className="text-gray-900">{localCreadoResult.password}</span></p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/panel/restaurante/${localCreadoResult.localId}`)}
                      className="px-4 py-2.5 rounded-xl bg-rojo-andino text-white text-sm font-semibold hover:bg-rojo-andino/90 flex items-center gap-2 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ir al panel del restaurante
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalCreadoResult(null)}
                      className="px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Crear otro local
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            <form onSubmit={handleCrearLocalManual} className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del local</label>
                <input
                  type="text"
                  value={nuevoLocalManual.name}
                  onChange={(e) => setNuevoLocalManual((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  placeholder="Ej. Mi Restaurante"
                  required
                />
              </div>
              <div>
                <CampoUbicacionConMapa
                  value={nuevoLocalManual.address}
                  onChange={(v) => setNuevoLocalManual((p) => ({ ...p, address: v }))}
                  onCoordsChange={(newLat, newLng) => setNuevoLocalManual((p) => ({ ...p, lat: newLat, lng: newLng }))}
                  initialLat={nuevoLocalManual.lat}
                  initialLng={nuevoLocalManual.lng}
                  label="Dirección"
                  placeholder="Ej. Av. Principal 123"
                  compact
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono del local</label>
                <input
                  type="text"
                  value={nuevoLocalManual.telefono}
                  onChange={(e) => setNuevoLocalManual((p) => ({ ...p, telefono: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  placeholder="+593 ..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tiempo estimado</label>
                <input
                  type="text"
                  value={nuevoLocalManual.time}
                  onChange={(e) => setNuevoLocalManual((p) => ({ ...p, time: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  placeholder="25-35 min"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Logo (opcional)</label>
                  <input ref={nuevoLocalLogoRef} type="file" accept="image/*" className="hidden" onChange={handleNuevoLocalLogo} />
                  <button
                    type="button"
                    onClick={() => nuevoLocalLogoRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-rojo-andino hover:text-rojo-andino text-sm"
                  >
                    <Camera className="w-4 h-4" />
                    {nuevoLocalManual.logo ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Banner (opcional)</label>
                  <input ref={nuevoLocalCoverRef} type="file" accept="image/*" className="hidden" onChange={handleNuevoLocalCover} />
                  <button
                    type="button"
                    onClick={() => nuevoLocalCoverRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-rojo-andino hover:text-rojo-andino text-sm"
                  >
                    <Camera className="w-4 h-4" />
                    {nuevoLocalManual.cover ? 'Cambiar banner' : 'Subir banner'}
                  </button>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Registro interno (credenciales para el dueño)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Correo (acceso al panel)</label>
                    <input
                      type="email"
                      value={nuevoLocalManual.ownerEmail}
                      onChange={(e) => setNuevoLocalManual((p) => ({ ...p, ownerEmail: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                      placeholder="dueño@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña inicial (mín. 6)</label>
                    <input
                      type="text"
                      value={nuevoLocalManual.ownerPassword}
                      onChange={(e) => setNuevoLocalManual((p) => ({ ...p, ownerPassword: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                      placeholder="123456"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del dueño</label>
                    <input
                      type="text"
                      value={nuevoLocalManual.ownerName}
                      onChange={(e) => setNuevoLocalManual((p) => ({ ...p, ownerName: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                      placeholder="Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono del dueño</label>
                    <input
                      type="text"
                      value={nuevoLocalManual.ownerPhone}
                      onChange={(e) => setNuevoLocalManual((p) => ({ ...p, ownerPhone: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                      placeholder="+593 ..."
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={creandoLocalManual}
                className="w-full py-3.5 rounded-xl bg-rojo-andino text-white font-bold text-base hover:bg-rojo-andino/90 disabled:opacity-70 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-rojo-andino/20"
              >
                {creandoLocalManual ? <Loader2 className="w-5 h-5 animate-spin" /> : <Store className="w-5 h-5" />}
                {creandoLocalManual ? 'Creando...' : 'Crear local'}
              </button>
            </form>
            )}
          </div>
        </section>

        {/* Locales */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-rojo-andino" />
              Locales
              <span className="text-gray-500 font-normal text-base">({locales.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMigrarModal(true)}
                disabled={migrandoLocales}
                className="px-3 py-2 rounded-xl bg-amber-100 text-amber-800 text-xs font-semibold hover:bg-amber-200 disabled:opacity-60 flex items-center gap-1.5 transition-colors"
                title="Migrar locales del archivo a la base de datos (ejecutar una sola vez)"
              >
                {migrandoLocales ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Migrar desde archivo
              </button>
              <button
                type="button"
                onClick={refreshLocales}
                disabled={localesLoading}
                className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-60 transition-colors"
                title="Actualizar lista"
              >
                <RefreshCw className={`w-4 h-4 ${localesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {localesLoading ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Loader2 className="w-8 h-8 animate-spin text-rojo-andino/50 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Cargando locales...</p>
            </div>
          ) : locales.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="font-bold text-gray-400">No hay locales</p>
              <p className="text-sm text-gray-400 mt-1">Creá uno desde el formulario de arriba.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {localesPaginados.map((loc) => {
                const isSuspended = loc.status === 'suspended';
                const solAprobada = solicitudes.find((s) => s.localId === loc.id && s.status === 'approved');
                const waPhone = solAprobada?.telefonoLocal?.replace(/\D/g, '') || loc.telefono?.replace(/\D/g, '');
                return (
                  <div
                    key={loc.id}
                    className={`bg-white rounded-2xl p-4 shadow-sm border transition-shadow hover:shadow-md flex flex-col sm:flex-row sm:items-center gap-4 ${isSuspended ? 'border-red-100 opacity-80' : 'border-gray-100'}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <LocaleLogoWithFallback logo={loc.logo} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 truncate">{loc.name}</p>
                          {isSuspended && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Suspendido</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-mono">{loc.id}</p>
                        {loc.address && <p className="text-xs text-gray-400 truncate mt-0.5">{loc.address}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => router.push(`/panel/restaurante/${loc.id}`)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rojo-andino text-white text-xs font-semibold hover:bg-rojo-andino/90 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Panel
                      </button>
                      {waPhone && (
                        <a
                          href={`https://wa.me/593${waPhone.replace(/^0/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEditarLocal(loc)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={borrandoId === loc.id}
                        onClick={() => setConfirmarAccionLocal({ tipo: 'borrar', localId: loc.id, nombre: loc.name })}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 transition-colors disabled:opacity-60"
                      >
                        {borrandoId === loc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Borrar
                      </button>
                      <button
                        type="button"
                        disabled={suspendandoId === loc.id}
                        onClick={() => setConfirmarAccionLocal({ tipo: 'suspender', localId: loc.id, nombre: loc.name, suspended: !isSuspended })}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 ${
                          isSuspended
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {suspendandoId === loc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isSuspended ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : (
                          <Ban className="w-3.5 h-3.5" />
                        )}
                        {isSuspended ? 'Reactivar' : 'Suspender'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {localesOrdenados.length > LOCALES_POR_PAGINA && (
                <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100 mt-4">
                  <p className="text-sm text-gray-500">
                    Mostrando {desdeLocales}–{hastaLocales} de {localesOrdenados.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLocalesPaginaActual((p) => Math.max(1, p - 1))}
                      disabled={localesPaginaActual <= 1}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Anterior
                    </button>
                    <span className="text-sm text-gray-600 font-medium">
                      Página {localesPaginaActual} de {totalPaginasLocales}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLocalesPaginaActual((p) => Math.min(totalPaginasLocales, p + 1))}
                      disabled={localesPaginaActual >= totalPaginasLocales}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        </>
        )}

        {seccionActiva === 'publicidad' && (
        <>
        <section>
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2 mb-3">
            <ImageIcon className="w-5 h-5 text-dorado-oro" />
            Banners de publicidad
          </h2>
          <p className="text-sm text-gray-500 mb-3">
            Los banners se muestran en el carrusel de la home. Puedes vender espacio a anunciantes externos (odontólogo, spa, etc.). Solo los activos se muestran a los usuarios.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
            Imagen en relación <strong>3:1</strong> (recomendado <strong>1200×400 px</strong>). Se mostrará recortada para ajustarse al carrusel.
          </p>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
            <h3 className="font-bold text-gray-900 text-sm mb-2">Intervalo del carrusel</h3>
            <p className="text-xs text-gray-500 mb-3">Cada cuántos segundos cambia la foto en la home (2–60).</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={2}
                max={60}
                value={carruselIntervalSeconds}
                onChange={(e) => setCarruselIntervalSeconds(Math.min(60, Math.max(2, Number(e.target.value) || 4)))}
                className="w-20 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
              />
              <span className="text-sm text-gray-600">segundos</span>
              <button
                type="button"
                onClick={guardarIntervaloCarrusel}
                disabled={carruselIntervalSaving}
                className="px-4 py-2 rounded-xl bg-rojo-andino text-white text-sm font-semibold hover:bg-rojo-andino/90 disabled:opacity-70 flex items-center gap-2"
              >
                {carruselIntervalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar intervalo
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
            <h3 className="font-bold text-gray-900 text-sm mb-3">{editBannerId ? 'Editar banner' : 'Nuevo banner'}</h3>
            <form onSubmit={guardarBanner} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Imagen</label>
                <input ref={bannerImageRef} type="file" accept="image/*" className="hidden" onChange={handleBannerImageUpload} />
                <button
                  type="button"
                  onClick={() => bannerImageRef.current?.click()}
                  disabled={bannerUploading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-rojo-andino hover:text-rojo-andino text-sm disabled:opacity-70"
                >
                  {bannerUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {bannerUploading ? 'Subiendo...' : bannerForm.imageUrl ? 'Cambiar imagen' : 'Subir imagen'}
                </button>
                {bannerForm.imageUrl && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 relative" style={{ aspectRatio: '3/1', maxHeight: 120 }}>
                    {getSafeImageSrc(bannerForm.imageUrl) ? (
                      <Image
                        src={getSafeImageSrc(bannerForm.imageUrl)!}
                        alt="Vista previa"
                        fill
                        sizes="(max-width: 768px) 100vw, 640px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Imagen no válida</div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Texto alternativo (accesibilidad)</label>
                <input
                  type="text"
                  value={bannerForm.alt}
                  onChange={(e) => setBannerForm((f) => ({ ...f, alt: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  placeholder="Ej. Promo restaurantes"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Al hacer clic</label>
                <select
                  value={bannerForm.linkType}
                  onChange={(e) => setBannerForm((f) => ({ ...f, linkType: e.target.value as 'category' | 'route' | 'url' }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                >
                  <option value="category">Ir a categoría (Restaurantes, Market, Farmacias)</option>
                  <option value="route">Ruta interna (ej. /express)</option>
                  <option value="url">URL externa (abre en nueva pestaña)</option>
                </select>
              </div>
              {bannerForm.linkType === 'category' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
                  <select
                    value={bannerForm.linkValue}
                    onChange={(e) => setBannerForm((f) => ({ ...f, linkValue: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  >
                    <option value="Restaurantes">Restaurantes</option>
                    <option value="Market">Market</option>
                    <option value="Farmacias">Farmacias</option>
                  </select>
                </div>
              )}
              {bannerForm.linkType === 'route' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ruta</label>
                  <input
                    type="text"
                    value={bannerForm.linkValue}
                    onChange={(e) => setBannerForm((f) => ({ ...f, linkValue: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                    placeholder="/express"
                  />
                </div>
              )}
              {bannerForm.linkType === 'url' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL</label>
                  <input
                    type="url"
                    value={bannerForm.linkValue}
                    onChange={(e) => setBannerForm((f) => ({ ...f, linkValue: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                    placeholder="https://..."
                  />
                </div>
              )}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Orden (menor = primero)</label>
                  <input
                    type="number"
                    min={0}
                    value={bannerForm.order}
                    onChange={(e) => setBannerForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  />
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <input
                    type="checkbox"
                    id="banner-active"
                    checked={bannerForm.active}
                    onChange={(e) => setBannerForm((f) => ({ ...f, active: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="banner-active" className="text-sm font-medium text-gray-700">Activo (visible en la app)</label>
                </div>
              </div>
              <div className="flex gap-2">
                {editBannerId && (
                  <button
                    type="button"
                    onClick={() => { setEditBannerId(null); setBannerForm({ imageUrl: '', alt: '', linkType: 'route', linkValue: '/express', order: 0, active: true }); }}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={bannerSaving}
                  className="flex-1 py-2.5 rounded-xl bg-rojo-andino text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {bannerSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {bannerSaving ? 'Guardando...' : editBannerId ? 'Actualizar' : 'Crear banner'}
                </button>
              </div>
            </form>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Banners actuales</h3>
            {bannersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              </div>
            ) : bannersList.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No hay banners. Creá uno arriba.</p>
            ) : (
              <ul className="space-y-3">
                {bannersList.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                    <div className="w-24 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 relative" style={{ aspectRatio: '3/1' }}>
                      {getSafeImageSrc(b.imageUrl) ? (
                        <Image
                          src={getSafeImageSrc(b.imageUrl)!}
                          alt={b.alt}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Sin imagen</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.alt || 'Sin texto'}</p>
                      <p className="text-xs text-gray-500">{b.linkType} → {b.linkValue}</p>
                      {b.active === false && <span className="text-xs text-amber-600 font-medium">Inactivo</span>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditBannerId(b.id);
                          setBannerForm({
                            imageUrl: b.imageUrl,
                            alt: b.alt,
                            linkType: b.linkType as 'category' | 'route' | 'url',
                            linkValue: b.linkValue,
                            order: b.order,
                            active: b.active !== false,
                          });
                        }}
                        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEliminarBannerId(b.id)}
                        className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        </>
        )}

      </div>

      {/* Modal confirmar borrar/suspender local */}
      {confirmarAccionLocal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setConfirmarAccionLocal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg text-gray-900 mb-2">¿Estás seguro?</h3>
            {confirmarAccionLocal.tipo === 'borrar' ? (
              <>
                <p className="text-gray-600 text-sm mb-4">
                  Se eliminará el local <strong>{confirmarAccionLocal.nombre}</strong> de la lista. Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmarAccionLocal(null)}
                    className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmarAccionLocal && handleBorrarLocal(confirmarAccionLocal.localId)}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600"
                  >
                    Sí, borrar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 text-sm mb-4">
                  {confirmarAccionLocal.suspended ? (
                    <>Se suspenderá el local <strong>{confirmarAccionLocal.nombre}</strong>. No recibirá pedidos hasta que lo reactives.</>
                  ) : (
                    <>Se reactivará el local <strong>{confirmarAccionLocal.nombre}</strong>. Volverá a recibir pedidos.</>
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmarAccionLocal(null)}
                    className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      confirmarAccionLocal &&
                      handleSuspender(confirmarAccionLocal.localId, confirmarAccionLocal.suspended ?? false)
                    }
                    className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm ${
                      confirmarAccionLocal?.suspended ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {confirmarAccionLocal?.suspended ? 'Sí, suspender' : 'Sí, reactivar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal editar local */}
      {editandoLocal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !guardandoLocal && setEditandoLocal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg text-gray-900 mb-4">Editar local</h3>
            <form onSubmit={handleGuardarLocal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                <input
                  type="text"
                  value={editLocalForm.name}
                  onChange={(e) => setEditLocalForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  placeholder="Nombre del local"
                  required
                />
              </div>
              <div>
                <CampoUbicacionConMapa
                  value={editLocalForm.address}
                  onChange={(v) => setEditLocalForm((f) => ({ ...f, address: v }))}
                  onCoordsChange={(newLat, newLng) => setEditLocalForm((f) => ({ ...f, lat: newLat, lng: newLng }))}
                  initialLat={editLocalForm.lat}
                  initialLng={editLocalForm.lng}
                  label="Dirección"
                  placeholder="Ej. Av. Principal 123"
                  compact
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                <input
                  type="text"
                  value={editLocalForm.telefono}
                  onChange={(e) => setEditLocalForm((f) => ({ ...f, telefono: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  placeholder="Teléfono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tiempo estimado</label>
                <input
                  type="text"
                  value={editLocalForm.time}
                  onChange={(e) => setEditLocalForm((f) => ({ ...f, time: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                  placeholder="Ej: 20-30 min"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-bold text-gray-500 uppercase">Local destacado</span>
                <button
                  type="button"
                  onClick={() => setEditLocalForm((f) => ({ ...f, isFeatured: !f.isFeatured }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors ${
                    editLocalForm.isFeatured ? 'bg-amber-400 border-amber-400' : 'bg-gray-200 border-gray-200'
                  }`}
                  aria-pressed={editLocalForm.isFeatured}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      editLocalForm.isFeatured ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Logo y banner</p>
                <div className="flex gap-2 flex-wrap">
                  <input ref={editLocalLogoRef} type="file" accept="image/*" className="hidden" onChange={handleEditLocalLogo} />
                  <input ref={editLocalCoverRef} type="file" accept="image/*" className="hidden" onChange={handleEditLocalCover} />
                  <button
                    type="button"
                    onClick={() => editLocalLogoRef.current?.click()}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    {editLocalForm.logo ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => editLocalCoverRef.current?.click()}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    {editLocalForm.cover ? 'Cambiar banner' : 'Subir banner'}
                  </button>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3">Opcional. Asigna credenciales para que el local acceda al panel.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo</label>
                    <input
                      type="email"
                      value={editLocalForm.email}
                      onChange={(e) => setEditLocalForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                      placeholder="local@correo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña (mín. 6 caracteres)</label>
                    <PasswordInput
                      value={editLocalForm.password}
                      onChange={(e) => setEditLocalForm((f) => ({ ...f, password: e.target.value }))}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-rojo-andino"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditandoLocal(null)}
                  disabled={guardandoLocal}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoLocal}
                  className="flex-1 py-2.5 rounded-xl bg-rojo-andino text-white font-bold disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {guardandoLocal ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {guardandoLocal ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    <ModalCerrarSesion
      open={showLogoutModal}
      onClose={() => setShowLogoutModal(false)}
      onConfirm={() => {
        setShowLogoutModal(false);
        logout().then(() => router.replace('/auth'));
      }}
    />

    {eliminarBannerId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
          <h2 className="font-black text-gray-900 text-lg mb-2">Eliminar banner</h2>
          <p className="text-sm text-gray-600 mb-4">¿Eliminar este banner?</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEliminarBannerId(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => eliminarBanner(eliminarBannerId)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    )}

    {showMigrarModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
          <h2 className="font-black text-gray-900 text-lg mb-2">Migrar locales</h2>
          <p className="text-sm text-gray-600 mb-4">
            ¿Migrar todos los locales del archivo a la base de datos? Solo ejecutar una vez.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowMigrarModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleMigrarLocales()}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700"
            >
              Migrar
            </button>
          </div>
        </div>
      </div>
    )}
    </main>
  );
}
