# Sprint 3 · Registro, inicio de sesión y perfiles

## Alcance
Cuentas de ciudadano (correo/contraseña y Google), tres administradores de reportes, control de acceso por rol en páginas **y** API, y reportes ligados al usuario que los creó.

## Permisos
| Recurso | Invitado | Ciudadano | Administrador |
|---|---|---|---|
| Inicio, Documentación, Login, Registro | Sí | Sí | Sí |
| Reportar problema (`POST /api/reportes`) | No | Sí | No |
| Consultar folio (`GET /api/reportes/:folio`) | No | Sí: detalle completo de los suyos, solo estado de los ajenos | Sí: detalle completo de todos |
| Panel / listado (`GET /api/reportes`) y cambio de estado | No | No (403) | Sí |

## Cambios respecto a Sprints anteriores (y por qué)
- `GET /api/reportes` era público (Sprint 1); ahora es solo para administradores porque expone datos de ciudadanos.
- Sin Express: el servidor usa solo módulos nativos de Node para ejecutarse sin instalar dependencias. Se conservan rutas `/api`, `/api/health` y `/api/categorias`, y la separación frontend/backend/datos.
- Categoría "Falla en alumbrado público" → "Alumbrado público", para coincidir con el diseño del Sprint 2.
- Folio con formato `CJ-AAAA-NNNN` (ajuste 3 de la retrospectiva). Se agregó `.env.example` (ajuste 2) y pruebas automáticas (ajuste 1).
- Los reportes ahora guardan `usuarioId`, `usuarioNombre`, `historial` y fotografía.

## Seguridad
Contraseñas con scrypt + sal, cookie de sesión HttpOnly/SameSite, límite de intentos de login, validación en servidor, escape de HTML en el cliente, fotografías servidas solo al dueño o administradores, y administradores sin acceso por Google.

## Pendiente (Sprints 4 a 8)
Base de datos real (JSON se sustituye por SQLite/MongoDB), mapa/geolocalización, notificaciones por correo y pruebas de aceptación.
