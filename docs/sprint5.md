# Sprint 5 · Ubicación, generación de folios y consulta de reportes

## Qué se implementó (según la documentación del Sprint 5)
| Tarea documentada | Implementación |
|---|---|
| `/api/reportes` incluye latitud y longitud | `POST /api/reportes` acepta `latitud` y `longitud` (opcionales, ambas o ninguna; rangos validados en servidor) |
| Geolocalización del navegador en el formulario | `reportar.html`: botón "Usar mi ubicación actual" (API `navigator.geolocation`, sin dependencias) y campos Latitud/Longitud editables |
| Contingencia si no hay GPS o se niega el permiso | Mensaje claro, validación manual de coordenadas y posibilidad de enviar solo con la dirección (no se bloquea el registro) |
| Folio único `CJ-2026-XXXX` | Ya existía; se conserva (máximo existente + 1, consecutivo e irrepetible) |
| Pantalla de confirmación con el folio | Se conserva y ahora resume fecha y ubicación del reporte |
| `GET /api/reportes/folio/:folio` | Nueva ruta (la anterior `/api/reportes/:folio` se conserva). 400 formato inválido, 404 inexistente |
| Vista "Consultar folio": estado, fecha de creación y evidencia fotográfica | `consultar.html` usa la nueva ruta; muestra estado, **Fecha de creación**, coordenadas y fotografía |
| Distinguir folio inexistente de error de conexión | 404 → "No existe un reporte con el folio…"; sin conexión o error 5xx → mensaje distinto |

## Decisiones y puntos que la documentación no define
- **Mapa:** se usó la geolocalización del navegador (una de las dos opciones del documento); no se agregó Leaflet ni dependencias. "Ver en el mapa" solo abre OpenStreetMap en otra pestaña. Es un enlace simple y puede quitarse sin afectar nada.
- **Estados:** el documento menciona "Registrado" y "En revisión"; el sitio conserva los estados ya definidos (Recibido, En revisión, En atención, Atendido) para no alterar el Panel de dependencia.
- **Privacidad:** se mantiene la regla del Sprint 3: el detalle completo (descripción, coordenadas y fotografía) lo ven el ciudadano dueño del reporte y los administradores; otras cuentas solo ven el estado.
- **Un folio por ciudadano:** regla del Sprint 3 que se conserva; no figura en la documentación del Sprint 5.
- **Prefijo del estado en el folio:** la retrospectiva lo sugiere como aprendizaje, pero el ejemplo definido es `CJ-2026-XXXX`; no se cambió el formato.
- Los reportes del Sprint 1 no tienen coordenadas y se muestran como "No registradas".

## Archivos modificados
`backend/server.js`, `frontend/reportar.html`, `frontend/consultar.html`, `frontend/js/app.js`, `frontend/index.html` (etiqueta de sprint), `frontend/docs.html` (lista de sprints), `tests/smoke.js`, `README.md`. Sin cambios en `styles.css`: se reutilizaron los componentes existentes.
