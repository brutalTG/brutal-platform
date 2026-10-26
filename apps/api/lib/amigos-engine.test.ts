// Una temporada entera de AMIGOS DE MIERDA en memoria: armar el grupo, entrar, contestar, apostar,
// mandar audios, revelar, calificar, pausar y cerrar con etiquetas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './amigos/memory-store.ts';
import { advance, handleInbound, tick, type Ctx, type Urls } from './amigos/engine.ts';
import { atLocal } from './amigos/rules.ts';

const urls: Urls = {
  question: (q, o) => `https://img.test/q/${q.id}?by=${encodeURIComponent(o.by)}${o.teaser ? '&t=1' : ''}`,
  reveal: (r) => `https://img.test/r/${r.id}`,
  table: (g) => `https://img.test/t/${g.id}`,
  label: (_g, m, label) => `https://img.test/e/${m.id}?l=${encodeURIComponent(label)}`,
};

const LIB = [
  { prompt: 'Podés saber si tus amigos te quieren o te aguantan.', option_a: 'Quiero saber', option_b: 'No quiero saber', tags: ['apertura'] },
  { prompt: 'Tu mejor amigo le arruina la vida a alguien que querés.', option_a: 'Me callo', option_b: 'Hablo', tags: ['apertura'] },
  { prompt: 'Vida extraordinaria hasta los 45 o normal hasta los 85.', option_a: 'A los 45', option_b: 'A los 85', tags: ['apertura'] },
  { prompt: 'El botón: tus viejos pierden todo y vos sos quien querés.', option_a: 'Lo aprieto', option_b: 'No lo aprieto' },
  { prompt: 'La beca: diez años sin pisar Argentina.', option_a: 'Me voy', option_b: 'Me quedo' },
  { prompt: 'La plata turbia de la familia en los noventa.', option_a: 'Sigo usándola', option_b: 'Me corto solo' },
];

function setup(start = '2026-11-02T15:00:00Z') {
  const store = new MemoryStore(LIB);
  const ctx: Ctx = { store, urls, now: new Date(start), publicNumber: '5491100000000', test: true, transcribe: async () => 'te conozco, decís que sí' };
  let n = 0;
  const say = (phone: string, text: string, audio?: Uint8Array) =>
    handleInbound(ctx, { id: `m${++n}`, phone, name: null, text, audio: audio ? { data: audio, mime: 'audio/ogg; codecs=opus', seconds: 9 } : null, at: ctx.now });
  const at = (date: string, hour: number, minute = 0) => { ctx.now = atLocal(date, hour, minute); };
  return { store, ctx, say, at };
}

const FEDE = '+5491111111111', LU = '+5491122222222', JUAN = '+5491133333333', MATI = '+5491144444444';

async function foundGroup(t: ReturnType<typeof setup>) {
  await t.say(FEDE, 'Quiero jugar con mi grupo');
  await t.say(FEDE, 'LOSPIBES');
  await t.say(FEDE, 'Fede');
  await t.say(FEDE, '1');
  await t.say(FEDE, 'A');
  await t.say(FEDE, 'Lu, Juan y Mati');
  await t.say(FEDE, 'A'); // Lu
  await t.say(FEDE, 'B'); // Juan
  await t.say(FEDE, 'A'); // Mati
  const g = [...t.store.groupsM.values()][0];
  return g;
}

test('el fundador arma el grupo, contesta, carga a sus amigos, apuesta y recibe el link para pegar', async () => {
  const t = setup();
  const g = await foundGroup(t);
  assert.equal(g.name, 'LOSPIBES');
  assert.equal(g.status, 'active');
  const box = t.store.inbox(FEDE);
  const share = box.find((s) => s.purpose === 'amigos_share');
  assert.ok(share?.imageUrl?.includes('&t=1'), 'la imagen para el grupo dice que ya apostó');
  assert.match(share!.text!, new RegExp(`wa\\.me/5491100000000\\?text=.*${g.code}`));
  assert.equal(t.store.betsL.length, 3);
  assert.equal([...t.store.membersM.values()].filter((m) => m.status === 'listed').length, 3);
  assert.match(t.store.last(FEDE), /cuántos años/);
  await t.say(FEDE, '24');
  assert.equal(t.store.players.get(t.store.persons.get(FEDE)!.pseudonymId)!.declared_age, 24);
  // Lo que contestó queda como observación con su latencia.
  const obs = t.store.observations.filter((o) => o.instrument_type === 'amigos_question');
  assert.equal(obs.length, 1);
  assert.equal(obs[0].value.choice, 'a');
});

