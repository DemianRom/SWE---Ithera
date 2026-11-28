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

async function expectStatus(token, method, route, body, status) {
  const res = await api(token, method, route, body, { raw: true });
  if (res.status !== status) {
    const text = await res.text();
    throw new Error(`${method} ${route}: se esperaba HTTP ${status} y llegó ${res.status} (${text.slice(0, 120)})`);
  }
}

// Las notificaciones se guardan en segundo plano: se reintenta unos segundos.
async function waitForNotification(token, text, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const list = await api(token, 'GET', '/notifications');
    if (JSON.stringify(list).includes(text)) return true;
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 300));
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
  users.groupId = gid; // Permite limpiar el viaje también si termina antes el recorrido.

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

  await step('Viaje sin presupuesto y gasto con fecha anterior al viaje', async () => {
    const created = await api(c.token, 'POST', '/groups', {
      nombre: `Smoke sin presupuesto ${run}`,
      destino: 'Puebla',
      fecha_inicio: day(20),
      fecha_fin: day(22),
    });
    const g2 = created.group?.id;
    assert(g2, 'no se creó el viaje sin presupuesto');
    try {
      assert(created.group.presupuesto_total === null, `presupuesto esperado null, llegó ${created.group.presupuesto_total}`);
      const dash = await api(c.token, 'POST', `/budget/${g2}/expenses`, {
        paid_by_user_id: uc,
        amount: 50,
        description: 'Reserva anticipada',
        category: 'hospedaje',
        split_type: 'equitativa',
        member_ids: [uc],
        expense_date: day(-5),
      });
      assert(dash.summary?.totalBudget === null, 'el tablero debería indicar que no hay presupuesto');
      assert(Number(dash.summary?.committed) === 50, 'no se registró el gasto previo al viaje');
    } finally {
      await api(c.token, 'DELETE', `/groups/${g2}`);
    }
  });

  await step('Detalle del viaje (GET /groups/:id)', async () => {
    await api(a.token, 'GET', `/groups/${gid}`);
  });

  await step('Mis viajes (GET /groups/my-history)', async () => {
    await api(b.token, 'GET', '/groups/my-history');
  });

  // 16:00 UTC = 10:00 en Ciudad de México
  const activity = await step('Crear actividad en el itinerario (integrante, sin votación)', async () => {
    const res = await api(b.token, 'POST', `/groups/${gid}/itinerary/activities`, {
      titulo: 'Visita a Monte Albán',
      descripcion: 'Smoke test',
      ubicacion: 'Monte Albán, Oaxaca',
      fecha_inicio: `${day(8)}T16:00:00.000Z`,
      fecha_fin: `${day(8)}T18:00:00.000Z`,
    });
    assert(res.activity?.id && res.activity.status === 'confirmada', 'la actividad no quedó confirmada');
    return res.activity;
  });

  await step('Consultar itinerario (GET /groups/:id/itinerary)', async () => {
    const res = await api(c.token, 'GET', `/groups/${gid}/itinerary`);
    assert(res.days?.length === 4, `se esperaban 4 días, llegaron ${res.days?.length}`);
    const found = res.days.flatMap((d) => d.activities).find((x) => x.id === activity?.id);
    assert(found?.time === '10:00', `hora esperada 10:00, llegó ${found?.time}`);
  });

  await step('Editar actividad (quien la creó)', async () => {
    const res = await api(b.token, 'PATCH', `/groups/${gid}/itinerary/activities/${activity.id}`, {
      titulo: 'Monte Albán y Atzompa',
    });
    assert(res.activity?.title === 'Monte Albán y Atzompa', 'no se actualizó el título');
  });

  await step('Lugar de Google Places en la actividad (place_id)', async () => {
    const route = `/groups/${gid}/itinerary/activities/${activity.id}`;
    // Identificador con el formato de Google; el backend no consulta a Google.
    const placeId = 'ChIJ_smoke-Test_123';
    let res = await api(b.token, 'PATCH', route, { ubicacion: 'Monte Albán', place_id: placeId });
    assert(res.activity?.placeId === placeId, 'no se guardó el place_id');
    res = await api(b.token, 'PATCH', route, { descripcion: 'Smoke test (lugar)' });
    assert(res.activity?.placeId === placeId, 'se perdió el place_id al editar otro campo');
    await expectStatus(b.token, 'PATCH', route, { place_id: 'no válido!' }, 400);
    res = await api(b.token, 'PATCH', route, { ubicacion: 'Monte Albán, Oaxaca' });
    assert(res.activity?.placeId === null, 'el place_id debe soltarse si cambia el texto sin lugar nuevo');
    await api(b.token, 'PATCH', route, { ubicacion: 'Monte Albán', place_id: placeId });
    res = await api(b.token, 'PATCH', route, { place_id: null });
    assert(
      res.activity?.placeId === null && res.activity?.location === 'Monte Albán',
      'no se pudo quitar el lugar conservando el texto',
    );
  });

  await step('Permisos: otro integrante no edita una actividad ajena', async () => {
    await expectStatus(c.token, 'PATCH', `/groups/${gid}/itinerary/activities/${activity.id}`, { titulo: 'x' }, 403);
  });

  await step('Validación: se rechaza una actividad que se traslapa', async () => {
    await expectStatus(c.token, 'POST', `/groups/${gid}/itinerary/activities`, {
      titulo: 'Traslape',
      fecha_inicio: `${day(8)}T17:00:00.000Z`,
    }, 409);
  });

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

  await step('Reparto porcentual (un reparto inválido no deja gastos a medias)', async () => {
    const before = await api(a.token, 'GET', `/budget/${gid}/dashboard`);
    const base = { paid_by_user_id: ua, amount: 100, category: 'otro', split_type: 'porcentual', expense_date: day(8) };
    await expectStatus(a.token, 'POST', `/budget/${gid}/expenses`, {
      ...base,
      description: 'Porcentaje incompleto',
      split_percentages: { [ua]: 50, [ub]: 40 },
    }, 400);
    const res = await api(a.token, 'POST', `/budget/${gid}/expenses`, {
      ...base,
      description: 'Propinas',
      split_percentages: { [ua]: 33.33, [ub]: 33.33, [uc]: 33.34 },
    });
    const expense = res.expenses?.find((e) => e.description === 'Propinas');
    assert(expense?.splitType === 'porcentual', 'el gasto no quedó como porcentual');
    const shares = [ua, ub, uc].map((id) => expense.splitAmounts[id]);
    assert(shares.join() === '33.33,33.33,33.34', `partes inesperadas: ${shares}`);
    assert(expense.splitPercentages?.[uc] === 33.34, 'no se guardó el porcentaje');
    assert(res.expenses.length === before.expenses.length + 1, 'el intento inválido dejó un gasto a medias');
    // Se borra para no alterar los totales que revisan los pasos siguientes.
    await api(a.token, 'DELETE', `/budget/${gid}/expenses/${expense.id}`);
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

  await step('Comprobantes privados: la URL firmada abre y la pública no', async () => {
    const res = await api(a.token, 'GET', `/groups/${gid}/documents`);
    const item = res.documents.find((d) => String(d.id) === String(doc?.id));
    assert(item?.file_url?.includes('/object/sign/'), 'el documento no trae URL firmada');
    const signed = await fetch(item.file_url);
    assert(signed.ok, `la URL firmada respondió HTTP ${signed.status}`);
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/trip-documents/${item.file_path}`;
    const open = await fetch(publicUrl);
    assert(!open.ok, 'el comprobante es accesible sin firma');
  });

  await step('Ligar comprobante a un gasto (trip_context_links)', async () => {
    assert(doc && expenseB, 'faltan el documento o el gasto de pasos anteriores');
    await api(b.token, 'POST', `/groups/${gid}/context-links`, {
      source: { type: 'expense', id: String(expenseB.id) },
      target: { type: 'document', id: String(doc.id) },
    });
    await api(b.token, 'GET', `/groups/${gid}/context-links`);
  });

  await step('Ligar un gasto a una actividad del itinerario', async () => {
    assert(activity && expenseB, 'faltan la actividad o el gasto de pasos anteriores');
    await api(b.token, 'POST', `/groups/${gid}/context-links`, {
      source: { type: 'expense', id: String(expenseB.id) },
      target: { type: 'activity', id: String(activity.id) },
    });
  });

  const assertBalances = (balances, expected) => {
    for (const [userId, amount] of Object.entries(expected)) {
      const actual = balances?.[userId];
      assert(actual !== undefined && actual !== null && Number(actual) === amount,
        `saldo de ${userId}: esperado ${amount}, llegó ${actual}`);
    }
  };
  const beforePayment = { [ua]: 500, [ub]: -50, [uc]: -450 };
  const afterPayment = { [ua]: 200, [ub]: -50, [uc]: -150 };
  await step('Saldos individuales antes del pago', async () => {
    const res = await api(a.token, 'GET', `/budget/${gid}/balances`);
    assertBalances(res.data, beforePayment);
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
    assertBalances(res.balances, beforePayment);
    const balances = await api(a.token, 'GET', `/budget/${gid}/balances`);
    assertBalances(balances.data, beforePayment);
    return item;
  });

  await step('Confirmar el pago (acreedor)', async () => {
    assert(payment, 'falta el pago del paso anterior');
    const res = await api(a.token, 'PATCH', `/budget/${gid}/settlements/payments/${payment.id}/review`, {
      status: 'confirmado',
    });
    const item = res.paymentHistory?.find((p) => String(p.id) === String(payment.id));
    assert(item?.status === 'confirmado', `estado final: ${item?.status}`);
    assertBalances(res.balances, afterPayment);
    const balances = await api(a.token, 'GET', `/budget/${gid}/balances`);
    assertBalances(balances.data, afterPayment);
    await expectStatus(a.token, 'PATCH', `/budget/${gid}/settlements/payments/${payment.id}/review`,
      { status: 'confirmado' }, 400);
    const afterRetry = await api(a.token, 'GET', `/budget/${gid}/balances`);
    assertBalances(afterRetry.data, afterPayment);
  });

  const rejectedPayment = await step('Rechazar pago parcial sin alterar saldos', async () => {
    const route = `/budget/${gid}/settlements/payments`;
    const registered = await api(c.token, 'POST', route, {
      from_user_id: uc,
      to_user_id: ua,
      amount: 100,
      payment_method: 'efectivo_presencial',
      note: 'Pago de prueba para rechazo',
    });
    const item = registered.paymentHistory?.find((p) => p.status === 'pendiente_validacion');
    assert(item?.id, 'el pago para rechazo no aparece pendiente');
    assertBalances(registered.balances, afterPayment);
    const review = `${route}/${item.id}/review`;
    await expectStatus(c.token, 'PATCH', review, { status: 'rechazado', rejection_reason: 'Prueba' }, 403);
    await expectStatus(a.token, 'PATCH', review, { status: 'rechazado' }, 400);
    const rejected = await api(a.token, 'PATCH', review, {
      status: 'rechazado', rejection_reason: 'Comprobante incorrecto',
    });
    const result = rejected.paymentHistory?.find((p) => String(p.id) === String(item.id));
    assert(result?.status === 'rechazado', `estado final: ${result?.status}`);
    assert(result?.rejection_reason === 'Comprobante incorrecto', 'no se conservó el motivo de rechazo');
    assertBalances(rejected.balances, afterPayment);
    const balances = await api(a.token, 'GET', `/budget/${gid}/balances`);
    assertBalances(balances.data, afterPayment);
    return result;
  });

  const correctedPayment = await step('Corregir un pago rechazado mediante un registro nuevo', async () => {
    assert(rejectedPayment?.id, 'falta el pago rechazado');
    const route = `/budget/${gid}/settlements/payments`;
    const correction = { amount: 90, payment_method: 'efectivo_presencial', note: 'Pago corregido' };
    await expectStatus(c.token, 'PATCH', `${route}/${rejectedPayment.id}`, correction, 400);
    const registered = await api(c.token, 'POST', route, {
      from_user_id: uc, to_user_id: ua, amount: 100, payment_method: 'efectivo_presencial',
      note: 'Nuevo pago tras rechazo',
    });
    const item = registered.paymentHistory?.find((p) => p.status === 'pendiente_validacion');
    assert(item?.id && String(item.id) !== String(rejectedPayment.id), 'falta el nuevo pago');
    const updated = await api(c.token, 'PATCH', `${route}/${item.id}`, correction);
    const corrected = updated.paymentHistory?.find((p) => String(p.id) === String(item.id));
    assert(corrected?.status === 'pendiente_validacion' && Number(corrected.amount) === 90,
      'no se guardó la corrección del pago pendiente');
    assertBalances(updated.balances, afterPayment);
    return corrected;
  });

  await step('Confirmaciones simultáneas: un solo éxito y un solo efecto', async () => {
    assert(correctedPayment?.id, 'falta el pago corregido');
    const route = `/budget/${gid}/settlements/payments/${correctedPayment.id}/review`;
    const responses = await Promise.all([1, 2].map(() =>
      api(a.token, 'PATCH', route, { status: 'confirmado' }, { raw: true })));
    const statuses = responses.map((res) => res.status).sort();
    const dashboard = await api(a.token, 'GET', `/budget/${gid}/dashboard`);
    const item = dashboard.paymentHistory?.find((p) => String(p.id) === String(correctedPayment.id));
    const expected = { [ua]: 110, [ub]: -50, [uc]: -60 };
    assert(item?.status === 'confirmado', `estado final: ${item?.status}; HTTP ${statuses}`);
    assertBalances(dashboard.balances, expected);
    const balances = await api(a.token, 'GET', `/budget/${gid}/balances`);
    assertBalances(balances.data, expected);
    assert(statuses.join() === '200,400', `revisiones simultáneas: HTTP ${statuses}; se esperaba 200,400`);
  });

  await step('Revisiones opuestas simultáneas: un único resultado', async () => {
    const route = `/budget/${gid}/settlements/payments`;
    const registered = await api(c.token, 'POST', route, {
      from_user_id: uc, to_user_id: ua, amount: 20, payment_method: 'efectivo_presencial',
      note: 'Prueba de revisión simultánea',
    });
    const paymentToReview = registered.paymentHistory?.find((p) => p.status === 'pendiente_validacion');
    assert(paymentToReview?.id, 'falta el pago para revisiones opuestas');
    const review = `${route}/${paymentToReview.id}/review`;
    const responses = await Promise.all([
      api(a.token, 'PATCH', review, { status: 'confirmado' }, { raw: true }),
      api(a.token, 'PATCH', review, { status: 'rechazado', rejection_reason: 'Prueba concurrente' }, { raw: true }),
    ]);
    const statuses = responses.map((res) => res.status);
    const dashboard = await api(a.token, 'GET', `/budget/${gid}/dashboard`);
    const item = dashboard.paymentHistory?.find((p) => String(p.id) === String(paymentToReview.id));
    assert(item?.status === 'confirmado' || item?.status === 'rechazado', `estado final: ${item?.status}; HTTP ${statuses}`);
    const expected = item.status === 'confirmado'
      ? { [ua]: 90, [ub]: -50, [uc]: -40 }
      : { [ua]: 110, [ub]: -50, [uc]: -60 };
    assertBalances(dashboard.balances, expected);
    const balances = await api(a.token, 'GET', `/budget/${gid}/balances`);
    assertBalances(balances.data, expected);
    const winner = item.status === 'confirmado' ? 0 : 1;
    assert(statuses[winner] === 200 && statuses[1 - winner] === 400,
      `revisiones opuestas: HTTP ${statuses}; estado final ${item.status}`);
  });

  await step('Recibo de cobro en PDF', async () => {
    const res = await api(a.token, 'POST', `/budget/${gid}/settlements/receipt-pdf`, {
      folio: `SMOKE-${run}`, creditor: a.nombre, debtor: c.nombre, amount: '300.00',
    }, { raw: true });
    assert(res.ok, `HTTP ${res.status}`);
    assert((res.headers.get('content-type') ?? '').includes('pdf'), 'no es PDF');
  });

  await step('Notificaciones y preferencias', async () => {
    assert(await waitForNotification(a.token, 'solicitud_union'), 'no llegó la notificación de la solicitud de unión');
    await api(a.token, 'GET', '/notifications/unread-count');
    await api(a.token, 'PATCH', '/notifications/preferences', { notificaciones_finanzas: true });
    await api(a.token, 'PATCH', '/notifications/read-all');
  });

  await step('Notificación del pago por validar al acreedor', async () => {
    assert(await waitForNotification(a.token, 'pago_por_validar'), 'no llegó el aviso de pago por validar');
  });

  await step('Notificación de gasto nuevo a los involucrados', async () => {
    assert(await waitForNotification(b.token, 'gasto_creado'), 'no llegó el aviso de gasto nuevo');
  });

  await step('Notificación de pago confirmado al deudor', async () => {
    assert(await waitForNotification(c.token, 'pago_confirmado'), 'no llegó el aviso de pago confirmado');
  });

  await step('Presupuesto por categoría', async () => {
    const dash = await api(a.token, 'PUT', `/budget/${gid}/categories`, {
      categories: { comida: 800, transporte: 200, otro: null },
    });
    assert(Number(dash.summary?.categoryBudgets?.comida) === 800, 'no se guardó el presupuesto de comida');
    assert(dash.summary?.categoryBudgets?.otro === null, 'la categoría vacía debería quedar sin límite');
  });

  await step('Permisos: solo un admin cambia el presupuesto', async () => {
    await expectStatus(b.token, 'PUT', `/budget/${gid}/categories`, { categories: { comida: 1 } }, 403);
  });

  await step('Alerta al exceder el presupuesto total', async () => {
    await api(a.token, 'PATCH', `/budget/${gid}`, { totalBudget: 1500 });
    await api(a.token, 'POST', `/budget/${gid}/expenses`, {
      paid_by_user_id: ua,
      amount: 400,
      description: 'Museo',
      category: 'actividad',
      split_type: 'equitativa',
      member_ids: [ua, ub, uc],
      expense_date: day(9),
    });
    assert(await waitForNotification(b.token, 'Presupuesto excedido'), 'no llegó la alerta de presupuesto');
  });

  await step('Resumen de gastos (por categoría, integrante y día)', async () => {
    const summary = await api(b.token, 'GET', `/budget/${gid}/summary`);
    assert(summary.totals?.committed === 1600, `total esperado 1600, llegó ${summary.totals?.committed}`);
    assert(summary.byMember?.length === 3, 'faltan integrantes en el resumen');
    const comida = summary.byCategory?.find((item) => item.category === 'comida');
    assert(comida?.planned === 800 && comida?.spent === 900, 'comida: planeado/gastado incorrecto');
    const balanceSum = summary.byMember.reduce((sum, member) => sum + member.balance, 0);
    assert(Math.abs(balanceSum) < 0.05, `los saldos no suman cero (${balanceSum})`);
  });

  await step('Exportar gastos a CSV', async () => {
    const res = await api(c.token, 'GET', `/budget/${gid}/export.csv`, undefined, { raw: true });
    assert(res.ok, `HTTP ${res.status}`);
    assert((res.headers.get('content-type') ?? '').includes('text/csv'), 'no es CSV');
    const bytes = new Uint8Array(await res.arrayBuffer());
    const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const text = new TextDecoder().decode(bytes);
    assert(hasBom, 'el CSV no trae BOM UTF-8 (Excel mostraría mal los acentos)');
    assert(text.includes('Descripción') && text.includes('Museo'), 'CSV incompleto');
  });

  await step('Resumen de gastos en PDF', async () => {
    const res = await api(c.token, 'GET', `/budget/${gid}/summary.pdf`, undefined, { raw: true });
    assert(res.ok, `HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert(new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-', 'no es un PDF');
  });

  await step('Quitar el presupuesto total', async () => {
    const dash = await api(a.token, 'PATCH', `/budget/${gid}`, { totalBudget: null });
    assert(dash.summary?.totalBudget === null, 'el presupuesto no se quitó');
  });

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

  await step('Eliminar actividad (admin) y sus enlaces', async () => {
    await api(a.token, 'DELETE', `/groups/${gid}/itinerary/activities/${activity.id}`);
    const res = await api(a.token, 'GET', `/groups/${gid}/context-links`);
    assert(!JSON.stringify(res).includes(`"activity","id":"${activity.id}"`), 'quedó un enlace a la actividad borrada');
  });

  await step('Viaje cerrado: no se registran gastos', async () => {
    await api(a.token, 'PATCH', `/groups/${gid}/close`);
    await expectStatus(b.token, 'POST', `/budget/${gid}/expenses`, {
      paid_by_user_id: ub,
      amount: 10,
      description: 'Después del cierre',
      category: 'otro',
      split_type: 'equitativa',
      member_ids: [ub],
      expense_date: day(9),
    }, 409);
  });

  await step('Viaje cerrado: sí se pueden liquidar pagos pendientes', async () => {
    await api(c.token, 'POST', `/budget/${gid}/settlements/payments`, {
      from_user_id: uc,
      to_user_id: ua,
      amount: 10,
      payment_method: 'efectivo_presencial',
    });
  });

  await step('No se borra una cuenta con gastos compartidos', async () => {
    await expectStatus(c.token, 'DELETE', '/auth/me', undefined, 409);
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
