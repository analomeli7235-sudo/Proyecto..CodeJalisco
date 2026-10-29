// CodeJalisco · Sprint 3 · Servidor HTTP con autenticación, roles y reportes.
// Sin dependencias externas (solo módulos nativos de Node.js >= 18).
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
try { // carga simple de .env
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
} catch {}
const PORT = process.env.PORT || 3000;
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const FRONT = path.join(ROOT, 'frontend');
const DATA = process.env.CJ_DATA || path.join(__dirname, 'data');
const UP = path.join(DATA, 'uploads');
const G = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET };
const MAX_REPORTES = +process.env.MAX_REPORTES_POR_USUARIO || 1; // cada ciudadano genera un solo folio
const ESTADOS = ['Recibido', 'En revisión', 'En atención', 'Atendido'];

/* ---------- Persistencia en JSON ---------- */
const file = f => path.join(DATA, f);
const load = (f, def) => { try { return JSON.parse(fs.readFileSync(file(f), 'utf8')); } catch { return def; } };
const save = (f, d) => fs.writeFileSync(file(f), JSON.stringify(d, null, 2));
fs.mkdirSync(UP, { recursive: true });
for (const f of ['reportes.json', 'categorias.json'])
  if (!fs.existsSync(file(f))) fs.copyFileSync(path.join(__dirname, 'data', f), file(f));

/* ---------- Contraseñas y usuarios ---------- */
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const mkUser = (id, nombre, correo, pw, rol, proveedor = 'local') => {
  const salt = crypto.randomBytes(16).toString('hex');
  return { id, nombre, correo: correo.toLowerCase(), salt, hash: pw ? hash(pw, salt) : null, rol, proveedor };
};
if (!fs.existsSync(file('users.json'))) { // tres administradores de reportes
  const pw = process.env.ADMIN_PASSWORD || 'Admin#2026';
  save('users.json', [1, 2, 3].map(n => mkUser(n, `Administrador de reportes ${n}`, `admin${n}@codejalisco.mx`, pw, 'administrador')));
}
const checkPw = (u, pw) => {
  if (!u.hash) return false;
  const a = Buffer.from(hash(pw, u.salt), 'hex'), b = Buffer.from(u.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const pub = u => ({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol });

/* ---------- Sesiones (en memoria, cookie HttpOnly) ---------- */
const sessions = new Map(), TTL = 8 * 3600e3;
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(c => { const i = c.indexOf('='); return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))]; }));
const cookie = (n, v, age) => `${n}=${encodeURIComponent(v)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}`;
const startSession = uid => { const t = crypto.randomBytes(32).toString('hex'); sessions.set(t, { uid, exp: Date.now() + TTL }); return cookie('cj_sid', t, TTL / 1000); };
const currentUser = req => {
  const t = cookies(req).cj_sid, s = sessions.get(t);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(t); return null; }
  return load('users.json', []).find(u => u.id === s.uid) || null;
};
const intentos = new Map(); // limitador básico de intentos fallidos
const bloqueado = k => (intentos.get(k) || []).filter(t => t > Date.now() - 900e3).length >= 8;
const falla = k => intentos.set(k, [...(intentos.get(k) || []), Date.now()]);

