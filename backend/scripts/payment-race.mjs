import assert from 'node:assert/strict';
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const project = 'traveling-payment-race';
const container = `supabase_db_${project}`;
const gateway = `supabase_kong_${project}`;
const rpcName = 'update_pending_settlement_payment';
const [supabaseDir, extraArg] = process.argv.slice(2);
if (!supabaseDir || extraArg) {
  throw new Error('Uso: node backend/scripts/payment-race.mjs <directorio de la pila Supabase aislada>');
}
const workdir = realpathSync(supabaseDir);
if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) {
  throw new Error('Usa un contexto local de Docker sin DOCKER_HOST ni DOCKER_CONTEXT explícitos.');
}
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const dockerHost = docker('context', 'inspect', '--format', '{{.Endpoints.docker.Host}}');
if (!/^(unix:\/\/\/|npipe:\/\/\/\/\.\/pipe\/)/.test(dockerHost)) {
  throw new Error('La prueba requiere Docker con un socket local.');
}

for (const name of [container, gateway]) {
  const label = (key) => docker('inspect', '--format', `{{index .Config.Labels "${key}"}}`, name);
  if (label('com.supabase.cli.project') !== project || realpathSync(label('com.supabase.cli.workdir')) !== workdir) {
    throw new Error('La base y el gateway deben pertenecer a la pila aislada indicada.');
  }
}

// La salida de status contiene claves. Se captura por completo y se emiten errores sin esa salida.
const cli = fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url));
const status = spawnSync(process.execPath, [cli, '--workdir', workdir, 'status', '--output', 'json'], {
  encoding: 'utf8',
  timeout: 15000,
});
if (status.error || status.status !== 0) throw new Error('No se pudo leer el estado de Supabase local.');
let localConfig;
try {
  localConfig = JSON.parse(status.stdout);
} catch {
  throw new Error('Supabase local no devolvió un estado JSON válido.');
}
const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = localConfig;
const loopback = typeof API_URL === 'string' && API_URL.match(/^http:\/\/(?:localhost|127\.0\.0\.1):(\d{1,5})\/?$/);
const bindings = JSON.parse(docker('inspect', '--format', '{{json (index .NetworkSettings.Ports "8000/tcp")}}', gateway));
if (!loopback || !bindings?.some(({ HostIp, HostPort }) =>
  ['127.0.0.1', '0.0.0.0', '::'].includes(HostIp) && HostPort === loopback[1])) {
  throw new Error('La URL de Supabase debe ser loopback y coincidir con el puerto del gateway aislado.');
}
if (typeof ANON_KEY !== 'string' || !ANON_KEY || typeof SERVICE_ROLE_KEY !== 'string' || !SERVICE_ROLE_KEY) {
  throw new Error('La pila local no devolvió las claves de sus roles.');
}

const supabaseUrl = `http://127.0.0.1:${loopback[1]}`;
Object.assign(process.env, {
  NODE_ENV: 'test',
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SECRET_KEY: SERVICE_ROLE_KEY,
  FRONTEND_URL: 'http://127.0.0.1',
  SHARE_LINK_SECRET: randomUUID(),
});