test('cada amigo entra tocando su nombre, contesta y ve en el acto si el fundador lo leyó', async () => {
  const t = setup();
  const g = await foundGroup(t);
  await t.say(LU, `Me sumo a LOSPIBES #${g.code}`);
  assert.match(t.store.last(LU), /¿Cuál sos vos\?/);
  await t.say(LU, '1');
  assert.ok(t.store.inbox(LU).some((s) => s.imageUrl?.includes('/q/')), 'le llega la pregunta con imagen');
  await t.say(LU, 'B');
  assert.match(t.store.inbox(LU).map((s) => s.text).join('\n'), /Fede apostó que decías «Quiero saber»\. Dijiste «No quiero saber»\. No te conoce/);
  await t.say(JUAN, `Me sumo a LOSPIBES #${g.code}`);
  await t.say(JUAN, 'Juan');
  await t.say(JUAN, 'no quiero');
  assert.match(t.store.inbox(JUAN).map((s) => s.text).join('\n'), /Te conoce/);
  // Alguien que no estaba en la lista entra con su nombre.
  const CARO = '+5491155555555';
  await t.say(CARO, `Me sumo a LOSPIBES #${g.code}`);
  await t.say(CARO, 'Caro');
  await t.say(CARO, 'A');
  assert.match(t.store.inbox(CARO).map((s) => s.text).join('\n'), /no te tenía en la lista/);
  assert.equal([...t.store.membersM.values()].filter((m) => m.status === 'active').length, 4);
});

