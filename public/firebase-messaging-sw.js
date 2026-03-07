/* Service worker para FCM. Generado desde variables de entorno - no editar a mano. */
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyABbS20ODiQN92mM_9kZTGzBP8SPYd4QXg',
  authDomain: 'andinaapp.firebaseapp.com',
  projectId: 'andinaapp',
  storageBucket: 'andinaapp.firebasestorage.app',
  messagingSenderId: '507282914962',
  appId: '1:507282914962:web:049a93c5311691f275704b',
  measurementId: 'G-336GZVVPSB',
});

const messaging = firebase.messaging();

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

messaging.onBackgroundMessage(function (payload) {
  const title = payload.notification?.title || payload.data?.title || 'Andina Delivery';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/logo-andina.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

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
