-- DROP 001 · MENTIME QUE ME GUSTA
-- Quince cartas sin objeto de estudio: brutal, border, con la máquina adentro. Primera prueba con gente real.
-- Idempotente: se puede correr de nuevo (las cartas se identifican por etiqueta, el Drop por slug).
-- No es una migración: es contenido. Se carga con OK de Nacho.

begin;

-- ---------- Temporada ----------
insert into economy.seasons (slug, name, starts_at, ends_at, status, prizes)
select 't1-mentime', 'Temporada 1', now(), now() + interval '14 days', 'active',
  '[{"position": 1, "description": "Entrada al DROP CERO, el que no se publica"}, {"position": 2, "description": "Entrada al DROP CERO"}, {"position": 3, "description": "Entrada al DROP CERO"}]'::jsonb
where not exists (select 1 from economy.seasons where status = 'active');

-- ---------- Cartas ----------
-- Cada carta: etiqueta única, formato, contenido tal como lo espera el reproductor, premio.
create temp table mentime_cards (pos int, label text, format text, card_type text, timer_s int, cash numeric, tickets int, content jsonb) on commit drop;
insert into mentime_cards values
  (0, 'mentime-01-llamas', 'choice_hybrid', 'culture', 10, 0, 20, '{
    "text": "Mataste a alguien sin querer. Son las 3 de la mañana. ¿A quién llamás primero?",
    "options": ["A mamá 📞", "A mi mejor amigo 🤫", "A ChatGPT 🤖", "A nadie. Lo resuelvo solo 🧹"],
    "reaction": "Buen cómplice."
  }'),
  (1, 'mentime-02-viejos', 'hot_take', 'culture', 8, 0, 20, '{
    "text": "TUS VIEJOS TE PAGAN MÁS COSAS DE LAS QUE CONTÁS.",
    "options": ["Obvio", "Me pago todo, loco"]
  }'),
  (2, 'mentime-03-nadie-se-entera', 'rafaga_emoji', 'culture', 30, 0, 30, '{
    "prompt": "Nadie se va a enterar.",
    "promptBold": "¿LO HACÉS? 😈 sí · 😇 no",
    "secondsPerItem": 3,
    "items": [
      {"text": "Subir historia por un muerto que te caía mal.", "optionA": "😈", "optionB": "😇"},
      {"text": "Leer el celular de tu pareja mientras duerme.", "optionA": "😈", "optionB": "😇"},
      {"text": "Decir que estás en terapia para zafar de un plan.", "optionA": "😈", "optionB": "😇"},
      {"text": "Usar la SUBE de jubilado de tu abuela.", "optionA": "😈", "optionB": "😇"},
      {"text": "Que ChatGPT escriba tu mensaje de pésame.", "optionA": "😈", "optionB": "😇"},
      {"text": "Votar a alguien que te da vergüenza y decir que votaste en blanco.", "optionA": "😈", "optionB": "😇"}
    ]
  }'),
  (3, 'mentime-04-match', 'choice', 'culture', 10, 0.25, 0, '{
    "text": "Match. Es un 10. Hablan bárbaro. ¿Qué te lo baja más?",
    "options": ["Vota lo contrario que vos", "Tiene Android", "Vive en Laferrere"],
    "reaction": "Elegiste tu prejuicio favorito."
  }'),
  (4, 'mentime-05-la-maquina', 'dead_drop', 'dead_drop', 0, 0, 0, '{
    "firstLine": "Ahora hablás.",
    "codeLines": [
      "> la máquina te hace 3 preguntas",
      "> en 2 decís la verdad",
      "> en 1 mentís. vos elegís cuál",
      "> ella elige a quién no le cree"
    ],
    "lastLines": ["Si zafás: +150 tickets.", "Si te agarra, te lo va a decir en la cara."]
  }'),
  (5, 'mentime-06-apuestas', 'voice', 'culture', 40, 0.25, 0, '{
    "text": "Decime cuánta plata perdiste apostando en el último año. Con número.",
    "speak": true, "answerType": "number", "maxSeconds": 15, "detector": true
  }'),
  (6, 'mentime-07-ia', 'hot_take', 'culture', 8, 0, 20, '{
    "text": "TU ÚLTIMO MENSAJE IMPORTANTE LO ESCRIBIÓ UNA IA.",
    "options": ["Y salió mejor", "Nunca haría eso"]
  }'),
  (7, 'mentime-08-voto', 'voice', 'culture', 40, 0.25, 0, '{
    "text": "Decime a quién votaste la última vez, y si hoy lo volverías a votar.",
    "speak": true, "answerType": "open", "maxSeconds": 15, "detector": true
  }'),
  (8, 'mentime-09-fin-de-mes', 'ranking', 'culture', 25, 0.25, 0, '{
    "text": "No llegás a fin de mes. Ordená lo que cortás primero.",
    "options": ["Terapia", "Gimnasio", "Streaming", "Salidas", "Apuestas"]
  }'),
  (9, 'mentime-10-dias', 'slider', 'culture', 15, 0.25, 0, '{
    "text": "Si tus viejos te cortan la plata HOY, ¿cuántos días durás?",
    "min": 0, "max": 60, "labelLeft": "Ni uno", "labelRight": "60+",
    "reaction": "Sesenta es \"para siempre\" en esta encuesta."
  }'),
  (10, 'mentime-11-familia', 'choice', 'culture', 10, 0.25, 0, '{
    "text": "Se publica en el grupo de tu familia UNA de las dos. Elegí.",
    "options": ["Tu tiempo de pantalla de esta semana", "Tu última búsqueda de Google"],
    "reaction": "Elegiste la que creés que duele menos."
  }'),
  (11, 'mentime-12-amigo', 'voice', 'culture', 40, 0.25, 0, '{
    "text": "Nombrá al amigo que sacarías del grupo si nadie se enterara. Y decí por qué.",
    "speak": true, "answerType": "open", "maxSeconds": 15, "detector": true
  }'),
  (12, 'mentime-13-mayor-menor', 'mayor_menor', 'culture', 60, 0, 0, '{
    "text": "¿Te la jugás? Multiplicá tus tickets o perdelos.",
    "ladder": [1.5, 2, 3], "secondsPerCard": 12
  }'),
  (13, 'mentime-14-prediccion', 'prediction_bet', 'culture', 18, 0, 20, '{
    "text": "Los que jugaron antes que vos: ¿en qué pregunta le mintieron más a la máquina?",
    "optionA": "En la plata de las apuestas", "optionB": "En el voto", "maxTickets": 50
  }'),
  (14, 'mentime-15-casa', 'hot_take', 'culture', 8, 0, 20, '{
    "text": "NUNCA VAS A TENER CASA PROPIA.",
    "options": ["Ya lo acepté", "Ni en pedo"]
  }');

