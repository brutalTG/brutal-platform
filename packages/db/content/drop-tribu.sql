-- DROP · TU TRIBU (política y cultura)
-- Fuente: "Brutal — Drop 02: política y cultura" (Nacho, 3 Nov 2026).
-- Objetivo: validar el producto con usuarios reales (finalización, tiempo y abandono por carta y por formato,
-- compartidos). Investigación secundaria: ¿la afinidad política ya se refleja en consumos culturales y lugares,
-- incluida la cultura pública gratuita? ¿Quién defiende lo que no usa y quién usa lo que no defiende?
-- Solo mayores de 18 (config.minAge). Lo político va al final y nunca entra al perfil ni a la imagen para compartir.
--
-- Cada carta queda como pieza suelta en la Caja de herramientas (drops.questions, status active), con etiquetas:
--   tribu · politica-cultura · nucleo/relleno · formato. La carta alternativa del millón de dólares queda solo en la caja.
-- Formatos: la tier list, el streaming y los tres dilemas usan la ráfaga con 3 o 4 botones (button_multi).
-- La carta 1 pide dos GIFs; hasta tenerlos va como elección con emoji (cambiar en el panel cuando estén).
--
-- 15 cartas + 3 mercados (tipo Polymarket, cada uno justo después de la carta que apuesta), ~6 minutos. Queda en borrador (status draft, link cerrado). Idempotente (cartas por etiqueta, Drop por slug).
-- Los bloques JSON (cartas, extras y perfiles, entre signos de pesos) los lee la prueba drop-tribu.test.ts.

begin;