test('una temporada: turnos, víctima, audios, reveal, calificación, pausa y etiquetas', async () => {
  const t = setup();
  const g = await foundGroup(t);
  await t.say(FEDE, '30');
  for (const [phone, pick, choice] of [[LU, '1', 'B'], [JUAN, '1', 'B'], [MATI, '1', 'A']] as const) {
    await t.say(phone, `Me sumo a LOSPIBES #${g.code}`);
    await t.say(phone, pick);
    await t.say(phone, choice);
    await t.say(phone, '23');
  }
  // Ya entraron todos y contestaron: se revela solo.
  await tick(t.ctx);
  const r1 = [...t.store.roundsM.values()].find((r) => r.day === 1)!;
  assert.equal(r1.status, 'revealed');
  assert.ok(t.store.inbox(LU).some((s) => s.purpose === 'amigos_reveal' && s.imageUrl?.includes(r1.id)));
  // Fede apostó Lu A (dijo B), Juan B (dijo B), Mati A (dijo A): 2 aciertos.
  assert.equal(t.store.pointsL.filter((p) => p.reason === 'bet').reduce((s, p) => s + p.points, 0), 20);
  assert.ok(r1.summary.lines!.length >= 1);

  // Día 2: a las 18 le toca preguntar a Lu (posición 1).
  t.at('2026-11-03', 18, 1);
  await tick(t.ctx);
  const r2 = [...t.store.roundsM.values()].find((r) => r.day === 2)!;
  const lu = [...t.store.membersM.values()].find((m) => m.roster_name === 'Lu')!;
  assert.equal(r2.author_member_id, lu.id);
  assert.match(t.store.last(LU), /Hoy preguntás vos/);
  await t.say(LU, 'Si tu ex te pide volver el día de tu cumpleaños con todo el grupo mirando');
  await t.say(LU, 'Vuelvo');
  await t.say(LU, 'Lo humillo');
  assert.match(t.store.last(LU), /víctima/);
  const victimIndex = String(1 + ['Fede', 'Juan', 'Mati'].indexOf('Juan'));
  await t.say(LU, victimIndex);
  assert.match(t.store.last(LU), /Sale a las 21/);
  assert.equal(t.store.observations.filter((o) => o.instrument_type === 'amigos_authoring').length, 2);

  // A las 21 sale para todos.
  t.at('2026-11-03', 21, 0);
  await tick(t.ctx);
  const open = t.store.roundsM.get(r2.id)!;
  assert.equal(open.status, 'open');
  assert.match(t.store.last(MATI), /Pregunta de Lu/);
  assert.match(t.store.last(MATI), /víctima es Juan/);

  // Todos contestan; con víctima, todos apuestan solo por Juan.
  await t.say(FEDE, 'A');
  assert.match(t.store.last(FEDE), /¿Qué dijo Juan\?/);
  await t.say(FEDE, 'B');
  assert.match(t.store.last(FEDE), /Tu objetivo de hoy es/);
  await t.say(FEDE, '', new Uint8Array([1, 2, 3]));
  assert.match(t.store.last(FEDE), /Guardado/);
  await t.say(LU, 'A');
  await t.say(LU, 'A');
  await t.say(LU, 'Sos un muerto y lo sabés');
  await t.say(JUAN, 'B');
  await t.say(JUAN, 'SALTEAR');
  await t.say(MATI, 'A');
  await t.say(MATI, 'A');
  // Mati no manda audio todavía: el reveal espera hasta las 23.
  await tick(t.ctx);
  assert.equal(t.store.roundsM.get(r2.id)!.status, 'open');
  t.at('2026-11-03', 23, 0);
  await tick(t.ctx);
  const done = t.store.roundsM.get(r2.id)!;
  assert.equal(done.status, 'revealed');
  // Juan dijo B. Fede acertó (B): 20 por ser víctima. Lu y Mati erraron.
  const fede = [...t.store.membersM.values()].find((m) => m.roster_name === 'Fede')!;
  assert.equal(t.store.pointsL.find((p) => p.round_id === r2.id && p.member_id === fede.id && p.reason === 'bet')?.points, 20);
  // La autora cobra por partir al grupo.
  assert.ok(t.store.pointsL.some((p) => p.round_id === r2.id && p.reason === 'author_split'));
  // Las apuestas quedan como observación con lo que dijo cada uno: el par que busca BRUTAL.
  const betObs = t.store.observations.filter((o) => o.instrument_type === 'amigos_bet' && o.session_id === r2.id);
  assert.equal(betObs.length, 3);
  assert.ok(betObs.every((o) => 'own_choice' in o.value && 'target_choice' in o.value));
  // El audio de Fede le llega a su objetivo, que lo califica.
  const fedeVoice = t.store.voicesL.find((v) => v.from_member_id === fede.id)!;
  const target = [...t.store.membersM.values()].find((m) => m.id === fedeVoice.to_member_id)!;
  const targetPhone = [...t.store.persons.values()].find((p) => p.pseudonymId === target.pseudonym_id)!.phone;
  assert.ok(t.store.inbox(targetPhone).some((s) => s.audioUrl?.includes(fedeVoice.audio_path!)));
  assert.match(t.store.last(targetPhone), /¿Te leyó\? SI o NO/);
  await t.say(targetPhone, 'si');
  assert.ok(t.store.pointsL.some((p) => p.reason === 'voice_read' && p.member_id === fede.id));
  assert.match(t.store.last(FEDE), /escuchó tu audio/);
  assert.ok(t.store.consents.some((c) => c.purpose === 'voice_recording'));
  assert.ok(t.store.observations.some((o) => o.instrument_type === 'amigos_voice' && o.value_text === 'te conozco, decís que sí'));

  // Tres días sin contestar: Mati queda en pausa.
  const mati = [...t.store.membersM.values()].find((m) => m.roster_name === 'Mati')!;
  let day = 3;
  for (const date of ['2026-11-04', '2026-11-05', '2026-11-06']) {
    t.at(date, 18, 1); await tick(t.ctx);
    const rd = [...t.store.roundsM.values()].find((r) => r.day === day)!;
    assert.ok(rd, `arranca el día ${day}`);
    t.at(date, 21, 0); await tick(t.ctx);
    for (const ph of [FEDE, LU, JUAN]) {
      const pl = t.store.players.get(t.store.persons.get(ph)!.pseudonymId)!;
      if (pl.step === 'rate') await t.say(ph, 'no');
      for (let i = 0; i < 6; i++) {
        const step = t.store.players.get(t.store.persons.get(ph)!.pseudonymId)!.step;
        if (step === 'answer' || step === 'bet') await t.say(ph, 'A');
        else if (step === 'voice') await t.say(ph, 'SALTEAR');
        else if (step === 'pick') await t.say(ph, '1');
        else if (step === 'victim') await t.say(ph, 'NO');
        else break;
      }
    }
    t.at(date, 23, 0); await tick(t.ctx);
    assert.equal(t.store.roundsM.get(rd.id)!.status, 'revealed');
    day++;
  }
  assert.equal(t.store.membersM.get(mati.id)!.status, 'dormant');
  assert.match(t.store.inbox(MATI).map((s) => s.text).join('\n'), /Te pausé/);
  await t.say(MATI, 'VUELVO');
  assert.equal(t.store.membersM.get(mati.id)!.status, 'active');

  // Cierre de temporada: etiquetas para cada uno y la tabla.
  t.store.groupsM.get(g.id)!.season_days = day - 1;
  await tick(t.ctx);
  assert.equal(t.store.groupsM.get(g.id)!.status, 'finished');
  const labels = t.store.sent.filter((s) => s.purpose === 'amigos_season_label');
  assert.equal(labels.length, 4);
  assert.ok(labels.some((s) => s.imageUrl?.includes(encodeURIComponent('El amigo que todos tienen por error'))));
  await t.say(FEDE, 'OTRA');
  assert.equal(t.store.groupsM.get(g.id)!.season, 2);
  assert.equal(t.store.groupsM.get(g.id)!.status, 'active');
});

