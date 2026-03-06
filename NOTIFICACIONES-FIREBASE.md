# Notificaciones push con Firebase Cloud Messaging (FCM)

El frontend y el backend están conectados a FCM. Para que las push funcionen en producción solo falta configurar las variables de entorno y la clave VAPID.

---

## Qué está implementado

- **Frontend**
  - `getFCMToken()` en `lib/fcm-client.ts`: obtiene el token FCM con Firebase Messaging y la VAPID key.
  - Service worker `public/firebase-messaging-sw.js`: recibe mensajes en segundo plano y muestra la notificación.
  - Permiso, registro de token en `POST /api/fcm/register` y envío con `sendNotification()` → `POST /api/fcm/send`.

- **Backend**
  - `POST /api/fcm/register`: recibe `{ token, role }` y guarda en `data/fcm-tokens.json` (por token, actualizando `role` y `updatedAt`).
  - `POST /api/fcm/send`: recibe `{ target, title, body, data? }`, lee los tokens del `target` en `data/fcm-tokens.json` y envía con Firebase Admin SDK a cada token.

---

## Configuración necesaria

1. **VAPID key (frontend)**  
   En Firebase Console → Proyecto → Configuración del proyecto → Cloud Messaging → “Claves de par web” (Web Push certificates), genera o copia la clave.  
   En el proyecto, crea o edita `.env.local`:

   ```env
   NEXT_PUBLIC_FIREBASE_VAPID_KEY=tu_vapid_key_aqui
   ```

   Sin esta variable, `getFCMToken()` devuelve `null` y no se registrarán tokens (el resto de la app sigue funcionando).

2. **Cuenta de servicio (backend)**  
   Para que `POST /api/fcm/send` envíe push reales:
   - Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.
   - Guarda el JSON y en el servidor configura una variable con su contenido (por ejemplo en Vercel/Railway como variable de entorno):

   ```env
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ```

   Si no está definida, la API responde `{ ok: true, sent: 0 }` y no se envían notificaciones (no rompe la app).

---

## Resumen

| Variable | Dónde | Efecto si falta |
|----------|--------|------------------|
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Frontend (build/runtime) | No se obtiene token FCM; no hay registro ni push en el dispositivo. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Backend (servidor) | No se envían push; la API responde OK con `sent: 0`. |

Con ambas configuradas, el flujo es: el usuario activa notificaciones → se obtiene el token → se registra en `/api/fcm/register` → cuando la app llama a `sendNotification()`, el backend envía el push con FCM.

---

## Opcional – mensajes en primer plano

Si quieres mostrar algo cuando llegue un push con la app abierta, en el cliente puedes usar `onMessage` de Firebase Messaging y, por ejemplo, llamar a `showLocalNotification(title, body)` desde `lib/notifications.ts`.