/* ---------- Utilidades HTTP ---------- */
const fail = (code, msg) => { throw { code, msg }; };
const send = (res, code, obj, h = {}) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...h }); res.end(JSON.stringify(obj)); };
const redirect = (res, to, h = {}) => { res.writeHead(302, { Location: to, ...h }); res.end(); };
const readBody = req => new Promise((ok, no) => {
  let n = 0; const c = [];
  req.on('data', d => { n += d.length; if (n > 3e6) { no({ code: 413, msg: 'La solicitud es demasiado grande (máx. 2 MB de imagen).' }); req.destroy(); } else c.push(d); });
  req.on('end', () => { try { ok(c.length ? JSON.parse(Buffer.concat(c)) : {}); } catch { no({ code: 400, msg: 'Solicitud inválida.' }); } });
});
const needAuth = u => u || fail(401, 'Inicia sesión para continuar.');
const needRole = (u, rol) => { needAuth(u); if (u.rol !== rol) fail(403, 'No tienes permiso para realizar esta acción.'); };
const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ---------- Reportes: vistas según rol ---------- */
const vistaCompleta = r => { const { foto, ...x } = r; return { ...x, tieneFoto: !!foto }; };
const vistaPublica = r => ({ folio: r.folio, categoria: r.categoria, estado: r.estado, fecha: r.fecha, municipio: r.municipio, colonia: r.colonia, historial: r.historial.map(h => ({ estado: h.estado, fecha: h.fecha })), limitada: true });
const vista = (r, u) => (u.rol === 'administrador' || r.usuarioId === u.id) ? vistaCompleta(r) : vistaPublica(r);
const hoy = () => new Date().toISOString().slice(0, 10);
const nuevoFolio = rs => `CJ-${new Date().getFullYear()}-${Math.max(1000, ...rs.map(r => +r.folio.split('-')[2] || 0)) + 1}`;

