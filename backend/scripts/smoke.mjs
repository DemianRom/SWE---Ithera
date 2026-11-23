#!/usr/bin/env node
// Smoke test de punta a punta contra un backend de Traveling en ejecución.
//
// Crea 3 usuarios de prueba (confirmados, sin enviar correos), recorre los flujos de la
// base común y de finanzas, y al final borra todo lo que creó (viaje, archivos y usuarios).
//
// Uso (desde backend/):
//   SMOKE_API_URL=http://localhost:3001/api npm run smoke
//   SMOKE_API_URL=https://traveling.tonyquezada.com/api npm run smoke
//
// Variables (si no están en el entorno, se leen de backend/.env):
//   SMOKE_API_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY
// Opciones:
//   --keep   no borra nada al final (para depurar)
//
// Los pasos marcados con "esperado hasta la fase N" dependen de código que todavía usa
// tablas del Equipo 1; si fallan no cuentan como error (ver docs/plan-traveling.md).

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const KEEP = process.argv.includes('--keep');
const API = (process.env.SMOKE_API_URL ?? 'http://localhost:3001/api').replace(/\/+$/, '');
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SECRET_KEY) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SECRET_KEY');
  process.exit(2);
}

const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, clientOptions);

const run = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
const results = [];

// ── utilidades ───────────────────────────────────────────────────────────────
const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

async function api(token, method, route, body, { raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${route}`, { method, headers, body: payload });
  if (raw) return res;
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === 'object' ? (data.error ?? data.message ?? JSON.stringify(data)) : text.slice(0, 200);
    throw new Error(`${method} ${route} → HTTP ${res.status}: ${msg}`);
  }
  return data;
}

async function step(name, fn, { expectedUntil } = {}) {
  try {
    const value = await fn();
    results.push({ name, status: expectedUntil ? 'xpass' : 'ok', expectedUntil });
    return value === undefined ? true : value;
  } catch (err) {
    results.push({
      name,
      status: expectedUntil ? 'xfail' : 'fail',
      expectedUntil,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── usuarios de prueba ───────────────────────────────────────────────────────
const users = {};

async function createUser(key, nombre) {
  const email = `traveling-smoke+${run}-${key}@example.com`;
  const password = `Sm0ke-${randomBytes(9).toString('base64url')}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: nombre },
  });
  if (error) throw error;
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions);
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  users[key] = { authId: data.user.id, email, nombre, token: session.session.access_token };
}