create temp table tribu_cards on commit drop as
select * from jsonb_to_recordset($cards$
[
  {"pos": 0, "label": "tribu-01-viernes", "format": "choice", "timer_s": 18, "tickets": 20, "tags": ["relleno", "eleccion"], "content": {"text": "¿Cómo llegás al viernes?", "options": ["Más o menos entero 🙂", "Destruido 💀"]}},
  {"pos": 1, "label": "tribu-02-argentina-ex", "format": "choice", "timer_s": 26, "tickets": 40, "tags": ["nucleo", "eleccion"], "content": {"text": "Si la Argentina fuera tu ex…", "options": ["No la dejo nunca", "Es tóxica pero la amo", "Ya tengo las valijas hechas", "Me fui y le stalkeo las stories desde Madrid"]}},
  {"pos": 2, "label": "tribu-02m-mercado-ex", "format": "market", "timer_s": 25, "tickets": 0, "tags": ["juego", "mercado"], "content": {"text": "¿Qué eligió la mayoría del club?", "ref": "tribu-02-argentina-ex", "prices": [14, 46, 31, 9], "sim": [12, 38, 41, 9], "simPlayers": 300, "stakes": [10, 25, 50], "volume": 18430, "traders": 312}},
  {"pos": 3, "label": "tribu-03-tier-musica", "format": "rafaga_burst", "timer_s": 60, "tickets": 30, "tags": ["nucleo", "tier-list", "musica"], "content": {"prompt": "Armá tu tier list", "preScreen": {"title": "TIER LIST", "subtitle": "Ocho géneros. Ponelos en su lugar.", "durationMs": 2600}, "secondsPerItem": 5, "items": [{"trigger": {"type": "text", "text": "Trap"}, "interaction": {"type": "button_multi", "options": ["S · lo mejor", "A · me copa", "B · zafa", "C · ni en pedo"]}}, {"trigger": {"type": "text", "text": "Cumbia"}, "interaction": {"type": "button_multi", "options": ["S · lo mejor", "A · me copa", "B · zafa", "C · ni en pedo"]}}, {"trigger": {"type": "text", "text": "RKT"}, "interaction": {"type": "button_multi", "options": ["S · lo mejor", "A · me copa", "B · zafa", "C · ni en pedo"]}}, {"trigger": {"type": "text", "text": "Rock nacional"}, "interaction": {"type": "button_multi", "options": ["S · lo mejor", "A · me copa", "B · zafa", "C · ni en pedo"]}}, {"trigger": {"type": "text", "text": "Indie"}, "interaction": {"type": "button_multi", "options": ["S · lo mejor", "A · me copa", "B · zafa", "C · ni en pedo"]}}, {"trigger": {"type": "text", "text": "Folklore"}, "interaction": {"type": "button_multi", "options": ["S · lo mejor", "A · me copa", "B · zafa", "C · ni en pedo"]}}, {"trigger": {"type": "text", "text": "Pop"}, "interaction": {"type": "button_multi", "options": ["S · lo mejor", "A · me copa", "B · zafa", "C · ni en pedo"]}}, {"trigger": {"type": "text", "text": "Electrónica"}, "interaction": {"type": "button_multi", "options": ["S · lo mejor", "A · me copa", "B · zafa", "C · ni en pedo"]}}]}},
  {"pos": 4, "label": "tribu-04-sabado-cero", "format": "choice", "timer_s": 24, "tickets": 20, "tags": ["nucleo", "eleccion"], "content": {"text": "Sábado libre y $0 en la cuenta. ¿Qué hacés?", "options": ["Me quedo en casa", "Busco algo gratis", "Pido prestado y salgo igual", "Si nadie me invita, no salgo"]}},
  {"pos": 5, "label": "tribu-05-planes", "format": "rafaga_emoji", "timer_s": 55, "tickets": 30, "tags": ["nucleo", "rafaga", "lugares"], "content": {"prompt": "De a uno.", "promptBold": "¿VAS O NO VAS?", "labelA": "VOY", "labelB": "NO VOY", "secondsPerItem": 5, "items": [{"text": "Una peña.", "optionA": "🙋", "optionB": "🙅"}, {"text": "Fiesta techno en un galpón.", "optionA": "🙋", "optionB": "🙅"}, {"text": "After en Palermo.", "optionA": "🙋", "optionB": "🙅"}, {"text": "Asado en el quincho del club.", "optionA": "🙋", "optionB": "🙅"}, {"text": "Recital en un estadio.", "optionA": "🙋", "optionB": "🙅"}, {"text": "Un bar en San Telmo.", "optionA": "🙋", "optionB": "🙅"}, {"text": "Recital gratis en un espacio público.", "optionA": "🙋", "optionB": "🙅"}, {"text": "Una muestra en un centro cultural.", "optionA": "🙋", "optionB": "🙅"}]}},
  {"pos": 6, "label": "tribu-06-cultura-gratis", "format": "choice", "timer_s": 22, "tickets": 20, "tags": ["nucleo", "eleccion", "cultura-publica"], "content": {"text": "¿Cuándo fue la última vez que fuiste a algo cultural gratis?", "options": ["La semana pasada", "Este mes", "Este año", "Ni me acuerdo", "No sabía que había"]}},
  {"pos": 7, "label": "tribu-07-streaming", "format": "rafaga_burst", "timer_s": 50, "tickets": 30, "tags": ["nucleo", "rafaga", "streaming"], "content": {"prompt": "¿Lo mirás o no lo bancás?", "preScreen": {"title": "STREAMING", "subtitle": "Seis canales. Sin pensar.", "durationMs": 2400}, "secondsPerItem": 5, "items": [{"trigger": {"type": "text", "text": "Carajo"}, "interaction": {"type": "button_multi", "options": ["Lo miro", "No lo banco", "Ni idea qué es"]}}, {"trigger": {"type": "text", "text": "Gelatina"}, "interaction": {"type": "button_multi", "options": ["Lo miro", "No lo banco", "Ni idea qué es"]}}, {"trigger": {"type": "text", "text": "Blender"}, "interaction": {"type": "button_multi", "options": ["Lo miro", "No lo banco", "Ni idea qué es"]}}, {"trigger": {"type": "text", "text": "Luzu"}, "interaction": {"type": "button_multi", "options": ["Lo miro", "No lo banco", "Ni idea qué es"]}}, {"trigger": {"type": "text", "text": "Olga"}, "interaction": {"type": "button_multi", "options": ["Lo miro", "No lo banco", "Ni idea qué es"]}}, {"trigger": {"type": "text", "text": "Un canal gamer de Twitch"}, "interaction": {"type": "button_multi", "options": ["Lo miro", "No lo banco", "Ni idea qué es"]}}]}},
  {"pos": 8, "label": "tribu-08-unfollow", "format": "choice", "timer_s": 25, "tickets": 20, "tags": ["nucleo", "eleccion", "conflicto"], "content": {"text": "¿Alguna vez clavaste un unfollow por una story política?", "options": ["Sí, y lo volvería a hacer", "Sí, y me arrepentí", "No, pero ganas no me faltaron", "No, me encanta stalkear al enemigo"]}},
  {"pos": 9, "label": "tribu-08m-mercado-unfollow", "format": "market", "timer_s": 25, "tickets": 0, "tags": ["juego", "mercado"], "content": {"text": "¿Qué eligió la mayoría del club?", "ref": "tribu-08-unfollow", "prices": [41, 12, 33, 14], "sim": [44, 10, 31, 15], "simPlayers": 300, "stakes": [10, 25, 50], "volume": 22710, "traders": 348}},
  {"pos": 10, "label": "tribu-09-presidente-mesa", "format": "choice", "timer_s": 26, "tickets": 20, "tags": ["relleno", "eleccion"], "content": {"text": "Te llegó la carta: te toca ser presidente de mesa. ¿Qué hacés?", "options": ["Voy con termo y facturas", "Le pido a mi viejo un certificado médico", "Voy y armo el grupo de WhatsApp de la mesa", "Me hago el que nunca me llegó"]}},
  {"pos": 11, "label": "tribu-10-primera-cita", "format": "choice", "timer_s": 26, "tickets": 40, "tags": ["nucleo", "dilema", "conflicto"], "content": {"text": "Primera cita perfecta. En la tercera birra te dice que vota todo lo contrario que vos.", "options": ["Segunda cita igual", "Depende", "Chau", "Lo convierto"]}},
  {"pos": 12, "label": "tribu-10m-mercado-cita", "format": "market", "timer_s": 25, "tickets": 0, "tags": ["juego", "mercado"], "content": {"text": "¿Qué eligió la mayoría del club?", "ref": "tribu-10-primera-cita", "prices": [22, 48, 19, 11], "sim": [34, 33, 21, 12], "simPlayers": 300, "stakes": [10, 25, 50], "volume": 26905, "traders": 371}},
  {"pos": 13, "label": "tribu-11-stalkeo", "format": "rafaga_emoji", "timer_s": 50, "tickets": 30, "tags": ["nucleo", "rafaga", "conflicto"], "content": {"prompt": "Le stalkeás el perfil a alguien que te gusta.", "promptBold": "¿SEGUÍS O VISTO?", "labelA": "SIGO", "labelB": "VISTO", "secondsPerItem": 5, "items": [{"text": "Sigue a streamers políticos.", "optionA": "💘", "optionB": "👀"}, {"text": "Sube stories desde una marcha.", "optionA": "💘", "optionB": "👀"}, {"text": "Se pelea con desconocidos en los comentarios.", "optionA": "💘", "optionB": "👀"}, {"text": "Tiene la billetera cripto en la bio.", "optionA": "💘", "optionB": "👀"}, {"text": "Tiene una foto con un político.", "optionA": "💘", "optionB": "👀"}, {"text": "Llena las stories de memes políticos.", "optionA": "💘", "optionB": "👀"}, {"text": "Dice que la política no le interesa para nada.", "optionA": "💘", "optionB": "👀"}]}},
  {"pos": 14, "label": "tribu-12-estado-cultura", "format": "choice", "timer_s": 22, "tickets": 20, "tags": ["nucleo", "eleccion", "cultura-publica", "politica"], "content": {"text": "¿El Estado tiene que bancar la cultura gratis?", "options": ["Sí, siempre", "Sí, pero no cualquier cosa", "Solo si sobra la plata", "No, que la pague el que la usa"]}},
  {"pos": 15, "label": "tribu-13-una-sola-cosa", "format": "choice", "timer_s": 22, "tickets": 20, "tags": ["nucleo", "eleccion", "politica"], "content": {"text": "La plata alcanza para una sola cosa.", "options": ["Que los museos sigan gratis", "Que baje el boleto de colectivo", "Más becas para estudiantes", "Que te lo devuelvan en impuestos"]}},
  {"pos": 16, "label": "tribu-14-cuantos-fueron", "format": "slider", "timer_s": 25, "tickets": 40, "tags": ["nucleo", "escala", "cultura-publica"], "content": {"text": "Del 0 al 100, ¿cuántos de los de tu edad creés que fueron a algo cultural gratis este año?", "min": 0, "max": 100, "labelLeft": "Nadie", "labelRight": "Todos"}},
  {"pos": 17, "label": "tribu-15-dilemas", "format": "rafaga_burst", "timer_s": 50, "tickets": 40, "tags": ["nucleo", "rafaga", "politica", "autoubicacion"], "content": {"prompt": "Elegí rápido.", "preScreen": {"title": "TRES DILEMAS", "subtitle": "Y terminamos.", "durationMs": 2400}, "secondsPerItem": 8, "items": [{"trigger": {"type": "text", "text": "El Estado…"}, "interaction": {"type": "button_multi", "options": ["Que se meta menos", "Que garantice más", "Me da igual", "Prefiero no decir"]}}, {"trigger": {"type": "text", "text": "Con la inseguridad…"}, "interaction": {"type": "button_multi", "options": ["Mano dura", "Prevención", "Me da igual", "Prefiero no decir"]}}, {"trigger": {"type": "text", "text": "Con lo que se fabrica acá…"}, "interaction": {"type": "button_multi", "options": ["Abrir importaciones", "Proteger la industria", "Me da igual", "Prefiero no decir"]}}]}}
]
$cards$::jsonb) as x(pos int, label text, format text, timer_s int, tickets int, tags text[], content jsonb);

