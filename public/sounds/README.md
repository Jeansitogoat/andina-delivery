# Sonidos de notificación

**Importante:** Sin los archivos de audio, no habrá sonido en los paneles cuando llegue un pedido o carrera nueva. La app no falla; simplemente no se reproduce ningún sonido. El código captura errores de autoplay (`.play().catch(() => {})`) para que un fallo no rompa la ejecución.

Coloca aquí:

- **new-order.mp3** (1–2 s): se usa en Panel central (nuevo pedido esperando rider) y Panel restaurante (nuevo pedido entrante).
- **rider-new-order.mp3** (1–2 s): se usa en Panel rider cuando se asigna una nueva carrera. Sonido diferenciado para riders.

Puedes usar sonidos libres de derechos (por ejemplo, de freesound.org o similar) o grabar uno propio. El volumen se fija a 1.0 en la app para máxima audibilidad.