// ── flujo ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Smoke test ${run} contra ${API}\n`);

  const ready = await step('Crear 3 usuarios de prueba e iniciar sesión', async () => {
    await createUser('a', 'Smoke Ana');
    await createUser('b', 'Smoke Beto');
    await createUser('c', 'Smoke Caro');
  });
  if (!ready) return;
  const { a, b, c } = users;

  await step('Sincronizar usuarios locales (POST /auth/sync-user)', async () => {
    for (const u of [a, b, c]) await api(u.token, 'POST', '/auth/sync-user');
  });

  await step('Consultar perfil (GET /auth/me)', async () => {
    const me = await api(a.token, 'GET', '/auth/me');
    assert(JSON.stringify(me).includes(a.email), 'el perfil no trae el correo');
  });

  const group = await step('Crear viaje (POST /groups)', async () => {
    const res = await api(a.token, 'POST', '/groups', {
      nombre: `Smoke ${run}`,
      descripcion: 'Viaje creado por el smoke test',
      destino: 'Oaxaca',
      fecha_inicio: day(7),
      fecha_fin: day(10),
      maximo_miembros: 10,
      es_publico: true,
      presupuesto_total: 15000,
    });
    assert(res.group?.id && res.group?.codigo_invitacion, 'respuesta sin id o código');
    return res.group;
  });
  if (!group) return;
  const gid = group.id;

  await step('Unirse a viaje público con código (POST /groups/join)', async () => {
    await api(b.token, 'POST', '/groups/join', { codigo: group.codigo_invitacion });
  });

  await step('Volver privado el viaje (PATCH /groups/:id)', async () => {
    await api(a.token, 'PATCH', `/groups/${gid}`, { es_publico: false });
  });

  await step('Solicitud de unión a viaje privado y aprobación', async () => {
    const join = await api(c.token, 'POST', '/groups/join', { codigo: group.codigo_invitacion });
    assert(join.group?.requiresApproval, 'se esperaba que requiriera aprobación');
    const list = await api(a.token, 'GET', `/groups/${gid}/join-requests`);
    const request = (list.requests ?? list.data ?? list.joinRequests ?? []).find?.((r) => r.estado === 'pendiente')
      ?? JSON.stringify(list).match(/"id":"?(\d+)"?[^}]*"estado":"pendiente"/)?.[1];
    const requestId = typeof request === 'object' ? request.id : request;
    assert(requestId, `no se encontró la solicitud pendiente en ${JSON.stringify(list).slice(0, 200)}`);
    await api(a.token, 'PATCH', `/groups/${gid}/join-requests/${requestId}`, { action: 'approve' });
  });

  const members = await step('Listar integrantes (GET /groups/:id/members)', async () => {
    const res = await api(a.token, 'GET', `/groups/${gid}/members`);
    assert(res.members?.length === 3, `se esperaban 3 integrantes, hay ${res.members?.length}`);
    return res.members;
  });
  if (!members) return;
  const idOf = (u) => String(members.find((m) => m.email === u.email)?.usuario_id);
  const [ua, ub, uc] = [idOf(a), idOf(b), idOf(c)];

  await step('Detalle del viaje (GET /groups/:id)', async () => {
    await api(a.token, 'GET', `/groups/${gid}`);
  });

  await step('Mis viajes (GET /groups/my-history)', async () => {
    await api(b.token, 'GET', '/groups/my-history');
  });

  await step('Crear actividad en el itinerario', async () => {
    await api(a.token, 'POST', `/groups/${gid}/itinerary/activities`, {
      titulo: 'Visita a Monte Albán',
      descripcion: 'Smoke test',
      ubicacion: 'Monte Albán, Oaxaca',
      fecha_inicio: `${day(8)}T16:00:00.000Z`,
      fecha_fin: `${day(8)}T18:00:00.000Z`,
    });
  }, { expectedUntil: 4 });

  await step('Consultar itinerario (GET /groups/:id/itinerary)', async () => {
    await api(a.token, 'GET', `/groups/${gid}/itinerary`);
  }, { expectedUntil: 4 });

  await step('Registrar gasto con reparto equitativo', async () => {
    await api(a.token, 'POST', `/budget/${gid}/expenses`, {
      paid_by_user_id: ua,
      amount: 900,
      description: 'Cena',
      category: 'comida',
      split_type: 'equitativa',
      member_ids: [ua, ub, uc],
      expense_date: day(8),
    });
  });

  const expenseB = await step('Registrar gasto con reparto personalizado', async () => {
    const res = await api(b.token, 'POST', `/budget/${gid}/expenses`, {
      paid_by_user_id: ub,
      amount: 300,
      description: 'Taxi',
      category: 'transporte',
      split_type: 'personalizada',
      split_amounts: { [ua]: 100, [ub]: 50, [uc]: 150 },
      expense_date: day(8),
    });
    const expense = res.expenses?.find((e) => e.description === 'Taxi');
    assert(expense, 'el gasto no aparece en el tablero');
    return expense;
  });

  await step('Tablero, saldos y liquidaciones', async () => {
    const dash = await api(a.token, 'GET', `/budget/${gid}/dashboard`);
    assert(Number(dash.summary?.committed) === 1200, `comprometido esperado 1200, llegó ${dash.summary?.committed}`);
    await api(a.token, 'GET', `/budget/${gid}/balances`);
    await api(a.token, 'GET', `/budget/${gid}/settlements`);
  });

  const doc = await step('Subir comprobante (POST /groups/:id/documents)', async () => {
    const form = new FormData();
    const pdf = '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n';
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'comprobante.pdf');
    form.append('category', 'otro');
    const res = await api(c.token, 'POST', `/groups/${gid}/documents`, form);
    assert(res.document?.id, 'respuesta sin id de documento');
    return res.document;
  });

  await step('Listar archivos del viaje', async () => {
    const res = await api(a.token, 'GET', `/groups/${gid}/documents`);
    assert(res.documents?.length >= 1, 'no aparece el documento');
  });

  await step('Ligar comprobante a un gasto (trip_context_links)', async () => {
    assert(doc && expenseB, 'faltan el documento o el gasto de pasos anteriores');
    await api(b.token, 'POST', `/groups/${gid}/context-links`, {
      source: { type: 'expense', id: String(expenseB.id) },
      target: { type: 'document', id: String(doc.id) },
    });
    await api(b.token, 'GET', `/groups/${gid}/context-links`);
  });

  const payment = await step('Registrar pago entre compañeros con comprobante', async () => {
    assert(doc, 'falta el documento del paso anterior');
    const res = await api(c.token, 'POST', `/budget/${gid}/settlements/payments`, {
      from_user_id: uc,
      to_user_id: ua,
      amount: 300,
      payment_method: 'transferencia',
      proof_document_id: String(doc.id),
      note: 'Smoke test',
    });
    const item = res.paymentHistory?.find((p) => p.status === 'pendiente_validacion');
    assert(item?.id, 'el pago no aparece como pendiente de validación');
    return item;
  });

  await step('Confirmar el pago (acreedor)', async () => {
    assert(payment, 'falta el pago del paso anterior');
    const res = await api(a.token, 'PATCH', `/budget/${gid}/settlements/payments/${payment.id}/review`, {
      status: 'confirmado',
    });
    const item = res.paymentHistory?.find((p) => String(p.id) === String(payment.id));
    assert(item?.status === 'confirmado', `estado final: ${item?.status}`);
  });

  await step('Recibo de cobro en PDF', async () => {
    const res = await api(a.token, 'POST', `/budget/${gid}/settlements/receipt-pdf`, {
      folio: `SMOKE-${run}`, creditor: a.nombre, debtor: c.nombre, amount: '300.00',
    }, { raw: true });
    assert(res.ok, `HTTP ${res.status}`);
    assert((res.headers.get('content-type') ?? '').includes('pdf'), 'no es PDF');
  });

  await step('Notificaciones y preferencias', async () => {
    const list = await api(a.token, 'GET', '/notifications');
    assert(JSON.stringify(list).includes('solicitud_union'), 'no llegó la notificación de la solicitud de unión');
    await api(a.token, 'GET', '/notifications/unread-count');
    await api(a.token, 'PATCH', '/notifications/preferences', { notificaciones_finanzas: true });
    await api(a.token, 'PATCH', '/notifications/read-all');
  });

  await step('Notificación del pago por validar al acreedor', async () => {
    const list = await api(a.token, 'GET', '/notifications');
    assert(/pago|liquidaci/i.test(JSON.stringify(list)), 'los gastos y pagos aún no generan notificaciones');
  }, { expectedUntil: 5 });

  await step('Chat grupal', async () => {
    await api(b.token, 'POST', `/groups/${gid}/chat/messages`, { contenido: 'Hola desde el smoke test' });
    const res = await api(a.token, 'GET', `/groups/${gid}/chat/messages`);
    assert(JSON.stringify(res).includes('smoke test'), 'no aparece el mensaje');
  });

  await step('Enlace público del itinerario', async () => {
    const share = await api(a.token, 'GET', `/export/share-link/${gid}`);
    assert(share.token, 'sin token');
    await api(null, 'GET', `/export/shared/${share.token}`);
  });

  await step('Estadísticas del perfil (GET /auth/me/stats)', async () => {
    await api(a.token, 'GET', '/auth/me/stats');
  });

  await step('RLS: con la publishable key no se leen ni escriben tablas', async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions);
    for (const table of ['usuarios', 'grupos_viaje', 'expenses', 'settlement_payments', 'trip_documents']) {
      // Sin privilegios responde "permission denied"; con RLS sin políticas, una lista vacía.
      const { data, error } = await anon.from(table).select('*').limit(1);
      assert(error || data?.length === 0, `${table}: la publishable key pudo leer filas`);
    }
    const { error } = await anon.from('grupos_viaje').insert({ nombre: 'x', codigo_invitacion: run, presupuesto_total: 1 });
    assert(error, 'la publishable key pudo insertar en grupos_viaje');
  });

  await step('Eliminar viaje (DELETE /groups/:id)', async () => {
    if (KEEP) return;
    await api(a.token, 'DELETE', `/groups/${gid}`);
    users.groupDeleted = true;
  });
  users.groupId = gid;
}

