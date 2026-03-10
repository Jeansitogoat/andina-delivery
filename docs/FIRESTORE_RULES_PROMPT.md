# Prompt mejorado para generar Firestore Rules (Gemini)

Este documento contiene el prompt completo e mejorado para generar las reglas de Firestore de Andina Express. Podés copiarlo y pegarlo en Gemini para obtener reglas listas para la consola de Firebase.

---

## Prompt para copiar y pegar

```
Agent, vamos a generar el archivo firestore.rules para el lanzamiento oficial de Andina Express. Necesito un esquema de seguridad de 'Privilegio Mínimo' pero que permita la administración del negocio. Sigue estas reglas:

1. Colección /users/{uid}:
   - Lectura/Escritura: Solo el dueño del uid puede acceder a su propio documento.

2. Colección /pedidos/{id}:
   - Lectura: Permitida si el usuario es el clienteId, el riderId asignado, o si tiene rol central o maestro (para auditoría y soporte).
   - Creación: Solo permitida a usuarios autenticados donde el clienteId coincida con su auth.uid.
   - Actualización: Permitida para la central y el maestro. El riderId asignado solo puede actualizar campos de estado (estado, ubicacionRider). El riderId asignado solo puede actualizar si los únicos campos que cambian son estado y, si existe, ubicacionRider (usar affectedKeys() en la regla).
   - Eliminación: Solo central o maestro.

3. Colecciones /locales, /banners y /config:
   - Lectura: Pública (cualquier usuario, incluso no logueado, puede ver los locales y banners).
   - Escritura: SOLO permitida para usuarios con rol maestro.

4. Colección /solicitudes:
   - Creación: Pública (para nuevos locales que quieran unirse).
   - Lectura/Escritura: SOLO rol maestro.

5. Seguridad Global:
   - Cualquier otra ruta no especificada debe tener allow read, write: if false;

6. Colección /comisiones/{comisionId}:
   - Lectura permitida si request.auth != null y resource.data.riderId == request.auth.uid.
   - Creación, actualización y eliminación: if false (solo el servidor las modifica).

Nota para quien genere las reglas: el rol del usuario (central, maestro, local, rider, cliente) está en el documento /users/{uid}. Para comprobar rol en una regla usar get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol (o una función helper getRole() que devuelva ese valor). Para restringir que el rider solo actualice ciertos campos en pedidos, usar request.resource.data.diff(resource.data).affectedKeys().hasOnly(['estado','updatedAt','ubicacionRider']).

Genera el código limpio y profesional para copiarlo directamente en la consola de Firebase.
```

---

## Resumen de mejoras incorporadas

| Mejora | Descripción |
|--------|-------------|
| **Comisiones** | Punto 6 añadido: lectura para el rider dueño, escritura denegada en cliente. |
| **Rol en reglas** | Nota técnica: el rol se obtiene de `/users/{uid}` con `get(...).data.rol` o una función `getRole()`. |
| **Campos del rider** | Instrucción explícita de usar `affectedKeys().hasOnly(['estado','updatedAt','ubicacionRider'])` para limitar qué puede actualizar el rider. |

---

## Mejora futura (opcional)

Si más adelante el panel restaurante lee pedidos en tiempo real desde el cliente (listener Firestore), habría que añadir al prompt:

- **Lectura en /pedidos:** Permitir también si el usuario tiene rol `local` y `resource.data.localId` coincide con el `localId` del usuario (en `/users/{uid}`).

Hoy el panel restaurante obtiene pedidos solo por API, por lo que no es necesario para el lanzamiento.
