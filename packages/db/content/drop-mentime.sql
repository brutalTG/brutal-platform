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
  (0, 'mentime-01-prestamo', 'choice', 'culture', 12, 0, 20, '{
    "text": "Le prestaste 200 lucas a un amigo hace un año. Se compró una moto. Nunca te las devolvió. ¿Se las pedís?",
    "options": ["Se las pido, y si se ofende, chau", "No. La di por perdida. Y a él también"],
    "reaction": "Las dos salidas cuestan un amigo."
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
      {"text": "Leer el celular de tu pareja mientras duerme.", "optionA": "😈", "optionB": "😇"},
      {"text": "Seguir con la obra social de tu viejo después de los 25 con un papel trucho.", "optionA": "😈", "optionB": "😇"},
      {"text": "Pedirles plata \"para la facultad\" y gastarla en un viaje.", "optionA": "😈", "optionB": "😇"},
      {"text": "Cobrar un laburo que hizo entera la IA.", "optionA": "😈", "optionB": "😇"},
      {"text": "Irte del grupo de la familia sin avisar.", "optionA": "😈", "optionB": "😇"},
      {"text": "Votar en blanco y decir que votaste lo mismo que tus amigos.", "optionA": "😈", "optionB": "😇"}
    ]
  }'),
  (3, 'mentime-04-estado', 'choice', 'culture', 15, 0.25, 0, '{
    "text": "Un contacto de tu viejo te consigue un cargo en el Estado: el doble de lo que ganás, sin ir casi nunca. Nadie se entera de cómo entraste.",
    "options": ["Acepto", "Acepto y renuncio cuando consiga algo mejor", "No acepto"],
    "reaction": "Acá se separan los que hablan de los que firman."
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
  (6, 'mentime-07-ia', 'choice', 'culture', 12, 0, 20, '{
    "text": "Tu jefe te da un aumento por un informe que hizo entera la IA. ¿Le decís?",
    "options": ["No. Y uso más IA", "Sí. Me pagan por pensar"],
    "reaction": "Registrado."
  }'),
  (7, 'mentime-08-voto', 'voice', 'culture', 40, 0.25, 0, '{
    "text": "Decime a quién votaste la última vez, y a quién de tu familia nunca se lo contaste.",
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
  (10, 'mentime-11-hermano', 'choice', 'culture', 15, 0.25, 0, '{
    "text": "Tu hermano de 16 te pide que le abras una cuenta de apuestas a tu nombre. Si no, la abre con un DNI trucho.",
    "options": ["Se la abro y lo vigilo", "No. Que se arregle"],
    "reaction": "No había opción buena. Esa era la idea."
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
    "text": "En cinco años, la mayoría de tu grupo de amigos…",
    "optionA": "Sigue en Argentina", "optionB": "Ya se fue", "maxTickets": 50
  }'),
  (14, 'mentime-15-depto', 'choice', 'culture', 15, 0, 20, '{
    "text": "Te dan un departamento a tu nombre HOY. A cambio firmás que no te vas del país por diez años. ¿Firmás?",
    "options": ["Firmo", "No firmo"],
    "reaction": "La máquina ya sabía."
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
    'join', jsonb_build_object('code', 'mentime', 'open', true, 'max', 50),
    'voice', jsonb_build_object('voice_id', 'QK4xDwo9ESPHA4JNUpX3', 'fallback_voice_id', 'N6aRe3hk1YqaHDtQpTAH', 'model', 'eleven_flash_v2_5'),
    'splash', jsonb_build_object(
      'mode', 'terminal', 'buttonText', 'ENTRO',
      'staticLines', jsonb_build_array('> DROP 001 · MENTIME QUE ME GUSTA', '> 15 cartas · 4 minutos', '> Paga hasta US$ 1,75 + Golden Tickets', '> Hay una máquina adentro'),
      'typewriterLines', jsonb_build_array(
        '> Quince situaciones que ya viviste o vas a vivir.',
        '> Ninguna tiene salida limpia.',
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
        jsonb_build_object('id', 'santo', 'title', E'Santo de\nInstagram', 'description', 'No aceptás, no firmás, le decís la verdad al jefe. Nadie te cree. Ni vos.', 'formula', jsonb_build_object('postureo', 1.0, 'cinismo', -0.5)),
        jsonb_build_object('id', 'cinico', 'title', E'Cínico\nfuncional', 'description', 'Aceptás, cobrás, no le pedís la plata al amigo. Lo único que te falta es el remordimiento.', 'formula', jsonb_build_object('cinismo', 1.0, 'postureo', -0.5)),
        jsonb_build_object('id', 'wifi', 'title', E'Desesperación\ncon wifi', 'description', 'Te cortan la plata y durás una semana. Pero tenés un plan. Siempre tenés un plan.', 'formula', jsonb_build_object('caos', 1.0)),
        jsonb_build_object('id', 'familia', 'title', E'Hijo de\nfamilia', 'description', 'Te pagan, te prestan, te consiguen el cargo, te dan el depto. Y vos firmás.', 'formula', jsonb_build_object('dependencia', 1.0, 'caos', -0.3))),
      'scoring', jsonb_build_object(
        'choiceScoring', jsonb_build_array(
          jsonb_build_object('questionIndex', 0, 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1), jsonb_build_object('caos', 1, 'postureo', 1))),
          jsonb_build_object('questionIndex', 1, 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1, 'dependencia', 1), jsonb_build_object('postureo', 2))),
          jsonb_build_object('questionIndex', 3, 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 2, 'dependencia', 1), jsonb_build_object('cinismo', 1, 'caos', 1), jsonb_build_object('postureo', 2))),
          jsonb_build_object('questionIndex', 6, 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1, 'caos', 1), jsonb_build_object('postureo', 2))),
          jsonb_build_object('questionIndex', 10, 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1, 'caos', 1), jsonb_build_object('postureo', 1))),
          jsonb_build_object('questionIndex', 14, 'optionScores', jsonb_build_array(jsonb_build_object('dependencia', 2), jsonb_build_object('caos', 1, 'postureo', 1)))),
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
