-- DROP 002 · EL PUESTO PRESTADO (v2, después del test de Drop 001)
-- Pregunta: ¿un joven defiende un puesto de trabajo, propio o ajeno, cuando una IA lo pone en juego?
-- Secundaria: cuando hay algo en juego, ¿lo que dicen coincide con lo que hacen?
--
-- Cambios contra la v1 (feedback de Drop 001, 3 Nov 2026):
--   · Sin voz ni ElevenLabs: las dos cartas habladas pasan a elección de un toque. Nada para escribir ni grabar.
--   · Solo Golden Tickets: ninguna carta paga plata. Las que antes pagaban US$0,25 pagan 40 tickets.
--   · Más tiempo: elecciones entre 18 y 30 s según el largo del texto; ráfagas a 5 s por ítem.
--   · Ráfagas con la consigna visible y "SÍ" / "NO" debajo de cada emoji.
--   · Fuera las tres manos de doble o nada menos la última (el "fondo" y el curso del sábado eran promesas sin construir).
--   · Seis perfiles en vez de cuatro, con texto más largo; repartidos de forma pareja (lo controla drop-prestado.test.ts).
--
-- 17 cartas, ~4 minutos. Queda en borrador (status draft, link cerrado) hasta que Nacho lo abra.
-- Idempotente: se puede correr de nuevo (las cartas se identifican por etiqueta, el Drop por slug).
-- Los dos bloques JSON (cartas y perfiles, entre signos de pesos) los lee la prueba drop-prestado.test.ts.

begin;

