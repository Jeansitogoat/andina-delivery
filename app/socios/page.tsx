'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  X,
  Store,
  Users,
  BarChart2,
  FileText,
  ChevronDown,
  ChevronUp,
  Camera,
  MessageCircle,
  CheckCircle2,
  ClipboardList,
  Smartphone,
} from 'lucide-react';
import { compressImage } from '@/lib/compressImage';
import { getSafeImageSrc } from '@/lib/validImageUrl';
import { uploadSolicitudLogo, uploadSolicitudBanner, uploadSolicitudMenuFoto } from '@/lib/storageUpload';

const WHATSAPP_NUMERO = process.env.NEXT_PUBLIC_WHATSAPP_SOCIOS || '593983511866';	
const MENSAJE_WHATSAPP = 'Hola, vengo de Andina y quiero registrar mi negocio.';

const TIPOS_NEGOCIO = [
  { value: 'Restaurante', label: 'Restaurante' },
  { value: 'Café', label: 'Café' },
  { value: 'Market', label: 'Market' },
  { value: 'Farmacia', label: 'Farmacia' },
  { value: 'Otro', label: 'Otro' },
];

function getWhatsAppLink(): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(MENSAJE_WHATSAPP)}`;
}

export default function SociosPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [documentsOpen, setDocumentsOpen] = useState(false);

  const [nombreLocal, setNombreLocal] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('+593 ');
  const [telefonoLocal, setTelefonoLocal] = useState('+593 ');
  const [direccion, setDireccion] = useState('');
  const [tipoNegocio, setTipoNegocio] = useState('Restaurante');
  const [localACalle, setLocalACalle] = useState<boolean>(true);
  // Fase 1: almacenar URLs de Storage en lugar de Base64
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [menuFotosUrls, setMenuFotosUrls] = useState<string[]>([]);
  const [menuFotosPreviews, setMenuFotosPreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  // tempId para rutas de Storage (se genera al inicio y se mantiene durante la sesión)
  const [solicitudTempId] = useState(() => `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const menuInputRef = useRef<HTMLInputElement>(null);

  const MAX_MENU_FOTOS = 3;

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImages(true);
    try {
      // Mostrar preview inmediato con blob URL
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
      // Subir a Storage
      const url = await uploadSolicitudLogo(solicitudTempId, file);
      setLogoUrl(url);
    } catch {
      // Fallback: mostrar preview sin URL de Storage
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setUploadingImages(false);
    }
    e.target.value = '';
  }

  async function handleBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImages(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      setBannerPreview(previewUrl);
      const url = await uploadSolicitudBanner(solicitudTempId, file);
      setBannerUrl(url);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setUploadingImages(false);
    }
    e.target.value = '';
  }

  async function handleMenuFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setUploadingImages(true);
    try {
      const currentCount = menuFotosUrls.length;
      const toUpload = imageFiles.slice(0, MAX_MENU_FOTOS - currentCount);
      const results = await Promise.all(
        toUpload.map(async (file, i) => {
          const preview = URL.createObjectURL(file);
          try {
            const url = await uploadSolicitudMenuFoto(solicitudTempId, currentCount + i, file);
            return { url, preview };
          } catch {
            return { url: null, preview };
          }
        })
      );
      const urls = results.map((r) => r.url ?? '');
      const previews = results.map((r) => r.preview);
      setMenuFotosUrls((prev) => [...prev, ...urls].slice(0, MAX_MENU_FOTOS));
      setMenuFotosPreviews((prev) => [...prev, ...previews].slice(0, MAX_MENU_FOTOS));
    } catch {
      // silencioso
    } finally {
      setUploadingImages(false);
    }
    e.target.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (
      !nombreLocal.trim() ||
      !nombre.trim() ||
      !apellido.trim() ||
      !email.trim() ||
      !telefono.trim() ||
      !telefonoLocal.trim() ||
      !direccion.trim()
    ) {
      setError('Completá todos los campos obligatorios.');
      return;
    }
    // Fase 1: enviar URLs de Storage en lugar de Base64
    const payload = {
      nombreLocal: nombreLocal.trim(),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim(),
      telefono: telefono.trim(),
      telefonoLocal: telefonoLocal.trim(),
      direccion: direccion.trim(),
      tipoNegocio,
      localACalle,
      logoUrl: logoUrl || undefined,
      bannerUrl: bannerUrl || undefined,
      menuFotosUrls: menuFotosUrls.filter(Boolean).length ? menuFotosUrls.filter(Boolean) : undefined,
    };
    setSending(true);
    try {
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la solicitud.');
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-rojo-andino text-white px-4 pt-10 pb-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="bg-dorado-oro text-gray-900 font-bold px-2.5 py-1 rounded-lg">ANDINA</span>
            <div className="w-10" />
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">¡Registro exitoso!</h2>
          <p className="text-gray-600 text-sm mb-6">
            Recibimos tu solicitud. Revisaremos tu información y te contactaremos por WhatsApp para completar el proceso.
          </p>
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 w-full justify-center py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Contactar por WhatsApp
          </a>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-4 text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col pb-10">
      <header className="bg-rojo-andino text-white px-4 pt-10 pb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="bg-dorado-oro text-gray-900 font-black px-3 py-1.5 rounded-xl">Andina</span>
        </div>
        <h1 className="text-xl font-bold text-center">Únete a Andina</h1>
      </header>

      {/* Hero / beneficios */}
      <section className="px-4 -mt-2">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-rojo-andino/90 to-rojo-andino text-white min-h-[140px] flex flex-col justify-end p-5 shadow-lg">
          <div className="absolute inset-0 bg-[url('/food/food-pollo-brasa-mitad.png')] bg-cover bg-center opacity-30" />
          <div className="relative z-10">
            <h2 className="text-lg font-bold mb-1">Un nuevo canal para vender más</h2>
            <p className="text-white/90 text-sm">Llegá a más clientes en Piñas y gestioná tus pedidos desde un solo panel.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { icon: Users, text: 'Más clientes' },
            { icon: BarChart2, text: 'Panel de pedidos' },
            { icon: Store, text: 'Visibilidad en la app' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
              <Icon className="w-5 h-5 text-rojo-andino mx-auto mb-1" />
              <p className="text-xs font-medium text-gray-700">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Banda oferta */}
      <div className="mx-4 mt-4 px-4 py-3 bg-amber-400 text-gray-900 rounded-xl text-center font-semibold text-sm">
        Registrá tu local y empezá a vender
      </div>

      {/* Formulario */}
      <section className="px-4 mt-6">
        <h3 className="font-bold text-gray-900 mb-4">Registrá tu local</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del local *</label>
            <input
              type="text"
              value={nombreLocal}
              onChange={(e) => setNombreLocal(e.target.value)}
              placeholder="Ej. Mi Restaurante"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
              <input
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de negocio *</label>
            <select
              value={tipoNegocio}
              onChange={(e) => setTipoNegocio(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            >
              {TIPOS_NEGOCIO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿Es un local a la calle? *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="localACalle"
                  checked={localACalle === true}
                  onChange={() => setLocalACalle(true)}
                  className="text-rojo-andino focus:ring-rojo-andino"
                />
                <span className="text-sm">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="localACalle"
                  checked={localACalle === false}
                  onChange={() => setLocalACalle(false)}
                  className="text-rojo-andino focus:ring-rojo-andino"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+593 ..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono del local *</label>
            <input
              type="tel"
              value={telefonoLocal}
              onChange={(e) => setTelefonoLocal(e.target.value)}
              placeholder="+593 ..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Calle, número, ciudad"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo del local</label>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingImages}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-500 hover:border-rojo-andino hover:text-rojo-andino transition-colors disabled:opacity-60"
            >
              {logoPreview ? (
                <Image
                  src={logoPreview}
                  alt="Logo"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-lg object-cover"
                  unoptimized
                />
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span className="text-sm">{uploadingImages ? 'Subiendo...' : 'Subir logo'}</span>
                </>
              )}
            </button>
          </div>
          {/* Banner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banner / portada</label>
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBanner} />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingImages}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-500 hover:border-rojo-andino hover:text-rojo-andino transition-colors disabled:opacity-60"
            >
              {bannerPreview ? (
                <Image
                  src={bannerPreview}
                  alt="Banner"
                  width={80}
                  height={48}
                  className="h-12 w-20 rounded-lg object-cover"
                  unoptimized
                />
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span className="text-sm">{uploadingImages ? 'Subiendo...' : 'Subir banner'}</span>
                </>
              )}
            </button>
          </div>
          {/* Menú fotos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fotos del menú</label>
            <input ref={menuInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMenuFotos} />
            <button
              type="button"
              onClick={() => menuInputRef.current?.click()}
              disabled={uploadingImages}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-500 hover:border-rojo-andino hover:text-rojo-andino transition-colors disabled:opacity-60"
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm">
                {uploadingImages ? 'Subiendo...' : (menuFotosUrls.length ? `${menuFotosUrls.length}/3 foto(s)` : 'Subir fotos del menú (máx. 3)')}
              </span>
            </button>
            {menuFotosPreviews.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {menuFotosPreviews.map((preview, i) => (
                  <Image key={i} src={preview} alt={`Foto ${i + 1}`} width={56} height={56} className="w-14 h-14 rounded-lg object-cover border border-gray-200" unoptimized />
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={sending || uploadingImages}
            className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 disabled:opacity-70 text-white font-bold shadow-lg transition-colors"
          >
            {sending ? 'Enviando...' : uploadingImages ? 'Subiendo imágenes...' : 'Enviar solicitud'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-4">¿Prefieres contactarnos por WhatsApp?</p>
        <a
          href={getWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-green-500 text-green-700 font-semibold hover:bg-green-50 transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          Contactar por WhatsApp
        </a>
      </section>

      {/* Comenzar a vender es así de simple */}
      <section className="px-4 mt-10">
        <h3 className="font-bold text-gray-900 mb-4">Comenzar a vender es así de simple</h3>
        <div className="space-y-4">
          {[
            { step: 1, icon: ClipboardList, title: 'Registrá y cargá tus datos', desc: 'Completá el formulario con los datos de tu negocio.' },
            { step: 2, icon: FileText, title: 'Validamos tu información', desc: 'Revisamos tu solicitud y te contactamos.' },
            { step: 3, icon: Smartphone, title: 'Activás tu negocio en la app', desc: 'Tu local aparece en Andina y puedes gestionar pedidos desde el panel.' },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="flex gap-4 items-start bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-rojo-andino" />
              </div>
              <div>
                <p className="text-gray-500 text-xs font-medium">Paso {step}</p>
                <p className="font-semibold text-gray-900">{title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Documentos requeridos expandible */}
      <section className="px-4 mt-6 mb-8">
        <button
          type="button"
          onClick={() => setDocumentsOpen(!documentsOpen)}
          className="w-full flex items-center justify-between py-3 px-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50"
        >
          <span className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-rojo-andino" />
            Documentos requeridos
          </span>
          {documentsOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        {documentsOpen && (
          <div className="mt-2 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-rojo-andino font-bold">•</span>
                Imagen o fotos del menú (productos que vendés).
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rojo-andino font-bold">•</span>
                Datos del local: nombre, dirección y teléfono.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rojo-andino font-bold">•</span>
                Contacto del responsable (nombre, email, teléfono).
              </li>
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
