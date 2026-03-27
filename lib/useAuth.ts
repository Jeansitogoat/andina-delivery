'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb } from './firebase/client';
import { getIdToken } from './authToken';

export type UserRole = 'cliente' | 'central' | 'rider' | 'local' | 'maestro';

export type RiderStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export interface AndinaUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  /** Teléfono del usuario (para entregas) */
  telefono?: string | null;
  /** URL de foto de perfil (Firebase Storage o Auth) */
  photoURL?: string | null;
  rol: UserRole;
  localId?: string | null;
  /** Solo para rol rider: pending hasta que Central valide; approved para usar panel; suspended si Central lo da de baja. */
  riderStatus?: RiderStatus;
  /** Estado manual del rider: disponible | fuera_servicio (ocupado se deduce si tiene carrera activa). */
  estadoRider?: 'disponible' | 'fuera_servicio';
  /** Promedio de calificaciones (riders). */
  ratingPromedio?: number | null;
}

interface UseAuthState {
  user: AndinaUser | null;
  loading: boolean;
}

async function ensureUserDocument(firebaseUser: User): Promise<AndinaUser> {
  const db = getFirestoreDb();
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);

  let data: DocumentData | undefined = snap.data();

  if (!snap.exists()) {
    // No crear el doc aquí: registerWithEmail lo crea con rol y displayName correctos.
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName ?? null,
      photoURL: firebaseUser.photoURL ?? null,
      rol: 'cliente',
    };
  }

  const rol: UserRole = data?.rol ?? 'cliente';
  const riderStatus: RiderStatus | undefined = data?.riderStatus;
  const rawEstado = data?.estadoRider as string | undefined;
  const estadoRider = (rawEstado === 'ausente' ? 'disponible' : rawEstado) as 'disponible' | 'fuera_servicio' | undefined;
  const andinaUser: AndinaUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: data?.displayName ?? firebaseUser.displayName,
    telefono: data?.telefono ?? null,
    photoURL: data?.photoURL ?? firebaseUser.photoURL ?? null,
    rol,
    localId: data?.localId ?? null,
    riderStatus: rol === 'rider' ? (riderStatus ?? 'pending') : undefined,
    estadoRider: rol === 'rider' ? (estadoRider ?? 'disponible') : undefined,
    ratingPromedio: data?.ratingPromedio != null ? Number(data.ratingPromedio) : null,
  };

  return andinaUser;
}

