// Arma la base desde cero con todas las migraciones y prueba las reglas duras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

async function freshDb() {
  const db = new PGlite();
  // Roles que Supabase trae de fábrica.
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;`);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return db;
}

const adultBirth = '1995-05-10';
const minorBirth = new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10);

async function node(db, phone, birth) {
  const { rows } = await db.query(
    `insert into core.nodes (phone_e164, birth_date, status) values ($1, $2, 'active') returning id`, [phone, birth]);
  return rows[0].id;
}

test('todas las migraciones corren desde cero', async () => {
  const db = await freshDb();
  const { rows } = await db.query(`select count(*)::int as n from pg_tables where schemaname in ('core','signal','profile','economy','messaging','drops','pressure')`);
  assert.equal(rows[0].n, 38);
  const v = await db.query(`select count(*)::int as n from core.ops_kpis`);
  assert.equal(v.rows[0].n, 1);
  const rls = await db.query(`select count(*)::int as n from pg_tables where schemaname in ('core','signal','profile','economy','messaging','drops','pressure') and not rowsecurity`);
  assert.equal(rls.rows[0].n, 0, 'toda tabla tiene RLS');
});

test('cada nodo nuevo recibe su seudónimo', async () => {
  const db = await freshDb();
  const id = await node(db, '+5491100000001', adultBirth);
  const { rows } = await db.query(`select pseudonym_id from core.node_pseudonyms where node_id = $1`, [id]);
  assert.equal(rows.length, 1);
});

test('un menor nunca recibe efectivo, pero sí tickets', async () => {
  const db = await freshDb();
  const minor = await node(db, '+5491100000002', minorBirth);
  await assert.rejects(db.query(
    `insert into economy.ledger (node_id, currency, amount, activity, idempotency_key) values ($1, 'cash_usd', 1, 'test', 'k1')`, [minor]),
    /verified adult/);
  await db.query(`insert into economy.ledger (node_id, currency, amount, activity, idempotency_key) values ($1, 'tickets', 5, 'test', 'k2')`, [minor]);
  const { rows } = await db.query(`select tickets::int from economy.balances where node_id = $1`, [minor]);
  assert.equal(rows[0].tickets, 5);
});

test('sin fecha de nacimiento no hay efectivo', async () => {
  const db = await freshDb();
  const unknown = await node(db, '+5491100000003', null);
  await assert.rejects(db.query(
    `insert into economy.ledger (node_id, currency, amount, activity, idempotency_key) values ($1, 'cash_usd', 1, 'test', 'k3')`, [unknown]),
    /verified adult/);
});

test('un adulto cobra efectivo y el libro no se puede editar', async () => {
  const db = await freshDb();
  const adult = await node(db, '+5491100000004', adultBirth);
  await db.query(`insert into economy.ledger (node_id, currency, amount, activity, idempotency_key) values ($1, 'cash_usd', 2.5, 'test', 'k4')`, [adult]);
  await assert.rejects(db.query(`update economy.ledger set amount = 100`), /append-only/);
  await assert.rejects(db.query(`delete from economy.ledger`), /append-only/);
});

test('las observaciones no se reescriben; solo cambia su calidad', async () => {
  const db = await freshDb();
  const id = await node(db, '+5491100000005', adultBirth);
  const { rows: [p] } = await db.query(`select pseudonym_id from core.node_pseudonyms where node_id = $1`, [id]);
  const { rows: [o] } = await db.query(
    `insert into signal.observations (pseudonym_id, app_slug, instrument_type, instrument_id, kind, value, observed_at, idempotency_key)
     values ($1, 'drops', 'drop', 'd1', 'choice', '{"option":"A"}', now(), 'o1') returning id`, [p.pseudonym_id]);
  await assert.rejects(db.query(`update signal.observations set value = '{"option":"B"}' where id = $1`, [o.id]), /immutable/);
  await db.query(`update signal.observations set quality = 'declared_lie' where id = $1`, [o.id]);
  await assert.rejects(db.query(`delete from signal.observations where id = $1`, [o.id]), /append-only/);
});

test('una sola temporada activa', async () => {
  const db = await freshDb();
  await db.query(`insert into economy.seasons (slug, name, starts_at, ends_at, status) values ('s1','S1', now(), now() + interval '30 days', 'active')`);
  await assert.rejects(db.query(`insert into economy.seasons (slug, name, starts_at, ends_at, status) values ('s2','S2', now(), now() + interval '30 days', 'active')`));
});

test('cambiar el contenido del detector sube la versión', async () => {
  const db = await freshDb();
  const { rows } = await db.query(`insert into pressure.experiments (slug, name) values ('detector-test', 'Detector') returning id, content_version`);
  const exp = rows[0];
  await db.query(`insert into pressure.items (experiment_id, section, kind, prompt, answer_type) values ($1, 'game', 'fun', '¿Lloraste con la final?', 'yes_no')`, [exp.id]);
  const after = await db.query(`select content_version from pressure.experiments where id = $1`, [exp.id]);
  assert.equal(after.rows[0].content_version, exp.content_version + 1);
  await assert.rejects(db.query(
    `insert into pressure.items (experiment_id, section, kind, prompt, answer_type) values ($1, 'game', 'calibration', 'Edad', 'number')`, [exp.id]));
});

test('una sola partida con premio por nodo; las revanchas no cobran', async () => {
  const db = await freshDb();
  const id = await node(db, '+5491100000009', adultBirth);
  const p = (await db.query(`select pseudonym_id from core.node_pseudonyms where node_id = $1`, [id])).rows[0].pseudonym_id;
  const exp = (await db.query(`insert into pressure.experiments (slug, name) values ('detector-test', 'Detector') returning id`)).rows[0].id;
  // Una sola partida con premio. Si se corta y vuelve a empezar, la vieja pasa a revancha.
  const first = (await db.query(`insert into pressure.sessions (pseudonym_id, experiment_id) values ($1, $2) returning id`, [p, exp])).rows[0].id;
  await assert.rejects(db.query(`insert into pressure.sessions (pseudonym_id, experiment_id) values ($1, $2)`, [p, exp]));
  await db.query(`update pressure.sessions set replay = true, status = 'interrupted' where id = $1`, [first]);
  await db.query(`insert into pressure.sessions (pseudonym_id, experiment_id) values ($1, $2)`, [p, exp]);
  await db.query(`insert into pressure.sessions (pseudonym_id, experiment_id, replay) values ($1, $2, true)`, [p, exp]);
  const alias = (await db.query(`select core.public_alias($1) as a`, [p])).rows[0].a;
  assert.match(alias, /^NODO-[0-9A-F]{4}$/);
});

test('el panel guarda el orden de un Drop de una vez, sin chocar posiciones', async () => {
  const db = await freshDb();
  const q = [];
  for (let i = 0; i < 3; i++) {
    const { rows } = await db.query(`insert into drops.questions (format, label, content) values ('choice', $1, '{}') returning id`, [`q${i}`]);
    q.push(rows[0].id);
  }
  const d = '11111111-1111-4111-8111-111111111111';
  const save = (ids, off = []) => db.query(`select drops.panel_save_drop($1::jsonb)`, [JSON.stringify({ id: d, slug: 'drop-x', name: 'X', config: { a: 1 }, question_ids: ids, disabled_ids: off })]);
  await save(q);
  await save([q[2], q[0], q[1]], [q[0]]);
  const { rows } = await db.query(`select question_id, position, enabled from drops.drop_questions where drop_id = $1 order by position`, [d]);
  assert.deepEqual(rows.map((r) => [r.question_id, r.position, r.enabled]), [[q[2], 0, true], [q[0], 1, false], [q[1], 2, true]]);
  await save([q[1]]);
  const left = await db.query(`select count(*)::int n from drops.drop_questions where drop_id = $1`, [d]);
  assert.equal(left.rows[0].n, 1);
  await assert.rejects(save([q[1], q[1]]), /dos veces/);
});