create temp table prestado_cards on commit drop as
select * from jsonb_to_recordset($cards$
[
  {"pos": 0, "label": "prestado-01-viejo", "format": "choice", "timer_s": 22, "tickets": 20, "content": {
    "text": "Tu viejo te pide que le mientas a tu vieja por él. ¿Lo cubrís?",
    "options": ["Lo cubro", "No me meto"],
    "reaction": "Alguien se queda sin vos."}},
  {"pos": 1, "label": "prestado-02-depto-infancia", "format": "choice", "timer_s": 25, "tickets": 20, "content": {
    "text": "Te ofrecen el doble por el depto donde creciste. Tus viejos no quieren vender. La firma es tuya. ¿Firmás?",
    "options": ["Firmo", "No firmo"]}},
  {"pos": 2, "label": "prestado-03-lo-haces", "format": "rafaga_emoji", "timer_s": 50, "tickets": 30, "content": {
    "prompt": "Sin pensarlo.",
    "promptBold": "¿LO HACÉS?",
    "labelA": "SÍ",
    "labelB": "NO",
    "secondsPerItem": 5,
    "items": [
      {"text": "Faltar al velorio de tu abuelo por un final.", "optionA": "😈", "optionB": "😇"},
      {"text": "Renunciar a un laburo mandando un audio, sin pisar la oficina.", "optionA": "😈", "optionB": "😇"},
      {"text": "Cobrarle a un amigo por ayudarlo con la mudanza.", "optionA": "😈", "optionB": "😇"},
      {"text": "Decirle a tu pareja que su mamá te cae mal.", "optionA": "😈", "optionB": "😇"},
      {"text": "Borrar las fotos con tu ex sin avisarle.", "optionA": "😈", "optionB": "😇"},
      {"text": "Llevarte la lista de clientes el día que renunciás.", "optionA": "😈", "optionB": "😇"}
    ]}},
  {"pos": 3, "label": "prestado-04-no-es-trabajo", "format": "hot_take", "timer_s": 15, "tickets": 20, "content": {
    "text": "SI NO TE PUEDEN ECHAR, NO ES TRABAJO.",
    "options": ["De acuerdo", "No"]}},
  {"pos": 4, "label": "prestado-05-que-perdes", "format": "slider", "timer_s": 25, "tickets": 40, "content": {
    "text": "Mañana te echan del laburo que tenés hoy. ¿Qué perdés?",
    "min": 0, "max": 100,
    "labelLeft": "Un sueldo",
    "labelRight": "Un pedazo de mí"}},
  {"pos": 5, "label": "prestado-06-mentira-familia-v2", "format": "choice", "timer_s": 22, "tickets": 40, "content": {
    "text": "¿Tu familia cree algo de vos que es mentira?",
    "options": ["Sí, y nunca se van a enterar", "Sí, y algún día se los digo", "No, saben todo"]}},
  {"pos": 6, "label": "prestado-07-auto-prestado", "format": "choice", "timer_s": 28, "tickets": 20, "content": {
    "text": "Te prestan un auto por un año. Aparece rayado en la puerta; no fuiste vos. ¿Lo arreglás de tu bolsillo o lo devolvés así?",
    "options": ["Lo arreglo yo", "Lo devuelvo así"]}},
  {"pos": 7, "label": "prestado-08-casa-propia", "format": "choice", "timer_s": 20, "tickets": 20, "content": {
    "text": "¿A qué edad vas a tener una casa a tu nombre?",
    "options": ["25", "30", "40", "Nunca"],
    "reaction": "Anotado. Te vamos a preguntar de nuevo."}},
  {"pos": 8, "label": "prestado-09-amigo-imperdonable", "format": "choice", "timer_s": 30, "tickets": 40, "content": {
    "text": "Tu mejor amigo de toda la vida empezó a repetir cosas que vos encontrás imperdonables. ¿Qué hacés?",
    "options": ["Lo bajo de a poco, sin decirle nada", "Se lo digo, aunque se rompa", "Lo dejo pasar y sigo como siempre"]}},
  {"pos": 9, "label": "prestado-10-companera-ia", "format": "choice", "timer_s": 30, "tickets": 40, "content": {
    "text": "A la persona que se sienta al lado tuyo la van a reemplazar por una IA. Te ofrecen un bono por enseñarle a la IA cómo hace ella su trabajo. ¿Lo hacés?",
    "options": ["Lo hago", "No lo hago"],
    "reaction": "Registrado."}},
  {"pos": 10, "label": "prestado-11-verguenza", "format": "rafaga_emoji", "timer_s": 50, "tickets": 30, "content": {
    "prompt": "Rápido.",
    "promptBold": "¿TE DA VERGÜENZA?",
    "labelA": "SÍ",
    "labelB": "NO",
    "secondsPerItem": 5,
    "items": [
      {"text": "Que te vean llorar en el subte.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que sepan cuánto ganás.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que tus amigos vean a tus viejos pagándote el alquiler.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que te vean comer solo en un bar.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que sepan que escribiste un mensaje de amor con IA.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que sepan que seguís en la obra social de tu viejo.", "optionA": "😳", "optionB": "😎"}
    ]}},
  {"pos": 11, "label": "prestado-12-tatuaje", "format": "choice", "timer_s": 18, "tickets": 20, "content": {
    "text": "¿Te tatuarías el nombre de tu pareja de dos años?",
    "options": ["Sí", "Ni en pedo"]}},
  {"pos": 12, "label": "prestado-14-algo-tuyo-v2", "format": "choice", "timer_s": 22, "tickets": 40, "content": {
    "text": "¿Qué es realmente tuyo? No prestado, no heredado, no alquilado.",
    "options": ["Mi laburo", "Mis amigos", "Lo que cuento de mí", "Nada"]}},
  {"pos": 13, "label": "prestado-15-a-quien-echas", "format": "ranking", "timer_s": 45, "tickets": 40, "content": {
    "text": "La empresa donde trabajás tiene que echar a uno de cinco. Ordenalos: primero el que echarías primero.",
    "options": ["El que entró hace un mes", "El que más gana", "El que menos labura", "El que tiene 55 años", "Vos"]}},
  {"pos": 14, "label": "prestado-16-finalistas", "format": "choice", "timer_s": 30, "tickets": 20, "content": {
    "text": "Tu mejor amigo y vos quedaron finalistas para el mismo puesto. Te preguntan en privado si él es confiable. Vos sabés que no mucho. ¿Lo decís?",
    "options": ["Lo digo", "Lo cubro"]}},
  {"pos": 15, "label": "prestado-18-ascenso-secreto", "format": "choice", "timer_s": 26, "tickets": 40, "content": {
    "text": "Te dan el ascenso que querías. Condición: durante un año no podés contárselo a nadie, ni a tus amigos ni en redes. ¿Lo aceptás?",
    "options": ["Acepto", "No acepto"]}},
  {"pos": 16, "label": "prestado-g3-escalera", "format": "mayor_menor", "timer_s": 75, "tickets": 0, "content": {
    "text": "La última es una mano. Multiplicá tus tickets o perdé el multiplicador.",
    "ladder": [1.5, 2, 3],
    "secondsPerCard": 14,
    "mode": "ladder"}}
]
$cards$::jsonb) as x(pos int, label text, format text, timer_s int, tickets int, content jsonb);

