'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signInWithPopup, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import PasswordInput from '@/components/PasswordInput';
import { useAddresses } from '@/lib/addressesContext';
import { useAuth } from '@/lib/useAuth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { getFirestoreDb } from '@/lib/firebase/client';

type Paso = 'login' | 'registro' | 'registro-rider' | 'registro-exitoso' | 'registro-exitoso-rider';

export default function AuthPage() {
  const router = useRouter();
  const { addDireccion } = useAddresses();
  const { user, loading: authLoading, loginWithEmail, registerWithEmail, logout } = useAuth();
  const [paso, setPaso] = useState<Paso>('login');
  const [registro, setRegistro] = useState({
    nombres: '',
    correo: '',
    contraseña: '',
    confirmarContraseña: '',
    celular: '',
    direccion: '',
    referencia: '',
  });
  const [login, setLogin] = useState({ correo: '', contraseña: '' });
  const [registrando, setRegistrando] = useState(false);
  const [logueando, setLogueando] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const registrandoRef = useRef(false);

  const contraseñasNoCoinciden =
    registro.contraseña !== registro.confirmarContraseña && registro.confirmarContraseña.length > 0;
  const errorConfirmar = errorForm || (contraseñasNoCoinciden ? 'Las contraseñas no coinciden' : '');

  // Si ya está logueado, redirigir: clientes al home, otros a su panel (así el botón Atrás no muestra login)
  useEffect(() => {
    if (typeof window === 'undefined' || authLoading || !user) return;
    if (user.rol === 'cliente') {
      router.replace('/');
      return;
    }
    switch (user.rol) {
      case 'central':
        router.replace('/panel/central');
        break;
      case 'rider':
        router.replace('/panel/rider');
        break;
      case 'local':
        router.replace(user.localId ? `/panel/restaurante/${user.localId}` : '/panel/restaurante');
        break;
      case 'maestro':
        router.replace('/panel/maestro');
        break;
      default:
        break;
    }
  }, [authLoading, user, router]);

  // Procesar resultado de signInWithRedirect (Google en móvil)
  useEffect(() => {
    let cancelled = false;
    const auth = getFirebaseAuth();
    getRedirectResult(auth)
      .then(async (result) => {
        if (cancelled || !result?.user) return;
        const firebaseUser = result.user;
        const db = getFirestoreDb();
        const userRef = doc(db, 'users', firebaseUser.uid);
        let snap = await getDoc(userRef);
        if (cancelled) return;
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? null,
            displayName: firebaseUser.displayName ?? null,
            photoURL: firebaseUser.photoURL ?? null,
            rol: 'cliente',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          snap = await getDoc(userRef);
        }
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        const rol = (data?.rol ?? 'cliente') as import('@/lib/useAuth').UserRole;
        const localId = data?.localId;
        redirigirPorRol(rol, localId);
      })
      .catch((err) => {
        if (cancelled) return;
        const e = err as { code?: string };
        if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
        setErrorForm('Error al iniciar con Google. Intenta de nuevo.');
      });
    return () => { cancelled = true; };
  }, []);

  function redirigirPorRol(rol: import('@/lib/useAuth').UserRole, localId?: string | null) {
    switch (rol) {
      case 'central':
        router.push('/panel/central');
        break;
      case 'rider':
        router.push('/panel/rider');
        break;
      case 'local':
        router.push(localId ? `/panel/restaurante/${localId}` : '/panel/restaurante');
        break;
      case 'maestro':
        router.push('/panel/maestro');
        break;
      case 'cliente':
      default:
        router.push('/');
        break;
    }
  }

  function isMobile(): boolean {
    return typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  async function handleGoogle() {
    setErrorForm('');
    setGoogleLoading(true);
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const firebaseUser = result.user;
      const db = getFirestoreDb();
      const userRef = doc(db, 'users', firebaseUser.uid);
      let snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? null,
          displayName: firebaseUser.displayName ?? null,
          photoURL: firebaseUser.photoURL ?? null,
          rol: 'cliente',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        snap = await getDoc(userRef);
      }
      const rol = (snap.exists() ? snap.data()?.rol : 'cliente') as import('@/lib/useAuth').UserRole;
      const localId = snap.exists() ? snap.data()?.localId : undefined;
      redirigirPorRol(rol, localId);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
        setErrorForm('');
      } else {
        setErrorForm(e?.message?.includes('email') ? 'Este correo ya está registrado con otro método. Inicia sesión con tu contraseña.' : 'Error al iniciar con Google. Intenta de nuevo.');
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm('');
    if (!login.correo.trim() || !login.contraseña) return;
    setLogueando(true);
    loginWithEmail(login.correo.trim(), login.contraseña)
      .then((andinaUser) => {
        setLogueando(false);
        redirigirPorRol(andinaUser.rol, andinaUser.localId ?? undefined);
      })
      .catch((err) => {
        console.error(err);
        setLogueando(false);
        setErrorForm('Correo o contraseña incorrectos');
      });
  }

  function mensajeErrorFirebase(err: unknown): string {
    const e = err as { code?: string; message?: string };
    const code = e?.code ?? '';
    const msg = String(e?.message ?? '').toLowerCase();
    if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
      return 'Este correo ya está registrado';
    }
    if (code === 'auth/invalid-email') return 'Correo no válido.';
    if (code === 'auth/weak-password') return 'La contraseña debe tener al menos 6 caracteres.';
    if (code === 'auth/operation-not-allowed') return 'Registro deshabilitado. Contacta al administrador.';
    if (code === 'auth/network-request-failed' || msg.includes('network')) {
      return 'Error de conexión. Verifica tu internet e inténtalo de nuevo.';
    }
    if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
      return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    }
    if (msg.includes('service-is-currently-unavailable') || msg.includes('unavailable')) {
      return 'El servicio está ocupado. Espera unos segundos e inténtalo de nuevo.';
    }
    if (code === 'permission-denied' || msg.includes('permission-denied') || msg.includes('insufficient permissions')) {
      return 'Error de permisos. Intenta recargar la página.';
    }
    if (msg.includes('unsupported field value') || msg.includes('undefined')) {
      return 'Error al guardar los datos. Intenta de nuevo o contacta soporte.';
    }
    return 'Error al registrar. Verifica los datos e inténtalo de nuevo.';
  }

  function isRetryableAuthError(err: unknown): boolean {
    const e = err as { code?: string; message?: string };
    const code = e?.code ?? '';
    const msg = String(e?.message ?? '').toLowerCase();
    return (
      code === 'auth/network-request-failed' ||
      code === 'auth/too-many-requests' ||
      msg.includes('service-is-currently-unavailable') ||
      msg.includes('unavailable')
    );
  }

  function handleRegistro(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm('');
    if (registrandoRef.current) return;
    if (registro.contraseña !== registro.confirmarContraseña) {
      setErrorForm('Las contraseñas no coinciden');
      return;
    }
    if (registro.contraseña.length < 6) {
      setErrorForm('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!registro.nombres.trim() || !registro.correo.trim() || !registro.celular.trim()) return;
    registrandoRef.current = true;
    setRegistrando(true);
    const nombreLimpio = registro.nombres.trim();

    const doRegistro = async (attempt: number): Promise<void> => {
      const params = {
        email: registro.correo.trim(),
        password: registro.contraseña,
        displayName: nombreLimpio,
        telefono: registro.celular.trim(),
        rol: 'cliente' as const,
      };
      try {
        await registerWithEmail(params);
        registrandoRef.current = false;
        setRegistrando(false);
        // Pequeña espera para que el token de auth se propague antes de Firestore
        if (registro.direccion.trim()) {
          await new Promise((r) => setTimeout(r, 400));
          addDireccion({
            etiqueta: 'casa',
            nombre: 'Mi casa',
            detalle: registro.direccion.trim(),
            referencia: registro.referencia.trim() || undefined,
            principal: true,
          });
        }
        setPaso('registro-exitoso');
      } catch (err) {
        if (isRetryableAuthError(err) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500));
          return doRegistro(attempt + 1);
        }
        console.error(err);
        registrandoRef.current = false;
        setRegistrando(false);
        setErrorForm(mensajeErrorFirebase(err));
      }
    };
    doRegistro(0);
  }

  function handleRegistroRider(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm('');
    if (registrandoRef.current) return;
    if (registro.contraseña !== registro.confirmarContraseña) {
      setErrorForm('Las contraseñas no coinciden');
      return;
    }
    if (registro.contraseña.length < 6) {
      setErrorForm('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!registro.nombres.trim() || !registro.correo.trim()) {
      setErrorForm('Nombre y correo son obligatorios');
      return;
    }
    registrandoRef.current = true;
    setRegistrando(true);
    const doRegistroRider = async (attempt: number): Promise<void> => {
      const params = {
        email: registro.correo.trim(),
        password: registro.contraseña,
        displayName: registro.nombres.trim(),
        rol: 'rider' as const,
      };
      try {
        await registerWithEmail(params);
        registrandoRef.current = false;
        setRegistrando(false);
        setPaso('registro-exitoso-rider');
      } catch (err) {
        if (isRetryableAuthError(err) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500));
          return doRegistroRider(attempt + 1);
        }
        console.error(err);
        registrandoRef.current = false;
        setRegistrando(false);
        setErrorForm(mensajeErrorFirebase(err));
      }
    };
    doRegistroRider(0);
  }

  function irALoginConEmail(email: string) {
    setLogin((l) => ({ ...l, correo: email }));
    setErrorForm('');
    setPaso('login');
  }

  // Iniciar sesión: misma interfaz que fotos 3/4 (fondo dorado, logo, formulario integrado)
  if (paso === 'login') {
    return (
      <main
        className="min-h-screen flex flex-col"
        style={{ background: 'linear-gradient(160deg, #c9960d 0%, #a67a08 60%, #7a5606 100%)' }}
      >
        <div className="flex justify-end p-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-white/90 hover:text-white font-semibold text-sm py-2 px-4 rounded-xl hover:bg-white/10 transition-colors"
          >
            Omitir
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center px-6 pb-8">
          <div className="w-32 h-32 relative mb-4">
            <Image
              src="/logo-andina.png"
              alt="Andina"
              fill
              sizes="128px"
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>
          <h1 className="text-white font-black text-3xl text-center mb-1 tracking-tight">Andina</h1>
          <p className="text-white/80 text-sm text-center mb-6">Delivery y mandados en Piñas</p>

          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
            <h2 className="text-lg font-black text-gray-900 mb-1">Iniciar sesión</h2>
            <p className="text-gray-500 text-sm mb-5">Ingresa con tu correo y contraseña</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  value={login.correo}
                  onChange={(e) => setLogin((l) => ({ ...l, correo: e.target.value }))}
                  placeholder="tu@correo.com"
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Contraseña</label>
                <PasswordInput
                  value={login.contraseña}
                  onChange={(e) => setLogin((l) => ({ ...l, contraseña: e.target.value }))}
                  placeholder="Tu contraseña"
                  className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
                  required
                />
              </div>
              {errorForm && <p className="text-xs text-red-500 font-medium">{errorForm}</p>}
              <button
                type="submit"
                disabled={logueando}
                className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold disabled:opacity-70 flex items-center justify-center gap-2 transition-colors"
              >
                {logueando ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {logueando ? 'Iniciando sesión...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleGoogle()}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white border-2 border-gray-200 text-gray-800 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-70"
              >
                {googleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {googleLoading ? 'Conectando...' : 'Continuar con Google'}
              </button>
            </div>

            <p className="text-center text-gray-500 text-sm mt-5">
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => { setErrorForm(''); setPaso('registro'); }}
                className="text-rojo-andino font-bold hover:underline"
              >
                Regístrate como cliente
              </button>
            </p>
            <p className="text-center text-gray-500 text-xs mt-2">
              <button
                type="button"
                onClick={() => { setErrorForm(''); setPaso('registro-rider'); }}
                className="text-gray-600 font-semibold hover:underline"
              >
                Soy motorizado / rider – crear cuenta
              </button>
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Registro como rider (Central debe validar para usar el panel)
  if (paso === 'registro-rider') {
    return (
      <main
        className="min-h-screen flex flex-col"
        style={{ background: 'linear-gradient(160deg, #c9960d 0%, #a67a08 60%, #7a5606 100%)' }}
      >
        <header className="p-4">
          <button
            type="button"
            onClick={() => setPaso('login')}
            className="flex items-center gap-2 text-white/90 hover:text-white font-semibold"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
        </header>
        <div className="flex-1 px-4 py-4 max-w-md mx-auto w-full pb-8">
          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <div className="mb-4 px-3 py-2 rounded-xl bg-amber-100 border border-amber-300">
              <p className="text-xs font-bold text-amber-800 uppercase">Motorizado / Rider</p>
            </div>
            <h1 className="text-xl font-black text-gray-900 mb-1">Crear cuenta de rider</h1>
            <p className="text-gray-500 text-sm mb-4">
              La Central Virgen de la Merced validará tu cuenta. Podrás usar el panel de riders cuando te aprueben.
            </p>

            <form onSubmit={handleRegistroRider} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Nombres</label>
                <input
                  type="text"
                  value={registro.nombres}
                  onChange={(e) => setRegistro((r) => ({ ...r, nombres: e.target.value }))}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  value={registro.correo}
                  onChange={(e) => setRegistro((r) => ({ ...r, correo: e.target.value }))}
                  placeholder="tu@correo.com"
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Contraseña</label>
                <PasswordInput
                  value={registro.contraseña}
                  onChange={(e) => setRegistro((r) => ({ ...r, contraseña: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Confirmar contraseña</label>
                <PasswordInput
                  value={registro.confirmarContraseña}
                  onChange={(e) => setRegistro((r) => ({ ...r, confirmarContraseña: e.target.value }))}
                  onBlur={() => contraseñasNoCoinciden && setErrorForm('')}
                  placeholder="Repite tu contraseña"
                  className={`px-4 py-3.5 rounded-2xl border-2 focus:outline-none focus:ring-2 transition-colors ${
                    errorConfirmar ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:border-dorado-oro focus:ring-dorado-oro/20'
                  }`}
                  required
                />
                {errorConfirmar ? (
                  <div className="space-y-1">
                    <p className="text-xs text-red-500 font-medium">{errorConfirmar}</p>
                    {errorForm.includes('ya está registrado') && (
                      <button
                        type="button"
                        onClick={() => irALoginConEmail(registro.correo.trim())}
                        className="text-xs font-bold text-rojo-andino hover:underline"
                      >
                        Ir a iniciar sesión con este correo
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={registrando}
                className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold disabled:opacity-70 flex items-center justify-center gap-2 transition-colors"
              >
                {registrando ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {registrando ? 'Creando cuenta...' : 'Crear cuenta de rider'}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // Pantalla éxito registro cliente
  if (paso === 'registro-exitoso') {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(160deg, #c9960d 0%, #a67a08 60%, #7a5606 100%)' }}
      >
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">¡Registro exitoso!</h1>
          <p className="text-gray-600 mb-6">
            Tu cuenta está lista. Ya podés pedir en restaurantes, market y farmacias de Piñas.
          </p>
          <button
            type="button"
            onClick={() => {
              logout().then(() => {
                irALoginConEmail(registro.correo.trim());
              });
            }}
            className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold transition-colors"
          >
            Iniciar sesión
          </button>
        </div>
      </main>
    );
  }

  // Pantalla éxito registro rider: La Central validará sus datos
  if (paso === 'registro-exitoso-rider') {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(160deg, #c9960d 0%, #a67a08 60%, #7a5606 100%)' }}
      >
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">¡Registro exitoso!</h1>
          <p className="text-gray-600 mb-4">
            La Central validará tus datos. Cuando te aprueben, podrás iniciar sesión y acceder al panel de riders.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Si entrás antes, verás que tu cuenta está pendiente de aprobación.
          </p>
          <button
            type="button"
            onClick={() => {
              logout().then(() => {
                irALoginConEmail(registro.correo.trim());
              });
            }}
            className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold transition-colors"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => redirigirPorRol('rider')}
            className="w-full mt-3 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
          >
            Ir al panel de riders
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full mt-3 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
          >
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  // Formulario de registro (mismo estilo: fondo dorado, card blanca)
  if (paso === 'registro') {
    return (
      <main
        className="min-h-screen flex flex-col"
        style={{ background: 'linear-gradient(160deg, #c9960d 0%, #a67a08 60%, #7a5606 100%)' }}
      >
        <header className="p-4">
          <button
            type="button"
            onClick={() => setPaso('login')}
            className="flex items-center gap-2 text-white/90 hover:text-white font-semibold"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
        </header>
        <div className="flex-1 px-4 py-4 max-w-md mx-auto w-full pb-8">
          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <div className="mb-4 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-xs font-bold text-blue-800 uppercase">Cliente (pedir delivery)</p>
            </div>
            <h1 className="text-xl font-black text-gray-900 mb-1">Crear cuenta</h1>
            <p className="text-gray-500 text-sm mb-6">Completa tus datos para pedir delivery a domicilio</p>

            <form onSubmit={handleRegistro} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Nombres</label>
              <input
                type="text"
                value={registro.nombres}
                onChange={(e) => setRegistro((r) => ({ ...r, nombres: e.target.value }))}
                placeholder="Ej. Juan Pérez"
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={registro.correo}
                onChange={(e) => setRegistro((r) => ({ ...r, correo: e.target.value }))}
                placeholder="tu@correo.com"
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Contraseña</label>
              <PasswordInput
                value={registro.contraseña}
                onChange={(e) => setRegistro((r) => ({ ...r, contraseña: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Confirmar contraseña</label>
              <PasswordInput
                value={registro.confirmarContraseña}
                onChange={(e) => setRegistro((r) => ({ ...r, confirmarContraseña: e.target.value }))}
                onBlur={() => contraseñasNoCoinciden && setErrorForm('')}
                placeholder="Repite tu contraseña"
              className={`px-4 py-3.5 rounded-2xl border-2 focus:outline-none focus:ring-2 transition-colors ${
                    errorConfirmar ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:border-dorado-oro focus:ring-dorado-oro/20'
                  }`}
                required
              />
                {errorConfirmar ? (
                  <div className="space-y-1 mt-1">
                    <p className="text-xs text-red-500 font-medium">{errorConfirmar}</p>
                    {errorForm.includes('ya está registrado') && (
                      <button
                        type="button"
                        onClick={() => irALoginConEmail(registro.correo.trim())}
                        className="text-xs font-bold text-rojo-andino hover:underline"
                      >
                        Ir a iniciar sesión con este correo
                      </button>
                    )}
                  </div>
                ) : null}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Celular</label>
              <input
                type="tel"
                value={registro.celular}
                onChange={(e) => setRegistro((r) => ({ ...r, celular: e.target.value }))}
                placeholder="09X XXX XXXX"
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Dirección (Piñas)</label>
              <input
                type="text"
                value={registro.direccion}
                onChange={(e) => setRegistro((r) => ({ ...r, direccion: e.target.value }))}
                placeholder="Calle, sector, referencia"
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Referencia para entregas</label>
              <input
                type="text"
                value={registro.referencia}
                onChange={(e) => setRegistro((r) => ({ ...r, referencia: e.target.value }))}
                placeholder="Ej. Casa azul, al lado del parque"
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-dorado-oro focus:ring-2 focus:ring-dorado-oro/20 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={registrando}
              className="w-full py-4 rounded-2xl bg-rojo-andino hover:bg-rojo-andino/90 text-white font-bold disabled:opacity-70 flex items-center justify-center gap-2 transition-colors"
            >
              {registrando ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {registrando ? 'Creando cuenta...' : 'Registrarme'}
            </button>
          </form>
          </div>
        </div>
      </main>
    );
  }

  // Fallback: nunca alcanzado si paso es válido
  return null;
}