const dbArgs = ['exec', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'];
const sql = (query) => docker(...dbArgs, '-c', query);
if (sql(`select to_regprocedure('public.${rpcName}(bigint,bigint,bigint,numeric,text,text,uuid)') is not null`) !== 't') {
  throw new Error('La pila aislada necesita la migración de edición atómica.');
}

const require = createRequire(import.meta.url);
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();
app.use(express.json());
app.use('/api/auth', require('../dist/routes/auth.router.js').default);
app.use('/api/budget', require('../dist/routes/budget.router.js').default);
app.use(require('../dist/middlewares/errorHandler.middleware.js').errorHandler);
const server = createServer(app);
const { initSocketServer } = require('../dist/infrastructure/sockets/socket.server.js');
const sockets = initSocketServer(server);
const listening = once(server, 'listening');
server.listen(0, '127.0.0.1');
await listening;
const apiRoot = `http://127.0.0.1:${server.address().port}/api`;
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(supabaseUrl, SERVICE_ROLE_KEY, options);
const run = randomUUID().slice(0, 8);
const users = [];
let groupId;

async function data(response) {
  const result = await response;
  assert.ifError(result.error);
  return result.data;
}

async function request(user, method, route, body) {
  const response = await fetch(apiRoot + route, {
    method,
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(24000),
  });
  return { status: response.status, body: await response.json() };
}

async function api(user, method, route, body) {
  const response = await request(user, method, route, body);
  assert(response.status < 300, JSON.stringify(response));
  return response.body;
}

async function createUser(role) {
  const email = `race-${run}-${role}@example.com`;
  const password = `Pw1-${randomUUID()}`;
  const { user } = await data(admin.auth.admin.createUser({ email, password, email_confirm: true }));
  const fixture = { authId: user.id };
  users.push(fixture);
  const client = createClient(supabaseUrl, ANON_KEY, options);
  fixture.client = client;
  const { session } = await data(client.auth.signInWithPassword({ email, password }));
  fixture.token = session.access_token;
  await api(fixture, 'POST', '/auth/sync-user');
  fixture.id = (await data(admin.from('usuarios').select('id_usuario').eq('auth_user_id', user.id).single())).id_usuario;
  return fixture;
}

async function bothQueued(id, submitFirst, submitSecond) {
  assert.match(String(id), /^\d+$/);
  const appName = `race-${run}-${id}`;
  const holder = spawn('docker', ['exec', '-i', ...dbArgs.slice(1)], { stdio: ['pipe', 'pipe', 'inherit'] });
  const exited = once(holder, 'exit');
  let output = '';
  holder.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  holder.stdin.write(`set application_name = '${appName}'; begin; set idle_in_transaction_session_timeout = '20s';
select id from public.settlement_payments where id = ${id} for update; select 'locked';
`);
  const poll = async (condition, label) => {
    const deadline = Date.now() + 7000;
    while (!condition()) {
      assert(Date.now() < deadline, `Timed out: ${label}`);
      await setTimeout(60);
    }
  };
  // La segunda escritura puede esperar por la primera en vez de esperar directamente por holder.
  const waiting = () => sql(`with recursive waiting(pid) as (
    select pid from pg_stat_activity where application_name = '${appName}'
    union
    select a.pid from pg_stat_activity a join waiting w on w.pid = any(pg_blocking_pids(a.pid))
    where a.wait_event_type = 'Lock'
  ) select count(*) - 1 from waiting`);
  const submitted = [];
  try {
    await poll(() => output.includes('locked'), 'row lock acquired');
    submitted.push(submitFirst());
    submitted[0].catch(() => {});
    await poll(() => Number(waiting()) === 1, 'first write queued at the row');
    submitted.push(submitSecond());
    submitted[1].catch(() => {});
    await poll(() => Number(waiting()) === 2, 'second write queued at the row');
  } finally {
    holder.stdin.end('commit;\n\\q\n');
    const [code] = await exited;
    assert.equal(code, 0, 'lock holder closed successfully');
  }
  return Promise.all(submitted);
}

try {
  const creditor = await createUser('creditor');
  const debtor = await createUser('debtor');
  const group = await data(admin.from('grupos_viaje').insert({
    nombre: `Race ${run}`, creado_por: creditor.id, codigo_invitacion: run, presupuesto_total: 5000,
  }).select('id').single());
  groupId = group.id;
  await data(admin.from('grupo_miembros').insert([
    { grupo_id: groupId, usuario_id: creditor.id, rol: 'admin' },
    { grupo_id: groupId, usuario_id: debtor.id, rol: 'viajero' },
  ]));
  const base = `/budget/${groupId}`;
  const payments = `${base}/settlements/payments`;
  await api(creditor, 'POST', `${base}/expenses`, {
    paid_by_user_id: creditor.id, amount: 2000, description: 'Race fixture',
    category: 'transporte', split_type: 'equitativa', member_ids: [creditor.id, debtor.id],
  });
  const proofs = await data(admin.from('trip_documents').insert(['old', 'new'].map((name) => ({
    trip_id: groupId, user_id: debtor.authId, file_name: `${name}.pdf`, file_path: `${run}/${name}.pdf`,
  }))).select('id, file_name'));
  const oldProof = proofs.find(({ file_name }) => file_name === 'old.pdf');
  const newProof = proofs.find(({ file_name }) => file_name === 'new.pdf');
  assert(oldProof && newProof, 'Faltan los comprobantes de prueba.');

  async function pending() {
    const result = await api(debtor, 'POST', payments, {
      from_user_id: debtor.id, to_user_id: creditor.id, amount: 100,
      payment_method: 'transferencia', proof_document_id: oldProof.id, note: 'original',
    });
    return result.paymentHistory.find(({ status }) => status === 'pendiente_validacion').id;
  }

  const changes = { amount: 125, payment_method: 'transferencia', proof_document_id: newProof.id, note: 'edited' };
  const readPayment = (id) => data(admin.from('settlement_payments')
    .select('status, amount, note, paid_at, settlement_payment_documents(trip_document_id)').eq('id', id).maybeSingle());
  const balance = async () => (await api(creditor, 'GET', `${base}/balances`)).data[debtor.id];
  let paid = 0;

  for (const [first, second, codes, amount, proof] of [
    ['confirm', 'edit', [200, 400], 100, oldProof],
    ['edit', 'confirm', [200, 200], 125, newProof],
    ['confirm', 'delete', [200, 400], 100, oldProof],
    ['delete', 'confirm', [200, 400], 0, null],
  ]) {
    const id = await pending();
    const route = `${payments}/${id}`;
    const requests = {
      confirm: () => request(creditor, 'PATCH', `${route}/review`, { status: 'confirmado' }),
      edit: () => request(debtor, 'PATCH', route, changes),
      delete: () => request(debtor, 'DELETE', route),
    };
    const results = await bothQueued(id, requests[first], requests[second]);
    assert.deepEqual(results.map(({ status }) => status), codes, JSON.stringify(results));
    const final = await readPayment(id);
    if (proof) {
      assert.equal(final.status, 'confirmado');
      assert.equal(final.amount, amount);
      assert.equal(final.note, first === 'edit' ? 'edited' : 'original');
      assert.deepEqual(final.settlement_payment_documents, [{ trip_document_id: proof.id }]);
    } else {
      assert.equal(final, null);
      assert.deepEqual(await data(admin.from('settlement_payment_documents').select('id').eq('settlement_payment_id', id)), []);
      assert(await data(admin.from('trip_documents').select('id').eq('id', oldProof.id).single()));
    }
    paid += amount;
    assert.equal(await balance(), -1000 + paid);
    console.log(`${first} → ${second}: HTTP ${codes.join(', ')}; importe, vínculo y saldo verificados`);
  }

  const id = await pending();
  const initial = await readPayment(id);
  const anyProof = randomUUID();
  const invalid = await request(debtor, 'PATCH', `${payments}/${id}`, { ...changes, proof_document_id: anyProof });
  assert.equal(invalid.status, 500);
  assert.deepEqual(await readPayment(id), initial);
  assert.equal(await balance(), -1000 + paid);
  console.log('Comprobante inexistente: HTTP 500; reversión del importe, nota, fecha y vínculo original');

  const args = {
    p_payment_id: id, p_group_id: groupId, p_creator_id: debtor.id,
    p_amount: changes.amount, p_payment_method: changes.payment_method,
    p_note: changes.note, p_proof_document_id: changes.proof_document_id,
  };
  for (const client of [createClient(supabaseUrl, ANON_KEY, options), debtor.client]) {
    const { error } = await client.rpc(rpcName, args);
    assert.equal(error?.code, '42501');
  }
  assert.equal(await data(admin.rpc(rpcName, { ...args, p_creator_id: creditor.id })), false);
  assert.equal(await data(admin.rpc(rpcName, { ...args, p_group_id: groupId + 1 })), false);
  assert.deepEqual(await readPayment(id), initial);
  console.log('RPC: anon y authenticated sin EXECUTE; autor o viaje incorrecto devuelve false');
} finally {
  try {
    if (groupId) await data(admin.from('grupos_viaje').delete().eq('id', groupId));
  } finally {
    const cleanup = await Promise.allSettled(users.map(({ authId }) => data(admin.auth.admin.deleteUser(authId))));
    await sockets.close();
    const failures = cleanup.filter(({ status }) => status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(({ reason }) => reason), 'Falló la limpieza de usuarios de prueba.');
  }
}