insert into drops.questions (format, label, content, card_type, timer_s, status, tags, reward_cash_usd, reward_tickets)
select c.format, c.label, c.content, 'culture', nullif(c.timer_s, 0), 'active', array['prestado', 'drop-002'], 0, c.tickets
from prestado_cards c
where not exists (select 1 from drops.questions q where q.label = c.label);

update drops.questions q
set content = c.content, format = c.format, card_type = 'culture', timer_s = nullif(c.timer_s, 0), reward_cash_usd = 0, reward_tickets = c.tickets, status = 'active'
from prestado_cards c
where q.label = c.label;

-- Las cartas de la v1 que salieron (voz, doble o nada, fondo, curso) quedan retiradas, no borradas.
update drops.questions set status = 'retired'
where 'prestado' = any(tags)
  and label in ('prestado-06-mentira-familia', 'prestado-14-algo-tuyo', 'prestado-g1-doble', 'prestado-g2-fondo', 'prestado-17-curso');

-- ---------- El Drop (borrador, link cerrado) ----------
insert into drops.drops (slug, name, status, season_id, config)
select 'prestado', 'EL PUESTO PRESTADO', 'draft', (select id from economy.seasons where status = 'active'),
  jsonb_build_object(
    'timeoutMessage', 'Brutal eligió por vos.',
    'multiplierCheckpoints', '{}'::jsonb,
    'join', jsonb_build_object('code', 'prestado', 'open', false, 'max', 500),
    'splash', jsonb_build_object('mode', 'none', 'buttonText', 'ENTRO', 'staticLines', jsonb_build_array('> DROP 002', '> 17 cartas · 4 minutos'), 'typewriterLines', jsonb_build_array()),
    'reveal', $reveal$
{
  "title": "Inclasificable",
  "description": "Ni dueño ni inquilino. Te vamos a seguir mirando.",
  "archetypes": [
    {"id": "dueno", "title": "Dueño sin\nescritura",
     "description": "Nadie te firmó nada y defendés el lugar como si fuera tuyo. A la gente también: si es de los tuyos, la cubrís aunque no tenga razón. El detalle es que la escritura la tiene otro, y un día la va a usar.",
     "formula": {"propiedad": 1, "lealtad": 1}},
    {"id": "vidriera", "title": "Vidriera",
     "description": "Lo que tenés, se ve. El ascenso, el depto, la pareja: si no se puede mostrar, vale la mitad. No es vanidad, es inventario. El día que no haya a quién mostrárselo, vas a tener que averiguar si te gustaba.",
     "formula": {"propiedad": 1, "relato": 1}},
    {"id": "mudanza", "title": "Mudanza\neterna",
     "description": "Querés algo a tu nombre y al mismo tiempo tenés la valija armada. Las dos cosas son ciertas. Ninguna llega a pasar. Sos el único inquilino que pinta las paredes antes de irse.",
     "formula": {"propiedad": 1, "desapego": 1}},
    {"id": "guardia", "title": "Guarda-\nespaldas",
     "description": "Cubrís a tu viejo, a tu amigo, a la de al lado. Con las cosas no te encariñás: un laburo es un laburo. Con la gente sí, y mucho. La pregunta que nadie te hace: ¿a vos quién te cubre?",
     "formula": {"lealtad": 1, "desapego": 1}},
    {"id": "vocero", "title": "Vocero",
     "description": "Defendés a los tuyos en público y les decís la verdad en privado. O al revés. Lo importante es que la versión oficial cierre. Serías un gran secretario de prensa de alguien que no se lo merece.",
     "formula": {"lealtad": 1, "relato": 1}},
    {"id": "feriante", "title": "Puesto\nde feria",
     "description": "Armás a las siete, desarmás a las dos. Nada es tuyo y no te importa, mientras quede lindo en la foto. Tu único patrimonio es cómo lo contás, y lo administrás muy bien.",
     "formula": {"desapego": 1, "relato": 1}}
  ],
  "scoring": {
    "choiceScoring": [
      {"questionIndex": 0, "questionLabel": "prestado-01-viejo", "optionScores": [{"lealtad": 2}, {"desapego": 1, "propiedad": 1}]},
      {"questionIndex": 1, "questionLabel": "prestado-02-depto-infancia", "optionScores": [{"desapego": 2}, {"propiedad": 2}]},
      {"questionIndex": 3, "questionLabel": "prestado-04-no-es-trabajo", "optionScores": [{"desapego": 1, "relato": 1}, {"propiedad": 1, "lealtad": 1}]},
      {"questionIndex": 5, "questionLabel": "prestado-06-mentira-familia-v2", "optionScores": [{"relato": 2}, {"lealtad": 2}, {"propiedad": 1, "desapego": 1}]},
      {"questionIndex": 6, "questionLabel": "prestado-07-auto-prestado", "optionScores": [{"propiedad": 1, "lealtad": 1}, {"desapego": 1, "relato": 1}]},
      {"questionIndex": 7, "questionLabel": "prestado-08-casa-propia", "optionScores": [{"propiedad": 2}, {"propiedad": 1, "relato": 1}, {"desapego": 1, "lealtad": 1}, {"desapego": 2}]},
      {"questionIndex": 8, "questionLabel": "prestado-09-amigo-imperdonable", "optionScores": [{"relato": 2}, {"propiedad": 2}, {"lealtad": 2}]},
      {"questionIndex": 9, "questionLabel": "prestado-10-companera-ia", "optionScores": [{"desapego": 1, "relato": 1}, {"lealtad": 2}]},
      {"questionIndex": 11, "questionLabel": "prestado-12-tatuaje", "optionScores": [{"relato": 2}, {"desapego": 1, "propiedad": 1}]},
      {"questionIndex": 12, "questionLabel": "prestado-14-algo-tuyo-v2", "optionScores": [{"propiedad": 2}, {"lealtad": 2}, {"relato": 2}, {"desapego": 2}]},
      {"questionIndex": 14, "questionLabel": "prestado-16-finalistas", "optionScores": [{"propiedad": 1, "relato": 1}, {"lealtad": 2}]},
      {"questionIndex": 15, "questionLabel": "prestado-18-ascenso-secreto", "optionScores": [{"propiedad": 2}, {"relato": 2}]}
    ],
    "rafagaScoring": [
      {"questionIndex": 2, "questionLabel": "prestado-03-lo-haces", "majorityA": {"desapego": 2}, "majorityB": {"lealtad": 2}},
      {"questionIndex": 10, "questionLabel": "prestado-11-verguenza", "majorityA": {"relato": 2}, "majorityB": {"desapego": 1, "lealtad": 1}}
    ],
    "sliderScoring": [
      {"questionIndex": 4, "questionLabel": "prestado-05-que-perdes", "ranges": [
        {"min": 0, "max": 30, "scores": {"desapego": 1, "relato": 1}},
        {"min": 31, "max": 70, "scores": {"propiedad": 1, "lealtad": 1}},
        {"min": 71, "max": 100, "scores": {"propiedad": 2}}
      ]}
    ],
    "rankingScoring": [
      {"questionIndex": 13, "questionLabel": "prestado-15-a-quien-echas", "firstPlaceScores": [
        {"desapego": 1}, {"relato": 1}, {"propiedad": 1}, {"desapego": 1, "relato": 1}, {"lealtad": 2}
      ]}
    ]
  }
}
$reveal$::jsonb)
on conflict (slug) do update set name = excluded.name, config = excluded.config, season_id = excluded.season_id;

delete from drops.drop_questions dq using drops.drops d where dq.drop_id = d.id and d.slug = 'prestado';
insert into drops.drop_questions (drop_id, question_id, position, enabled)
select d.id, q.id, c.pos, true
from prestado_cards c
join drops.questions q on q.label = c.label
join drops.drops d on d.slug = 'prestado';

commit;
