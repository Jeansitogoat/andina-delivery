# Proyecto Andina

## Datos demo y día del lanzamiento

Los datos de la app (locales, menús, pedidos, riders, carreras) viven en la carpeta **`data/`** en JSON. La app los lee por API.

- **Ahora (demo):** ejecuta `npm run seed` para rellenar `data/locales-aprobados.json`, `data/central.json` y `data/rider.json` con datos de ejemplo. Así puedes enseñar la app y probar.
- **Día del lanzamiento:** ejecuta `npm run seed:clear` para vaciar esos JSON. La app quedará “en blanco”. Luego carga negocios reales (por ejemplo editando `data/locales-aprobados.json` o desde el panel de socios/maestro) y, cuando tengas backend, pedidos y riders reales.

### Archivos en `data/`

| Archivo | Contenido |
|--------|------------|
| `locales-aprobados.json` | `locales`, `menus`, `reviews` |
| `central.json` | `pedidos`, `riders` (panel Central) |
| `rider.json` | `carreras`, `historial` (panel Rider) |

**Nota:** Las páginas de carrito y checkout siguen usando `lib/data.ts` para resolver nombres de locales y productos. Para un corte total el día del lanzamiento, después de vaciar los JSON puedes vaciar también los arrays en `lib/data.ts` o migrar esas páginas a consumir la API de locales.

## Notificaciones push (FCM)

Para que las notificaciones push funcionen en la web (central, restaurantes, riders y clientes):

1. **NEXT_PUBLIC_FIREBASE_VAPID_KEY**: configúrala en `.env.local`. Obtén la clave en [Firebase Console](https://console.firebase.google.com) → tu proyecto → Cloud Messaging → pestaña "Web Push" → "Generar par de claves".
2. **Dominio autorizado**: en Firebase Console → Authentication → Configuración → Dominios autorizados, añade tu dominio de producción (ej. `tuapp.com`). `localhost` ya está permitido en desarrollo.
3. **Sonido en paneles**: opcionalmente añade un archivo `public/sounds/new-order.mp3` (1–2 s) para que suene cuando llegue un pedido o carrera con la pestaña abierta. Ver `public/sounds/README.md`.