-- Solo en la Caja de herramientas: la alternativa de la carta 2.
create temp table tribu_extras on commit drop as
select * from jsonb_to_recordset($extras$
[
  {"label": "tribu-02b-millon-ciudadania", "format": "choice", "timer_s": 24, "tickets": 40, "tags": ["nucleo", "eleccion", "alternativa"], "content": {
    "text": "Te dan un millón de dólares si renunciás a la ciudadanía argentina para siempre. ¿Aceptás?",
    "options": ["Sí, sin dudar", "Lo pienso", "Ni en pedo"]}}
]
$extras$::jsonb) as x(label text, format text, timer_s int, tickets int, tags text[], content jsonb);

insert into drops.questions (format, label, content, card_type, timer_s, status, tags, reward_cash_usd, reward_tickets)
select c.format, c.label, c.content, 'culture', nullif(c.timer_s, 0), 'active', array['tribu', 'politica-cultura'] || c.tags, 0, c.tickets
from (select label, format, timer_s, tickets, tags, content from tribu_cards union all select * from tribu_extras) c
where not exists (select 1 from drops.questions q where q.label = c.label);

update drops.questions q
set content = c.content, format = c.format, card_type = 'culture', timer_s = nullif(c.timer_s, 0), reward_cash_usd = 0, reward_tickets = c.tickets,
    status = 'active', tags = array['tribu', 'politica-cultura'] || c.tags