export function useAuth() {
  const [state, setState] = useState<UseAuthState>({ user: null, loading: true });
  const lastEnsureUidRef = useRef<string | null>(null);
  const lastAndinaUserRef = useRef<AndinaUser | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        lastEnsureUidRef.current = null;
        lastAndinaUserRef.current = null;
        setState({ user: null, loading: false });
        return;
      }
      if (firebaseUser.uid === lastEnsureUidRef.current && lastAndinaUserRef.current) {
        setState({ user: lastAndinaUserRef.current, loading: false });
        return;
      }
      try {
        const andinaUser = await ensureUserDocument(firebaseUser);
        lastEnsureUidRef.current = firebaseUser.uid;
        lastAndinaUserRef.current = andinaUser;
        setState({ user: andinaUser, loading: false });
      } catch (err) {
        console.error('Error cargando usuario Andina', err);
        setState({ user: null, loading: false });
      }
    });

    return () => unsub();
  }, []);

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<AndinaUser> => {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const andinaUser = await ensureUserDocument(cred.user);
      lastEnsureUidRef.current = cred.user.uid;
      lastAndinaUserRef.current = andinaUser;
      setState({ user: andinaUser, loading: false });

      // Sincronizar custom claims en background para que el prÃ³ximo token incluya el rol.
      // DespuÃ©s refrescamos el token para que las API routes lo vean de inmediato.
      cred.user.getIdToken().then((idToken) => {
        fetch('/api/users/sync-claims', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        })
          .then(() => cred.user.getIdToken(true))
          .catch(() => {});
      }).catch(() => {});

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('andina_visitado', '1');
          if (andinaUser.displayName) {
            localStorage.setItem('andina_usuario_nombre', andinaUser.displayName);
          }
        } catch {
          /* Silencioso en mÃ³vil (modo privado, WebView, etc.) */
        }
      }

      return andinaUser;
    },
    []
  );

  const registerWithEmail = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName?: string;
      telefono?: string;
      rol?: UserRole;
      localId?: string;
    }): Promise<AndinaUser> => {
      // 1. Crear usuario en Auth
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, params.email, params.password);
      const user = cred.user;
      const db = getFirestoreDb();
      const rol: UserRole = params.rol ?? 'cliente';

      const telefonoTrim = params.telefono?.trim() || null;
      const andinaUser: AndinaUser = {
        uid: user.uid,
        email: user.email,
        displayName: params.displayName ?? user.displayName ?? null,
        telefono: telefonoTrim ?? null,
        rol,
        localId: params.localId ?? null,
        riderStatus: rol === 'rider' ? 'pending' : undefined,
      };

      // Firestore no acepta campos con valor undefined; construimos el documento sin ellos.
      const docData: Record<string, unknown> = {
        uid: user.uid,
        email: user.email ?? null,
        displayName: params.displayName ?? user.displayName ?? null,
        rol,
        localId: params.localId ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (telefonoTrim) docData.telefono = telefonoTrim;
      if (rol === 'rider') {
        docData.riderStatus = 'pending';
      }

      // 2. Esperar a que Firestore guarde. Si falla, rollback: eliminar usuario en Auth para poder reintentar.
      try {
        await setDoc(doc(db, 'users', user.uid), docData);
      } catch (err) {
        await deleteUser(user);
        throw err;
      }

      // 3. Sincronizar custom claim (rol) con Firebase Auth para futuras verificaciones sin lectura de Firestore.
      try {
        const idToken = await user.getIdToken();
        await fetch('/api/users/sync-claims', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        // Forzar refresh del token para que el claim estÃ© disponible de inmediato.
        await user.getIdToken(true);
      } catch {
        // No bloquear el registro si falla la sincronizaciÃ³n de claims.
      }

      setState({ user: andinaUser, loading: false });
      lastEnsureUidRef.current = user.uid;
      lastAndinaUserRef.current = andinaUser;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('andina_visitado', '1');
          if (andinaUser.displayName) {
            localStorage.setItem('andina_usuario_nombre', andinaUser.displayName);
          }
        } catch {
          /* Silencioso en mÃ³vil (modo privado, WebView, etc.) */
        }
      }
      return andinaUser;
    },
    []
  );

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    const user = state.user;
    lastEnsureUidRef.current = null;
    lastAndinaUserRef.current = null;
    if (user) {
      const fcmRole =
        user.rol === 'cliente'
          ? 'user'
          : user.rol === 'local'
            ? 'local'
            : user.rol === 'central' || user.rol === 'rider'
              ? user.rol
              : null;
      try {
        const idToken = await getIdToken();
        if (idToken && fcmRole) {
          fetch('/api/fcm/unregister', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ role: fcmRole }),
          }).catch(() => {});
        }
      } catch {
        /* silencioso */
      }
    }
    await signOut(auth);
    setState({ user: null, loading: false });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('andina_visitado');
        localStorage.removeItem('andina_usuario_nombre');
      } catch {
        /* Silencioso en mÃ³vil (modo privado, WebView, etc.) */
      }
    }
  }, [state.user]);

  const refreshUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    try {
      const andinaUser = await ensureUserDocument(firebaseUser);
      lastEnsureUidRef.current = firebaseUser.uid;
      lastAndinaUserRef.current = andinaUser;
      setState((s) => ({ ...s, user: andinaUser }));
      if (typeof window !== 'undefined' && andinaUser.displayName) {
        try {
          localStorage.setItem('andina_usuario_nombre', andinaUser.displayName);
        } catch {
          /* Silencioso en mÃ³vil */
        }
      }
    } catch (err) {
      console.error('Error refrescando usuario', err);
    }
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    loginWithEmail,
    registerWithEmail,
    logout,
    refreshUser,
  };
}