/* ---------- API ---------- */
async function api(req, res, url, user) {
  const m = req.method, p = url.pathname;
  if (m !== 'GET' && !(req.headers['content-type'] || '').includes('application/json')) fail(415, 'Tipo de contenido no permitido.');
  let x;
  if (m === 'GET' && p === '/api/health') return send(res, 200, { status: 'ok', servicio: 'CodeJalisco API', version: '3.0.0' });
  if (m === 'GET' && p === '/api/categorias') return send(res, 200, load('categorias.json', []));
  if (m === 'GET' && p === '/api/estados') return send(res, 200, ESTADOS);
  if (m === 'GET' && p === '/api/me') return send(res, 200, { usuario: user ? pub(user) : null, google: !!(G.id && G.secret), limiteReportes: MAX_REPORTES });

  if (m === 'POST' && p === '/api/registro') {
    const b = await readBody(req), nombre = txt(b.nombre, 80), correo = txt(b.correo, 120).toLowerCase(), pw = String(b.password || '');
    if (nombre.length < 2) fail(400, 'Escribe tu nombre completo.');
    if (!emailOk(correo)) fail(400, 'Escribe un correo electrónico válido.');
    if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) fail(400, 'La contraseña debe tener al menos 8 caracteres, con letras y números.');
    const us = load('users.json', []);
    if (us.some(u => u.correo === correo)) fail(409, 'Ya existe una cuenta con ese correo. Inicia sesión.');
    const u = mkUser(Math.max(0, ...us.map(u => u.id)) + 1, nombre, correo, pw, 'ciudadano');
    save('users.json', [...us, u]);
    return send(res, 201, { usuario: pub(u) }, { 'Set-Cookie': startSession(u.id) });
  }
  if (m === 'POST' && p === '/api/login') {
    const b = await readBody(req), correo = txt(b.correo, 120).toLowerCase(), k = req.socket.remoteAddress + correo;
    if (bloqueado(k)) fail(429, 'Demasiados intentos fallidos. Espera 15 minutos.');
    const u = load('users.json', []).find(u => u.correo === correo);
    if (!u || !checkPw(u, String(b.password || ''))) { falla(k); fail(401, 'Correo o contraseña incorrectos.'); }
    return send(res, 200, { usuario: pub(u) }, { 'Set-Cookie': startSession(u.id) });
  }
  if (m === 'POST' && p === '/api/logout') {
    sessions.delete(cookies(req).cj_sid);
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('cj_sid', '', 0) });
  }

  if (m === 'POST' && p === '/api/reportes') { // solo ciudadanos
    needRole(user, 'ciudadano');
    const previos = load('reportes.json', []).filter(r => r.usuarioId === user.id);
    if (previos.length >= MAX_REPORTES) fail(409, `Ya generaste tu folio (${previos[0].folio}). Cada cuenta de ciudadano puede generar un solo reporte.`);
    const b = await readBody(req), cats = load('categorias.json', []).map(c => c.nombre);
    const r = { categoria: txt(b.categoria, 60), descripcion: txt(b.descripcion, 1000), municipio: txt(b.municipio, 80), colonia: txt(b.colonia, 80), calle: txt(b.calle, 120), referencia: txt(b.referencia, 120), correo: txt(b.correo, 120).toLowerCase() };
    if (!cats.includes(r.categoria)) fail(400, 'Selecciona un tipo de problema.');
    if (r.descripcion.length < 10) fail(400, 'Describe el problema con al menos 10 caracteres.');
    if (!r.municipio || !r.colonia || !r.calle) fail(400, 'Municipio, colonia y calle son obligatorios.');
    if (r.correo && !emailOk(r.correo)) fail(400, 'El correo de contacto no es válido.');
    const num = v => (v === '' || v == null) ? null : Number(v); // ubicación opcional: si el ciudadano no comparte GPS, se usa la dirección
    const lat = num(b.latitud), lon = num(b.longitud);
    if ((lat === null) !== (lon === null)) fail(400, 'Indica latitud y longitud juntas, o deja ambas vacías.');
    if (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)) fail(400, 'Las coordenadas no son válidas (latitud entre -90 y 90, longitud entre -180 y 180).');
    r.latitud = lat === null ? null : +lat.toFixed(6); r.longitud = lon === null ? null : +lon.toFixed(6);
    const rs = load('reportes.json', []), folio = nuevoFolio(rs);
    let foto = null;
    if (b.foto) {
      const f = String(b.foto).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!f) fail(400, 'La fotografía debe ser PNG, JPG o WebP.');
      const buf = Buffer.from(f[2], 'base64');
      if (buf.length > 2e6) fail(400, 'La fotografía no puede pesar más de 2 MB.');
      foto = `${folio}.${f[1] === 'jpeg' ? 'jpg' : f[1]}`; fs.writeFileSync(path.join(UP, foto), buf);
    }
    const nuevo = { folio, ...r, estado: 'Recibido', fecha: hoy(), usuarioId: user.id, usuarioNombre: user.nombre, foto, historial: [{ estado: 'Recibido', fecha: hoy() }] };
    save('reportes.json', [...rs, nuevo]);
    return send(res, 201, vistaCompleta(nuevo));
  }
  if (m === 'GET' && p === '/api/reportes/mios') { // reportes del ciudadano
    needRole(user, 'ciudadano');
    return send(res, 200, load('reportes.json', []).filter(r => r.usuarioId === user.id).map(vistaCompleta).reverse());
  }
  if ((x = p.match(/^\/api\/reportes\/folio\/([^/]+)$/)) && m === 'GET') { // Sprint 5: búsqueda específica por folio
    needAuth(user);
    const f = decodeURIComponent(x[1]).trim().toUpperCase();
    if (!/^CJ-\d{4}-\d+$/.test(f)) fail(400, 'El folio debe tener el formato CJ-AAAA-NNNN, por ejemplo CJ-2026-1001.');
    const r = load('reportes.json', []).find(r => r.folio === f);
    if (!r) fail(404, 'No existe un reporte con ese folio.');
    return send(res, 200, vista(r, user));
  }
  if (m === 'GET' && p === '/api/reportes') { // listado completo: solo administradores
    needRole(user, 'administrador');
    return send(res, 200, load('reportes.json', []).map(vistaCompleta));
  }
  if ((x = p.match(/^\/api\/reportes\/(CJ-\d{4}-\d+)$/)) && m === 'GET') { // consulta por folio: cualquier usuario autenticado
    needAuth(user);
    const r = load('reportes.json', []).find(r => r.folio === x[1]);
    if (!r) fail(404, 'No encontramos un reporte con ese folio.');
    return send(res, 200, vista(r, user));
  }
  if ((x = p.match(/^\/api\/reportes\/(CJ-\d{4}-\d+)\/estado$/)) && (m === 'PATCH' || m === 'PUT')) { // actualizar estado: solo administradores (PUT y PATCH equivalentes)
    needRole(user, 'administrador');
    const b = await readBody(req), rs = load('reportes.json', []), r = rs.find(r => r.folio === x[1]);
    if (!r) fail(404, 'Reporte no encontrado.');
    if (!ESTADOS.includes(b.estado)) fail(400, 'Estado no válido.');
    if (b.estado === 'Atendido' && !r.historial.some(h => h.estado === 'En atención')) fail(400, 'Un reporte debe pasar por "En atención" antes de marcarse como "Atendido".');
    if (r.estado !== b.estado) { r.estado = b.estado; r.historial.push({ estado: b.estado, fecha: hoy(), por: user.nombre }); save('reportes.json', rs); }
    return send(res, 200, vistaCompleta(r));
  }
  if ((x = p.match(/^\/api\/fotos\/(CJ-\d{4}-\d+)$/)) && m === 'GET') {
    needAuth(user);
    const r = load('reportes.json', []).find(r => r.folio === x[1]);
    if (!r || !r.foto) fail(404, 'Sin fotografía.');
    if (user.rol !== 'administrador' && r.usuarioId !== user.id) fail(403, 'No tienes permiso para ver esta fotografía.');
    const ext = path.extname(r.foto).slice(1);
    res.writeHead(200, { 'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`, 'Cache-Control': 'private, max-age=300' });
    return res.end(fs.readFileSync(path.join(UP, path.basename(r.foto))));
  }
  fail(404, 'Ruta de API no encontrada.');
}

/* ---------- Google OAuth 2.0 (código de autorización) ---------- */
async function google(req, res, url) {
  if (!G.id || !G.secret) return redirect(res, '/login.html?error=google');
  const redirectUri = `${BASE}/auth/google/callback`;
  if (url.pathname === '/auth/google') {
    const state = crypto.randomBytes(16).toString('hex');
    const q = new URLSearchParams({ client_id: G.id, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    return redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${q}`, { 'Set-Cookie': cookie('cj_oauth', state, 600) });
  }
  try {
    if (!url.searchParams.get('code') || url.searchParams.get('state') !== cookies(req).cj_oauth) throw 0;
    const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ code: url.searchParams.get('code'), client_id: G.id, client_secret: G.secret, redirect_uri: redirectUri, grant_type: 'authorization_code' }) })).json();
    const info = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
    if (!info.email || !info.email_verified) throw 0;
    const us = load('users.json', []), correo = info.email.toLowerCase();
    let u = us.find(u => u.correo === correo);
    if (u && u.rol === 'administrador') return redirect(res, '/login.html?error=admin_google'); // administradores: solo contraseña
    if (!u) { u = mkUser(Math.max(0, ...us.map(u => u.id)) + 1, info.name || correo, correo, null, 'ciudadano', 'google'); save('users.json', [...us, u]); }
    return redirect(res, '/index.html', { 'Set-Cookie': [startSession(u.id), cookie('cj_oauth', '', 0)] });
  } catch { return redirect(res, '/login.html?error=google_fallo'); }
}

/* ---------- Archivos estáticos con control de acceso por página ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PAGINAS = { '/panel.html': 'administrador', '/reportar.html': 'ciudadano', '/consultar.html': 'auth' };
function estatico(req, res, url, user) {
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const need = PAGINAS[p];
  if (need) {
    if (!user) return redirect(res, `/login.html?next=${encodeURIComponent(p + url.search)}`);
    if (need !== 'auth' && user.rol !== need) return redirect(res, '/index.html?error=permiso');
  }
  const f = path.normalize(path.join(FRONT, p));
  if (!f.startsWith(FRONT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Página no encontrada'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'same-origin');
  try {
    const url = new URL(req.url, BASE), user = currentUser(req);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url, user);
    if (url.pathname.startsWith('/auth/google')) return await google(req, res, url);
    return estatico(req, res, url, user);
  } catch (e) {
    if (e && e.code) return send(res, e.code, { error: e.msg });
    console.error(e); send(res, 500, { error: 'Error interno del servidor.' });
  }
});
if (require.main === module) server.listen(PORT, () => console.log(`CodeJalisco activo en ${BASE}`));
module.exports = server;