async function cleanup() {
  if (KEEP) {
    console.log(`\n--keep: se conservan el viaje ${users.groupId ?? '-'} y los usuarios ${run}`);
    return;
  }
  const errors = [];
  if (users.groupId) {
    const { data: files } = await admin.storage.from('trip-documents').list(String(users.groupId));
    const paths = (files ?? []).map((f) => `${users.groupId}/${f.name}`);
    if (paths.length) {
      const { error } = await admin.storage.from('trip-documents').remove(paths);
      if (error) errors.push(`archivos: ${error.message}`);
    }
    if (!users.groupDeleted) {
      const { error } = await admin.from('grupos_viaje').delete().eq('id', users.groupId);
      if (error) errors.push(`viaje: ${error.message}`);
    }
  }
  for (const key of ['a', 'b', 'c']) {
    if (!users[key]) continue;
    const { error } = await admin.auth.admin.deleteUser(users[key].authId);
    if (error) errors.push(`usuario ${key}: ${error.message}`);
  }
  results.push({ name: 'Limpieza (archivos, viaje y usuarios de prueba)', status: errors.length ? 'fail' : 'ok', error: errors.join('; ') });
}

try {
  await main();
} catch (err) {
  results.push({ name: 'Error inesperado', status: 'fail', error: String(err?.stack ?? err) });
} finally {
  await cleanup();
}

const icon = { ok: '✓', fail: '✗', xfail: '·', xpass: '!' };
for (const r of results) {
  let line = `${icon[r.status]} ${r.name}`;
  if (r.status === 'xfail') line += `  (falla esperada hasta la fase ${r.expectedUntil})`;
  if (r.status === 'xpass') line += `  (pasó; ya no depende de la fase ${r.expectedUntil})`;
  console.log(line);
  if (r.error && r.status !== 'ok') console.log(`    ${r.error}`);
}
const failed = results.filter((r) => r.status === 'fail').length;
console.log(`\n${results.length - failed}/${results.length} pasos sin error inesperado`);
process.exit(failed ? 1 : 0);
