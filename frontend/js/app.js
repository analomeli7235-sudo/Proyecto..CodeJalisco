// CodeJalisco · utilidades compartidas: API, encabezado según rol y guardas de página.
async function api(url, o = {}) {
  let r;
  try { r = await fetch(url, { credentials: 'same-origin', ...o, headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }); }
  catch { const e = new Error('No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.'); e.status = 0; throw e; }
  let d = {}; try { d = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(d.error || 'Ocurrió un error inesperado.'); e.status = r.status; throw e; }
  return d;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pillClase = e => ({ 'En revisión': 'rev', 'En atención': 'aten', 'Atendido': 'ok' }[e] || '');
const pill = e => `<span class="pill ${pillClase(e)}">${esc(e)}</span>`;
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2600); }
function aviso(el, msg, tipo = '') { el.innerHTML = msg ? `<div class="aviso ${tipo}" role="${tipo ? 'alert' : 'status'}">${esc(msg)}</div>` : ''; }

/* init(): carga la sesión, aplica la regla de acceso de la página y dibuja el encabezado.
   requiere: 'ciudadano' | 'administrador' | 'auth' | 'invitado' | undefined */
async function init(requiere) {
  const { usuario: u, google } = await api('/api/me');
  const aqui = location.pathname + location.search;
  if (requiere === 'invitado' && u) return location.replace(u.rol === 'administrador' ? '/panel.html' : '/index.html'), new Promise(() => {});
  if (requiere && requiere !== 'invitado') {
    if (!u) return location.replace('/login.html?next=' + encodeURIComponent(aqui)), new Promise(() => {});
    if (requiere !== 'auth' && u.rol !== requiere) return location.replace('/index.html?error=permiso'), new Promise(() => {});
  }
  const enlaces = [['/index.html', 'Inicio'], ['/reportar.html', 'Reportar problema', !u || u.rol === 'ciudadano'], ['/consultar.html', 'Consultar folio'],
    ['/panel.html', 'Panel de dependencia', u && u.rol === 'administrador'], ['/docs.html', 'Documentación']];
  const nav = enlaces.filter(l => l[2] === undefined || l[2]).map(([h, t]) => `<a href="${h}"${location.pathname === h || (h === '/index.html' && location.pathname === '/') ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  const cuenta = u
    ? `<span class="sesion"><span>${esc(u.nombre)}<span class="rol">${u.rol === 'administrador' ? 'Administrador' : 'Ciudadano'}</span></span><button id="salir" type="button">Cerrar sesión</button></span>`
    : `<a href="/login.html"${location.pathname === '/login.html' ? ' aria-current="page"' : ''}>Iniciar sesión</a><a href="/registro.html"${location.pathname === '/registro.html' ? ' aria-current="page"' : ''}>Registrarse</a>`;
  document.getElementById('top').innerHTML = `<div class="wrap"><a class="marca" href="/index.html"><span class="logo">CJ</span><span><b>CodeJalisco</b><small>Plataforma ciudadana de reportes urbanos</small></span></a><nav aria-label="Principal">${nav}${cuenta}</nav></div>`;
  const s = document.getElementById('salir');
  if (s) s.onclick = async () => { await api('/api/logout', { method: 'POST' }); location.href = '/index.html'; };
  const f = document.getElementById('pie'); if (f) f.innerHTML = '<div class="wrap">CodeJalisco · Proyecto universitario, Desarrollo de Sistemas Web · Sprint 6</div>';
  return { u, google };
}
/* Detalle de un reporte (usado por Consultar folio) */
function detalleReporte(r) {
  const hist = r.historial.map(h => `<li>${esc(h.estado)} · ${esc(h.fecha)}${h.por ? ' · ' + esc(h.por) : ''}</li>`).join('');
  const campos = r.limitada
    ? `<dt>Categoría</dt><dd>${esc(r.categoria)}</dd><dt>Fecha de creación</dt><dd>${esc(r.fecha)}</dd><dt>Ubicación</dt><dd class="ancho">${esc(r.colonia)}, ${esc(r.municipio)}</dd>`
    : `<dt>Categoría</dt><dd>${esc(r.categoria)}</dd><dt>Fecha de creación</dt><dd>${esc(r.fecha)}</dd>
       <dt>Ubicación</dt><dd class="ancho">${esc(r.calle)}, ${esc(r.colonia)}, ${esc(r.municipio)}${r.referencia ? ' (' + esc(r.referencia) + ')' : ''}</dd>
       <dt>Coordenadas</dt><dd class="ancho">${r.latitud != null ? `${esc(r.latitud)}, ${esc(r.longitud)} · <a href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(r.latitud)}&mlon=${encodeURIComponent(r.longitud)}#map=17/${encodeURIComponent(r.latitud)}/${encodeURIComponent(r.longitud)}" target="_blank" rel="noopener">Ver en el mapa</a>` : 'No registradas (se indicó solo la dirección)'}</dd>
       <dt>Descripción</dt><dd class="ancho">${esc(r.descripcion)}</dd><dt>Reportado por</dt><dd>${esc(r.usuarioNombre)}</dd><dt>Correo de contacto</dt><dd>${esc(r.correo || '—')}</dd>`;
  return `<article class="card"><h2>${esc(r.folio)} ${pill(r.estado)}</h2><dl class="detalle">${campos}
    <div class="ancho"><dt>Seguimiento</dt><dd><ol class="historial">${hist}</ol></dd></div>
    ${r.tieneFoto ? `<div class="ancho"><dt>Fotografía</dt><dd><img class="foto" src="/api/fotos/${encodeURIComponent(r.folio)}" alt="Fotografía del problema reportado"></dd></div>` : ''}</dl>
    ${r.limitada ? '<p class="ayuda">Por privacidad, solo se muestra el estado general de los reportes de otras personas.</p>' : ''}</article>`;
}