insert into drops.questions (format, label, content, card_type, timer_s, status, tags, reward_cash_usd, reward_tickets)
select c.format, c.label, c.content, c.card_type, nullif(c.timer_s, 0), 'active', array['mentime', 'drop-001'], c.cash, c.tickets
from mentime_cards c
where not exists (select 1 from drops.questions q where q.label = c.label);

-- Si ya existían (segunda corrida), se actualiza el contenido y el premio.
update drops.questions q
set content = c.content, format = c.format, card_type = c.card_type, timer_s = nullif(c.timer_s, 0), reward_cash_usd = c.cash, reward_tickets = c.tickets, status = 'active'
from mentime_cards c
where q.label = c.label;

-- ---------- El Drop ----------
insert into drops.drops (slug, name, status, season_id, config)
select 'mentime', 'MENTIME QUE ME GUSTA', 'draft', (select id from economy.seasons where status = 'active'),
  jsonb_build_object(
    'timeoutMessage', 'Brutal eligió por vos.',
    'multiplierCheckpoints', jsonb_build_object('3', jsonb_build_object('multiplier', 1.25, 'label', 'x1.25'), '9', jsonb_build_object('multiplier', 1.5, 'label', 'x1.5')),
    'detector', jsonb_build_object('lies', 1, 'winTickets', 150, 'loseTickets', 50),
    'voice', jsonb_build_object('voice_id', 'QK4xDwo9ESPHA4JNUpX3', 'fallback_voice_id', 'N6aRe3hk1YqaHDtQpTAH', 'model', 'eleven_flash_v2_5'),
    'splash', jsonb_build_object(
      'mode', 'terminal', 'buttonText', 'ENTRO',
      'staticLines', jsonb_build_array('> DROP 001 · MENTIME QUE ME GUSTA', '> 15 cartas · 4 minutos', '> Paga hasta US$ 1,75 + Golden Tickets', '> Hay una máquina adentro'),
      'typewriterLines', jsonb_build_array(
        '> Vas a contestar cosas que no le contás a nadie.',
        '> Tres veces vas a hablar.',
        '> Una vez vas a mentir.',
        '> Nadie se va a enterar.',
        '> Excepto la máquina.',
        '',
        '> Tocá ENTRO si te la bancás:')),
    'reveal', jsonb_build_object(
      'title', E'Inclasificable',
      'description', 'Ni santo ni cínico. La máquina te va a seguir mirando.',
      'archetypes', jsonb_build_array(
        jsonb_build_object('id', 'santo', 'title', E'Santo de\nInstagram', 'description', 'Todo 😇, todo "me pago todo", todo "nunca haría eso". Nadie te cree. Ni vos.', 'formula', jsonb_build_object('postureo', 1.0, 'cinismo', -0.5)),
        jsonb_build_object('id', 'cinico', 'title', E'Cínico\nfuncional', 'description', 'Lo hacés, lo sabés y lo decís. Lo único que te falta es el remordimiento.', 'formula', jsonb_build_object('cinismo', 1.0, 'postureo', -0.5)),
        jsonb_build_object('id', 'wifi', 'title', E'Desesperación\ncon wifi', 'description', 'Te cortan la plata y durás una semana. Pero tenés un plan. Siempre tenés un plan.', 'formula', jsonb_build_object('caos', 1.0)),
        jsonb_build_object('id', 'mama', 'title', E'El que llama\na mamá', 'description', 'A las 3 de la mañana, con un cuerpo en el living, igual sabés a quién llamar.', 'formula', jsonb_build_object('dependencia', 1.0, 'caos', -0.3))),
      'scoring', jsonb_build_object(
        'choiceScoring', jsonb_build_array(
          jsonb_build_object('questionIndex', 0, 'optionScores', jsonb_build_array(jsonb_build_object('dependencia', 2), jsonb_build_object('dependencia', 1), jsonb_build_object('caos', 2), jsonb_build_object('cinismo', 1, 'caos', 1))),
          jsonb_build_object('questionIndex', 1, 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1, 'dependencia', 1), jsonb_build_object('postureo', 2))),
          jsonb_build_object('questionIndex', 3, 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1), jsonb_build_object('postureo', 1), jsonb_build_object('cinismo', 1))),
          jsonb_build_object('questionIndex', 6, 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1, 'caos', 1), jsonb_build_object('postureo', 2))),
          jsonb_build_object('questionIndex', 10, 'optionScores', jsonb_build_array(jsonb_build_object('postureo', 1), jsonb_build_object('cinismo', 1))),
          jsonb_build_object('questionIndex', 14, 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1), jsonb_build_object('postureo', 1, 'caos', 1)))),
        'rafagaScoring', jsonb_build_array(jsonb_build_object('questionIndex', 2, 'majorityA', jsonb_build_object('cinismo', 2), 'majorityB', jsonb_build_object('postureo', 2))),
        'sliderScoring', jsonb_build_array(jsonb_build_object('questionIndex', 9, 'ranges', jsonb_build_array(
          jsonb_build_object('min', 0, 'max', 7, 'scores', jsonb_build_object('caos', 2, 'dependencia', 1)),
          jsonb_build_object('min', 8, 'max', 30, 'scores', jsonb_build_object('dependencia', 1)),
          jsonb_build_object('min', 31, 'max', 60, 'scores', jsonb_build_object('postureo', 1))))),
        'rankingScoring', jsonb_build_array(jsonb_build_object('questionIndex', 8, 'firstPlaceScores', jsonb_build_array(
          jsonb_build_object('caos', 1, 'cinismo', 1), jsonb_build_object('dependencia', 1), jsonb_build_object('postureo', 1), jsonb_build_object('dependencia', 1), jsonb_build_object('postureo', 2)))))))
on conflict (slug) do update set name = excluded.name, config = excluded.config, season_id = excluded.season_id;

-- Orden de las cartas.
delete from drops.drop_questions dq using drops.drops d where dq.drop_id = d.id and d.slug = 'mentime';
insert into drops.drop_questions (drop_id, question_id, position, enabled)
select d.id, q.id, c.pos, true
from mentime_cards c
join drops.questions q on q.label = c.label
join drops.drops d on d.slug = 'mentime';

commit;
