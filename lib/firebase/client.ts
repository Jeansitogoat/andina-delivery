import { getApp, initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Configuración de Firebase para AndinaApp (frontend).
// Lee las credenciales desde variables de entorno públicas NEXT_PUBLIC_FIREBASE_*.
// Esto permite tener distintos proyectos (dev, prod) sin tocar el código.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
} as const;

const isDev = process.env.NODE_ENV === 'development';

function isFailedPrecondition(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  const msg = e instanceof Error ? e.message : String(e);
  return code === 'failed-precondition' || /failed-precondition/i.test(msg);
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function getFirestoreDb(): Firestore {
  if (_db) return _db;
  const app = getFirebaseApp();

  if (typeof window === 'undefined') {
    _db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
    return _db;
  }

  try {
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (e) {
    if (isDev && isFailedPrecondition(e)) {
      console.warn(
        '[Firestore] Persistencia IndexedDB no disponible (p. ej. varias pestañas); usando caché en memoria.',
        e
      );
    }
    try {
      _db = initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
    } catch {
      _db = getFirestore(app);
    }
  }

  return _db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (_storage) return _storage;
  _storage = getStorage(getFirebaseApp());
  return _storage;
}
