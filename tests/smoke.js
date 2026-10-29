// Pruebas de integración (Sprint 3). Ejecutar con: npm test
const os = require('os'), path = require('path'), fs = require('fs');
process.env.CJ_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cj-')); // datos temporales: no toca los reales
const server = require('../backend/server');
let ok = 0, bad = 0;
const t = (n, c) => { c ? ok++ : bad++; console.log(`${c ? '  ✔' : '  ✘'} ${n}`); };
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

server.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const sesion = () => { let c = ''; return async (m, u, b) => {
    const r = await fetch(base + u, { method: m, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie: c }, body: b ? JSON.stringify(b) : undefined });
    const s = r.headers.get('set-cookie'); if (s) c = s.split(';')[0];
    const ct = r.headers.get('content-type') || ''; return { s: r.status, loc: r.headers.get('location'), d: ct.includes('json') ? await r.json() : null };
  }; };
  try {
    const inv = sesion(), ciu = sesion(), ciu2 = sesion();
    t('El sitio carga y la API responde', (await inv('GET', '/api/health')).d.status === 'ok');
    for (const p of ['index', 'login', 'registro', 'reportar', 'consultar', 'panel', 'docs']) {
      const r = await fetch(`${base}/${p}.html`, { redirect: 'manual' });
      t(`Página ${p}.html responde (${r.status})`, [200, 302].includes(r.status));
    }
    t('Invitado: /panel.html redirige a login', (await inv('GET', '/panel.html')).loc?.startsWith('/login.html'));
    t('Invitado: API de reportes exige sesión (401)', (await inv('GET', '/api/reportes')).s === 401);
    t('Registro rechaza contraseña débil', (await ciu('POST', '/api/registro', { nombre: 'Ana', correo: 'ana@mail.com', password: '123' })).s === 400);
    t('Registro de ciudadano funciona', (await ciu('POST', '/api/registro', { nombre: 'Ana López', correo: 'ana@mail.com', password: 'Segura2026' })).s === 201);
    t('No permite correo duplicado', (await ciu2('POST', '/api/registro', { nombre: 'Ana', correo: 'ANA@mail.com', password: 'Segura2026' })).s === 409);
    t('Login ciudadano funciona', (await sesion()('POST', '/api/login', { correo: 'ana@mail.com', password: 'Segura2026' })).d.usuario.rol === 'ciudadano');
    await ciu2('POST', '/api/registro', { nombre: 'Luis Pérez', correo: 'luis@mail.com', password: 'Segura2026' }); // segundo ciudadano
    t('Login con contraseña incorrecta falla', (await sesion()('POST', '/api/login', { correo: 'ana@mail.com', password: 'mal' })).s === 401);
    t('Ciudadano: /panel.html redirige (sin acceso)', (await ciu('GET', '/panel.html')).loc?.includes('error=permiso'));
    t('Ciudadano: API del panel devuelve 403', (await ciu('GET', '/api/reportes')).s === 403);
    t('Ciudadano: no puede cambiar estados (403)', (await ciu('PATCH', '/api/reportes/CJ-2026-1001/estado', { estado: 'Atendido' })).s === 403);
    const r = await ciu('POST', '/api/reportes', { categoria: 'Bache', descripcion: 'Bache grande frente a mi casa', municipio: 'Zapopan', colonia: 'Centro', calle: 'Calle 5', latitud: 20.6597, longitud: '-103.3496', foto: png });
    t('Ciudadano crea reporte con foto y folio CJ-AAAA-NNNN', r.s === 201 && /^CJ-\d{4}-1004$/.test(r.d.folio));
    t('Un ciudadano no puede generar un segundo folio (409)', (await ciu('POST', '/api/reportes', { categoria: 'Bache', descripcion: 'Otro bache distinto', municipio: 'Zapopan', colonia: 'Centro', calle: 'Calle 6' })).s === 409);
    t('Reporte con datos faltantes se rechaza', (await ciu2('POST', '/api/reportes', { categoria: 'Bache' })).s === 400);
    const f = r.d.folio;
    t('El reporte guarda latitud y longitud', r.d.latitud === 20.6597 && r.d.longitud === -103.3496);
    t('Coordenadas fuera de rango se rechazan (400)', (await ciu2('POST', '/api/reportes', { categoria: 'Bache', descripcion: 'Bache con GPS mal', municipio: 'Zapopan', colonia: 'Centro', calle: 'Calle 7', latitud: 95, longitud: 10 })).s === 400);
    t('Solo una coordenada se rechaza (400)', (await ciu2('POST', '/api/reportes', { categoria: 'Bache', descripcion: 'Bache con GPS a medias', municipio: 'Zapopan', colonia: 'Centro', calle: 'Calle 7', latitud: 20.6 })).s === 400);
    const gf = await ciu('GET', `/api/reportes/folio/${f.toLowerCase()}`);
    t('GET /api/reportes/folio/:folio devuelve el reporte (acepta minúsculas)', gf.s === 200 && gf.d.folio === f && gf.d.latitud === 20.6597);
    t('Folio con formato inválido responde 400', (await ciu('GET', '/api/reportes/folio/ABC')).s === 400);
    t('Folio inexistente responde 404 (distinto de error de servidor)', (await ciu('GET', '/api/reportes/folio/CJ-2026-9999')).s === 404);
    t('Consulta por folio exige sesión', (await inv('GET', `/api/reportes/folio/${f}`)).s === 401);
    t('Ciudadano consulta su folio con detalle completo', (await ciu('GET', `/api/reportes/${f}`)).d.descripcion?.includes('Bache grande'));
    t('Ciudadano consulta su lista de reportes', (await ciu('GET', '/api/reportes/mios')).d.length === 1);
    const aj = (await ciu('GET', '/api/reportes/CJ-2026-1001')).d;
    t('Ciudadano ve solo el estado de folios ajenos', aj.limitada && !aj.descripcion && !aj.usuarioNombre);
    t('Otro ciudadano no ve la foto ni el detalle', (await ciu2('GET', `/api/fotos/${f}`)).s === 403 && (await ciu2('GET', `/api/reportes/${f}`)).d.limitada === true);
    const admins = ['admin1', 'admin2', 'admin3'], A = [];
    for (const a of admins) { const s = sesion(); const l = await s('POST', '/api/login', { correo: `${a}@codejalisco.mx`, password: 'Admin#2026' }); t(`${a}: inicia sesión como administrador`, l.d?.usuario?.rol === 'administrador'); A.push(s); }
    t('Admin: /panel.html carga', (await A[0]('GET', '/panel.html')).s === 200);
    const lista = (await A[1]('GET', '/api/reportes')).d;
    t('Admin ve reportes de ciudadanos y los del Sprint 1', lista.length === 4 && lista.some(x => x.usuarioNombre === 'Ana López'));
    t('Admin: ve la fotografía', (await A[2]('GET', `/api/fotos/${f}`)).s === 200);
    t('Admin consulta folio con detalle completo', (await A[2]('GET', `/api/reportes/${f}`)).d.usuarioNombre === 'Ana López');
    t('Admin no puede crear reportes (403)', (await A[0]('POST', '/api/reportes', { categoria: 'Bache' })).s === 403);
    t('Admin actualiza estado', (await A[1]('PATCH', `/api/reportes/${f}/estado`, { estado: 'En atención' })).d.estado === 'En atención');
    t('Un reporte Recibido no puede pasar directo a Atendido (400)', (await A[0]('PATCH', '/api/reportes/CJ-2026-1002/estado', { estado: 'Atendido' })).s === 400);
    t('Estado intacto tras el intento rechazado', (await A[0]('GET', '/api/reportes/folio/CJ-2026-1002')).d.estado === 'Recibido');
    t('PUT /api/reportes/:folio/estado actualiza (En revisión)', (await A[0]('PUT', '/api/reportes/CJ-2026-1002/estado', { estado: 'En revisión' })).d.estado === 'En revisión');
    t('Tras En atención ya puede marcarse Atendido', (await A[1]('PUT', '/api/reportes/CJ-2026-1002/estado', { estado: 'En atención' })).s === 200 && (await A[2]('PUT', '/api/reportes/CJ-2026-1002/estado', { estado: 'Atendido' })).d.estado === 'Atendido');
    t('El historial registra al administrador que hizo cada cambio', (await A[0]('GET', '/api/reportes/folio/CJ-2026-1002')).d.historial.filter(h => h.por).length === 3);
    t('Ciudadano no puede usar PUT de estado (403)', (await ciu('PUT', `/api/reportes/${f}/estado`, { estado: 'Atendido' })).s === 403);
    t('El ciudadano ve el estado actualizado y el historial', (await ciu('GET', `/api/reportes/${f}`)).d.historial.length === 2);
    t('Estado inválido se rechaza', (await A[0]('PATCH', `/api/reportes/${f}/estado`, { estado: 'Hackeado' })).s === 400);
    t('Cerrar sesión invalida la cookie', (await ciu('POST', '/api/logout'), (await ciu('GET', '/api/reportes/mios')).s === 401));
    t('Google sin credenciales redirige con aviso', (await inv('GET', '/auth/google')).loc === '/login.html?error=google');
    t('No hay acceso a archivos fuera de /frontend', (await fetch(`${base}/..%2fbackend%2fserver.js`)).status === 404);
  } catch (e) { console.error(e); bad++; }
  console.log(`\n${ok} correctas, ${bad} fallidas`); server.close(); process.exit(bad ? 1 : 0);
});
