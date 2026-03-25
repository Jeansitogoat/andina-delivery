/**
 * Genera public/firebase-messaging-sw.js desde variables de entorno.
 * Se ejecuta en prebuild para no tener credenciales hardcodeadas.
 * Requiere: NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID
 */
const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
} catch {
  // dotenv opcional en entornos que ya inyectan env
}

const env = (key) => process.env[key] || '';
const apiKey = env('NEXT_PUBLIC_FIREBASE_API_KEY').trim();
const authDomain = env('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN').trim();
const projectId = env('NEXT_PUBLIC_FIREBASE_PROJECT_ID').trim();
const storageBucket = env('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET').trim();
const messagingSenderId = env('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID').trim();
const appId = env('NEXT_PUBLIC_FIREBASE_APP_ID').trim();
const measurementId = env('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID').trim();

if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
  console.error('[generate-firebase-sw] Faltan variables de entorno. Necesitas:');
  console.error('  NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,');
  console.error('  NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,');
  console.error('  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID');
  process.exit(1);
}

const content = `/* Service worker para FCM. Generado desde variables de entorno - no editar a mano. */
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '${apiKey.replace(/'/g, "\\'")}',
  authDomain: '${authDomain.replace(/'/g, "\\'")}',
  projectId: '${projectId.replace(/'/g, "\\'")}',
  storageBucket: '${storageBucket.replace(/'/g, "\\'")}',
  messagingSenderId: '${messagingSenderId.replace(/'/g, "\\'")}',
  appId: '${appId.replace(/'/g, "\\'")}',
  ${measurementId ? `measurementId: '${measurementId.replace(/'/g, "\\'")}',` : ''}
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Inicialización segura de messaging: nunca se llama firebase.messaging() de forma global.
// Si firebase o su módulo de messaging no está disponible (navegadores sin soporte,
// CDN bloqueada, arranque en frío), el SW sigue funcionando sin reventar.
(function initMessaging() {
  try {
    if (typeof firebase === 'undefined') {
      console.error('❌ SW: firebase no definido. Verifica que los importScripts cargaron correctamente.');
      return;
    }
    if (typeof firebase.messaging !== 'function') {
      console.error('❌ SW: firebase.messaging no es una función. El módulo compat de messaging no cargó.');
      return;
    }

    var supported = false;
    try {
      // isSupported puede ser sync (boolean) o async (Promise) según versión
      var isSupResult = firebase.messaging.isSupported();
      if (isSupResult && typeof isSupResult.then === 'function') {
        // Promise: continuar de forma asíncrona
        isSupResult.then(function (yes) {
          if (yes) attachMessaging();
          else console.warn('❌ SW: messaging no soportado en este navegador/contexto.');
        }).catch(function (e) {
          console.error('❌ SW: Error al verificar soporte de messaging:', e);
        });
        return;
      }
      supported = Boolean(isSupResult);
    } catch (e) {
      // isSupported no existe en versiones antiguas → asumir soportado y continuar
      supported = true;
    }

    if (!supported) {
      console.warn('❌ SW: messaging no soportado en este navegador/contexto.');
      return;
    }

    attachMessaging();
  } catch (e) {
    console.error('❌ SW: Error crítico al inicializar messaging:', e);
  }
})();

function attachMessaging() {
  try {
    var messaging = firebase.messaging();
    messaging.onBackgroundMessage(function (payload) {
      var title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || 'Andina Delivery';
      var options = {
        body: (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || '',
        icon: '/logo-andina.png',
        badge: '/logo-andina.png',
        data: payload.data || {},
      };
      self.registration.showNotification(title, options);
    });
    console.log('✅ SW: Registrado y Listo');
  } catch (e) {
    console.error('❌ SW: Error al adjuntar onBackgroundMessage:', e);
  }
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var path = (event.notification.data && event.notification.data.pedidoId)
    ? '/pedido/' + event.notification.data.pedidoId
    : '/';
  var fullUrl = new URL(path, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.registration.scope) === 0 && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
    })
  );
});
`;

const outPath = path.resolve(process.cwd(), 'public', 'firebase-messaging-sw.js');
fs.writeFileSync(outPath, content, 'utf8');
console.log('[generate-firebase-sw] Escrito public/firebase-messaging-sw.js');
