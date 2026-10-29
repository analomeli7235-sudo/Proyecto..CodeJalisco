# CodeJalisco
Plataforma ciudadana para el reporte y seguimiento de problemas urbanos. **Sprints 3, 5 y 6: cuentas y roles, ubicación, folios, consulta y seguimiento de estados.**

## Ejecutar
```
npm start        # http://localhost:3000  (Node.js 18 o superior; no requiere npm install)
npm test         # 52 pruebas de integración (roles, permisos, reportes, ubicación, folios, estados)
```
Copia `.env.example` a `.env` para cambiar puerto, contraseña de administradores o configurar Google.

## Cuentas de administrador (se crean al primer arranque)
| Correo | Contraseña (cámbiala con `ADMIN_PASSWORD`) |
|---|---|
| admin1@codejalisco.mx | Admin#2026 |
| admin2@codejalisco.mx | Admin#2026 |
| admin3@codejalisco.mx | Admin#2026 |

## Google Sign-In
1. Google Cloud Console → Credenciales → ID de cliente OAuth (aplicación web).
2. URI de redirección autorizada: `http://localhost:3000/auth/google/callback`.
3. Pon `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env` y reinicia. Quien entra con Google es siempre **ciudadano**.

## Estructura
```
backend/server.js        API REST, sesiones, roles, Google OAuth, archivos estáticos protegidos
backend/data/            categorias.json, reportes.json (Sprint 1), users.json (se genera), uploads/
frontend/                index, login, registro, reportar, consultar, panel, docs (+ css/ y js/)
tests/smoke.js           pruebas de integración
docs/sprint3.md          alcance, cambios y decisiones del Sprint 3
```
