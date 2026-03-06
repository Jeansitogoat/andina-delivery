/* Service worker para FCM (Firebase Cloud Messaging). Misma config que lib/firebase/client.ts */
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

messaging.onBackgroundMessage(function (payload) {
  const title = payload.notification?.title || payload.data?.title || 'Andina Delivery';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/favicon.ico',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});