from (select label, format, timer_s, tickets, tags, content from tribu_cards union all select * from tribu_extras) c
where q.label = c.label;

-- Las cartas del Drop 002 también quedan etiquetadas por formato en la Caja de herramientas.
update drops.questions set tags = array(select distinct unnest(tags || array[
    case format when 'choice' then 'eleccion' when 'rafaga_emoji' then 'rafaga' when 'slider' then 'escala' when 'ranking' then 'ranking'
                when 'hot_take' then 'hot-take' when 'mayor_menor' then 'mayor-menor' else format end, 'trabajo']))
where 'prestado' = any(tags) and status = 'active';

-- ---------- El Drop (borrador, link cerrado, solo mayores de 18) ----------
insert into drops.drops (slug, name, status, season_id, config)
select 'tribu', 'TU TRIBU', 'draft', (select id from economy.seasons where status = 'active'),
  jsonb_build_object(
    'minAge', 18,
    'timeoutMessage', 'Brutal eligió por vos.',
    'multiplierCheckpoints', '{}'::jsonb,
    'join', jsonb_build_object('code', 'tribu', 'open', false, 'max', 500),
    'splash', jsonb_build_object('mode', 'none', 'buttonText', 'ENTRO', 'staticLines', jsonb_build_array('> TU TRIBU', '> 18 cartas · 6 minutos'), 'typewriterLines', jsonb_build_array()),
    'reveal', $reveal$
{
  "label": "Tu tribu",
  "title": "Sin tribu",
  "description": "No encajás en ninguna. Eso también es una tribu.",
  "archetypes": [
    {"id": "primera-fila", "title": "Primera\nfila",
     "description": "Si es gratis y en la calle, estás. Peña, plaza, muestra: llegás temprano y te ubicás adelante. Y si alguien en la fila dice una pavada, también estás para contestarle.",
     "formula": {"calle": 1, "grieta": 1}},
    {"id": "mesa-larga", "title": "Mesa\nlarga",
     "description": "Vas a todo lo que sea gratis y te sentás con cualquiera. En tu mesa entra hasta el que no soportás, siempre que traiga hielo.",
     "formula": {"calle": 1, "tregua": 1}},
    {"id": "lista-de-puerta", "title": "Lista de\npuerta",
     "description": "Galpón, after, estadio. Tenés la noche armada y una lista mental de gente con la que no compartirías ni un taxi de vuelta.",
     "formula": {"noche": 1, "grieta": 1}},
    {"id": "after-universal", "title": "After\nuniversal",
     "description": "A las cinco de la mañana bailás con gente que de día no saludarías. La pista no pregunta y vos tampoco.",
     "formula": {"noche": 1, "tregua": 1}},
    {"id": "comentarista", "title": "Comentarista\nde sillón",
     "description": "Salís poco y opinás mucho. La cultura te entra por el celular, y los bloqueos también salen de ahí.",
     "formula": {"casa": 1, "grieta": 1}},
    {"id": "modo-avion", "title": "Modo\navión",
     "description": "Tu sábado ideal no tiene plan ni discusión. Mirás de todo, no te peleás con nadie y nadie sabe muy bien qué pensás.",
     "formula": {"casa": 1, "tregua": 1}}
  ],
  "scoring": {
    "choiceScoring": [
      {"questionIndex": 0, "questionLabel": "tribu-01-viernes", "optionScores": [{"casa": 1}, {"noche": 1}]},
      {"questionIndex": 3, "questionLabel": "tribu-04-sabado-cero", "optionScores": [{"casa": 2}, {"calle": 2}, {"noche": 2}, {"casa": 1}]},
      {"questionIndex": 5, "questionLabel": "tribu-06-cultura-gratis", "optionScores": [{"calle": 2}, {"calle": 1}, {"noche": 1}, {"casa": 1}, {"casa": 2}]},
      {"questionIndex": 7, "questionLabel": "tribu-08-unfollow", "optionScores": [{"grieta": 2}, {"tregua": 1}, {"grieta": 1}, {"tregua": 2}]},
      {"questionIndex": 8, "questionLabel": "tribu-09-presidente-mesa", "optionScores": [{"calle": 1}, {"casa": 1}, {"tregua": 1}, {"noche": 1}]},
      {"questionIndex": 9, "questionLabel": "tribu-10-primera-cita", "optionScores": [{"tregua": 2}, {"tregua": 1}, {"grieta": 2}, {"grieta": 1}]}
    ],
    "rafagaScoring": [
      {"questionIndex": 4, "questionLabel": "tribu-05-planes", "majorityA": {"noche": 1, "calle": 1}, "majorityB": {"casa": 2}},
      {"questionIndex": 10, "questionLabel": "tribu-11-stalkeo", "majorityA": {"tregua": 2}, "majorityB": {"grieta": 2}}
    ]
  }
}
$reveal$::jsonb)
on conflict (slug) do update set name = excluded.name, config = excluded.config, season_id = excluded.season_id;

delete from drops.drop_questions dq using drops.drops d where dq.drop_id = d.id and d.slug = 'tribu';
insert into drops.drop_questions (drop_id, question_id, position, enabled)
select d.id, q.id, c.pos, true
from tribu_cards c
join drops.questions q on q.label = c.label
join drops.drops d on d.slug = 'tribu';

commit;
