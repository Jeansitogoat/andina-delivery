# Configuración de Firestore

Para que el registro de usuarios (clientes y riders) funcione, Firestore debe tener reglas que permitan leer/escribir en la colección `users`.

---

## Reglas necesarias

Ve a **Firebase Console → Firestore Database → Reglas** y pega:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Luego haz clic en **Publicar**.

---

## Flujos de registro

| Formulario | Rol | Descripción |
|------------|-----|-------------|
| **Regístrate** | `cliente` | Para pedir delivery a domicilio |
| **Soy rider y quiero crear mi cuenta** | `rider` | Para motorizados; Central valida antes de usar el panel |

Si un usuario se registra como rider desde el formulario correcto, se crea con `rol: rider` y `riderStatus: pending`. Esos riders aparecen en **Panel Central → Validaciones** para que Central/Maestro los apruebe, rechace o suspenda.
