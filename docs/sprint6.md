# Sprint 6 · Seguimiento y actualización de estados

## Estado de cada tarea documentada
| Tarea del Sprint 6 | Situación | Dónde |
|---|---|---|
| Panel de Dependencia con tarjetas de resumen y tabla de reportes | Ya existía (Sprint 3); se conserva sin rediseño | `frontend/panel.html` |
| Filtros por categoría y estado, y buscador por folio o colonia | Ya existían; verificados en navegador | `frontend/panel.html` |
| Endpoint de actualización `PUT /api/reportes/:id/estado` ("o similar") | Existía como `PATCH`; **se agregó `PUT`** equivalente (el identificador es el folio) | `backend/server.js` |
| Lógica de cambio de estados (evitar Recibido → Atendido sin En atención) | **Nuevo:** un reporte solo puede marcarse "Atendido" si pasó por "En atención" (400 con mensaje claro; el menú vuelve al estado real) | `backend/server.js`, `frontend/panel.html` |
| Sincronización con la consulta por folio | Verificada: el ciudadano ve el estado nuevo y el historial (estado, fecha y administrador) al consultar | `frontend/consultar.html` |
| Solo administradores acceden al panel | Ya implementado (página y API); verificado | `backend/server.js` |

## Cambios de código
- `backend/server.js`: ruta de estado acepta `PUT` y `PATCH`; regla de transición hacia "Atendido".
- `frontend/panel.html`: limpia el aviso de error tras una actualización correcta.
- `frontend/css/styles.css`: el menú "Actualizar" ya no se corta (`min-width`), folio y fecha no se parten; el panel usa el ancho de 1110 px de la página de inicio.
- `frontend/index.html`, `frontend/js/app.js`, `frontend/docs.html`: etiquetas de sprint. Solo texto.
- `tests/smoke.js`: 6 pruebas nuevas (52 en total).

## Lo que la documentación no define (no se inventó)
- **Otras transiciones:** solo se pidió evitar saltar a "Atendido" sin "En atención". Se permite saltar "En revisión" (Recibido → En atención) y devolver un reporte a un estado anterior (corregir un error). Si quieren un flujo estricto (Recibido → En revisión → En atención → Atendido), es un cambio de una línea.
- **Tarjetas de resumen:** se conservan las cuatro por estado del diseño del Sprint 2; la documentación habla de "Total de reportes recibidos" y puede entenderse también como un total general.
- **Actualización en tiempo real, paginación y base de datos relacional:** la propia documentación los deja para el Sprint 7; no se implementaron.
- **Estandarización de códigos HTTP:** acuerdo para el Sprint 7. La API ya responde 200, 400, 401, 403 y 404.
- Los enlaces del repositorio y del sitio desplegado están en blanco en el documento.
