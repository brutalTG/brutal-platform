import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupFunnel, type JoinEvent } from './group-funnel.ts';

const ev = (event: JoinEvent['event'], client: string | null, node: string | null, source: string | null, t: string): JoinEvent =>
  ({ event, client_id: client, node_id: node, source, created_at: `2026-10-29T10:${t}:00Z` });

test('embudo del link de grupo: personas, orígenes, reenvíos y sin las pruebas', () => {
  const events = [
    ev('open', 'a', null, 'grupo1', '00'), ev('open', 'a', null, 'grupo1', '01'), ev('joined', 'a', 'n1', 'grupo1', '02'),
    ev('open', 'b', null, null, '03'), ev('joined', 'b', 'n2', null, '04'),
    ev('open', 'c', null, 'r-n1', '05'), ev('joined', 'c', 'n3', 'r-n1', '06'),
    ev('open', 'd', null, 'grupo1', '07'),
    ev('shared', 'a', null, 'r-n1', '08'), ev('shared', 'a', null, 'r-n1', '09'),
    // Prueba: el teléfono "t" entró con un jugador archivado; no cuenta ni su apertura.
    ev('open', 't', null, null, '10'), ev('joined', 't', 'nt', null, '11'),
  ];
  const players = [
    { node_id: 'n1', nickname: 'Coco', archived: false }, { node_id: 'n2', nickname: 'Chavo', archived: false },
    { node_id: 'n3', nickname: 'Bau', archived: false }, { node_id: 'nt', nickname: 'prueba', archived: true },
  ];
  const sessions = [
    { node_id: 'n1', status: 'completed', position: 19, total_ms: 300000, archetype: { title: 'Cínico\nfuncional' }, started_at: '' },
    { node_id: 'n2', status: 'started', position: 12, total_ms: null, archetype: null, started_at: '' },
    { node_id: 'nt', status: 'completed', position: 19, total_ms: 1000, archetype: null, started_at: '' },
  ];
  const f = groupFunnel(events, players, sessions);
  assert.deepEqual([f.opened, f.joined, f.started, f.completed, f.shared], [4, 3, 2, 1, 1]);
  assert.deepEqual(f.viaShare, { opened: 1, joined: 1 });
  assert.equal(f.medianMinutes, 5);
  assert.deepEqual(f.sources.find((s) => s.source === 'grupo1'), { source: 'grupo1', opened: 2, joined: 1, started: 1, completed: 1 });
  assert.deepEqual(f.profiles, [['Cínico funcional', 1]]);
  const chavo = f.players.find((p) => p.nickname === 'Chavo')!;
  assert.equal(chavo.status, 'jugando o se fue');
  assert.equal(chavo.reached, 13);
  assert.equal(f.players.find((p) => p.nickname === 'Bau')!.status, 'sin empezar');
});
