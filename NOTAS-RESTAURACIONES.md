# Notas de restauraciones

Registro de funcionalidad que se había perdido (por undo/borrado) y se restauró.

---

## Panel Rider: selector de estado del rider

- **Archivo:** `app/panel/rider/page.tsx`
- **Qué se restauró:** El rider puede cambiar su propio estado en el panel:
  - **Disponible** (verde)
  - **Ocupado** (amarillo)
  - **Ausente** (naranja)
  - **Fuera de servicio** (rojo)
- **Uso:** Emergencias o para indicar disponibilidad. Con backend, cuando la central asigne una carrera y el rider confirme, se podrá actualizar automáticamente a "ocupado" o de vuelta a "disponible".
- **Restaurado:** Feb 2025 (tras pérdida por borrado).