test('si el autor no pregunta a tiempo, pregunta BRUTAL', async () => {
  const t = setup();
  const g = await foundGroup(t);
  await t.say(FEDE, '30');
  for (const [phone, pick] of [[LU, '1'], [JUAN, '1'], [MATI, '1']] as const) {
    await t.say(phone, `Me sumo a LOSPIBES #${g.code}`); await t.say(phone, pick); await t.say(phone, 'A'); await t.say(phone, '25');
  }
  await tick(t.ctx);
  t.at('2026-11-03', 18, 1); await tick(t.ctx);
  t.at('2026-11-03', 21, 0); await tick(t.ctx);
  const r2 = [...t.store.roundsM.values()].find((r) => r.day === 2)!;
  assert.equal(t.store.roundsM.get(r2.id)!.status, 'open');
  assert.equal(t.store.roundsM.get(r2.id)!.author_member_id, null);
  assert.match(t.store.inbox(LU).map((s) => s.text).join('\n'), /Se te pasó la hora/);
  assert.match(t.store.last(JUAN), /Pregunta de BRUTAL/);
});

test('un menor queda afuera y no recibe más mensajes', async () => {
  const t = setup();
  const g = await foundGroup(t);
  await t.say(LU, `Me sumo #${g.code}`);
  await t.say(LU, '1');
  await t.say(LU, 'A');
  await t.say(LU, '16');
  const lu = t.store.persons.get(LU)!;
  assert.equal(t.store.players.get(lu.pseudonymId)!.blocked_reason, 'minor');
  assert.equal(lu.optedOut, true);
  const before = t.store.inbox(LU).length;
  await t.say(LU, 'hola');
  assert.equal(t.store.inbox(LU).length, before);
});

test('SALIR corta los mensajes y BORRAME borra lo jugado', async () => {
  const t = setup();
  const g = await foundGroup(t);
  await t.say(LU, `#${g.code}`); await t.say(LU, '1'); await t.say(LU, 'A');
  await t.say(LU, 'SALIR');
  assert.equal(t.store.persons.get(LU)!.optedOut, true);
  const n = t.store.inbox(LU).length;
  await advance(t.ctx, t.store.persons.get(LU)!);
  assert.equal(t.store.inbox(LU).length, n);
  await t.say(LU, 'BORRAME');
  const lu = [...t.store.membersM.values()].find((m) => m.roster_name === 'Lu')!;
  assert.equal(lu.status, 'left');
  assert.equal(t.store.answersL.filter((a) => a.member_id === lu.id).length, 0);
});

test('mensajes repetidos no se procesan dos veces y un audio fuera de turno no rompe nada', async () => {
  const t = setup();
  const m = { id: 'dup', phone: FEDE, name: null, text: 'hola', audio: null, at: t.ctx.now };
  await handleInbound(t.ctx, m);
  const r = await handleInbound(t.ctx, m);
  assert.equal(r.reason, 'duplicate');
  await t.say(FEDE, 'LOS 5');
  await t.say(FEDE, '', new Uint8Array([1]));
  assert.match(t.store.inbox(FEDE).map((s) => s.text).join('\n'), /no te estaba pidiendo/);
});
