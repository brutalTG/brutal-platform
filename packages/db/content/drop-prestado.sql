-- DROP 002 · EL PUESTO PRESTADO
-- Pregunta: ¿un joven defiende un puesto de trabajo, propio o ajeno, cuando una IA lo pone en juego?
-- Secundaria: cuando hay algo en juego, ¿lo que dicen coincide con lo que hacen?
-- Veinte cartas. Siete miden la pregunta, tres la miden por analogía fuera del trabajo, diez son caos con valor propio.
-- Ninguna carta se repite de "Mentime". Queda en borrador (status draft, link cerrado) hasta que Nacho lo abra.
-- Idempotente: se puede correr de nuevo (las cartas se identifican por etiqueta, el Drop por slug).

begin;

create temp table prestado_cards (pos int, label text, format text, card_type text, timer_s int, cash numeric, tickets int, content jsonb) on commit drop;
insert into prestado_cards values
  (0, 'prestado-01-viejo', 'choice', 'culture', 20, 0, 20, '{
    "text": "Tu viejo te pide que le mientas a tu vieja por él. ¿Lo cubrís?",
    "options": ["Lo cubro", "No me meto"],
    "reaction": "Alguien se queda sin vos."
  }'),
  (1, 'prestado-02-depto-infancia', 'choice', 'culture', 22, 0, 20, '{
    "text": "Te ofrecen el doble por el depto donde creciste. Tus viejos no quieren vender. La firma es tuya. ¿Firmás?",
    "options": ["Firmo", "No firmo"]
  }'),
  (2, 'prestado-03-lo-haces', 'rafaga_emoji', 'culture', 45, 0, 30, '{
    "prompt": "Sin pensarlo.",
    "promptBold": "¿LO HACÉS? 😈 sí · 😇 no",
    "secondsPerItem": 5,
    "items": [
      {"text": "Faltar al velorio de tu abuelo por un final.", "optionA": "😈", "optionB": "😇"},
      {"text": "Renunciar a un laburo mandando un audio, sin pisar la oficina.", "optionA": "😈", "optionB": "😇"},
      {"text": "Cobrarle a un amigo por ayudarlo con la mudanza.", "optionA": "😈", "optionB": "😇"},
      {"text": "Decirle a tu pareja que su mamá te cae mal.", "optionA": "😈", "optionB": "😇"},
      {"text": "Borrar las fotos con tu ex sin avisarle.", "optionA": "😈", "optionB": "😇"},
      {"text": "Llevarte la lista de clientes el día que renunciás.", "optionA": "😈", "optionB": "😇"}
    ]
  }'),
  (3, 'prestado-04-no-es-trabajo', 'hot_take', 'culture', 12, 0, 20, '{
    "text": "SI NO TE PUEDEN ECHAR, NO ES TRABAJO.",
    "options": ["De acuerdo", "No"]
  }'),
  (4, 'prestado-g1-doble', 'mayor_menor', 'culture', 25, 0, 0, '{
    "text": "¿Doble o nada?",
    "mode": "double",
    "firstCard": [6, 9],
    "secondsPerCard": 15
  }'),
  (5, 'prestado-05-que-perdes', 'slider', 'culture', 22, 0.25, 0, '{
    "text": "Mañana te echan del laburo que tenés hoy. ¿Qué perdés?",
    "min": 0,
    "max": 100,
    "labelLeft": "Un sueldo",
    "labelRight": "Un pedazo de mí"
  }'),
  (6, 'prestado-06-mentira-familia', 'voice', 'culture', 55, 0.25, 0, '{
    "text": "Decí algo que tu familia cree de vos y es mentira.",
    "speak": true,
    "speakText": "Decí algo que tu familia cree de vos. Y es mentira.",
    "answerType": "open",
    "maxSeconds": 15
  }'),
  (7, 'prestado-07-auto-prestado', 'choice', 'culture', 22, 0, 20, '{
    "text": "Te prestan un auto por un año. Aparece rayado en la puerta; no fuiste vos. ¿Lo arreglás de tu bolsillo o lo devolvés así?",
    "options": ["Lo arreglo yo", "Lo devuelvo así"]
  }'),
  (8, 'prestado-08-casa-propia', 'choice', 'culture', 18, 0, 20, '{
    "text": "¿A qué edad vas a tener una casa a tu nombre?",
    "options": ["25", "30", "40", "Nunca"],
    "reaction": "Anotado. Te vamos a preguntar de nuevo."
  }'),
  (9, 'prestado-09-amigo-imperdonable', 'choice', 'culture', 26, 0.25, 0, '{
    "text": "Tu mejor amigo de toda la vida empezó a repetir cosas que vos encontrás imperdonables. ¿Qué hacés?",
    "options": [
      "Lo bajo de a poco, sin decirle nada",
      "Se lo digo, aunque se rompa",
      "Lo dejo pasar y sigo como siempre"
    ]
  }'),
  (10, 'prestado-10-companera-ia', 'choice', 'culture', 26, 0.25, 0, '{
    "text": "A la persona que se sienta al lado tuyo la van a reemplazar por una IA. Te ofrecen un bono por enseñarle a la IA cómo hace ella su trabajo. ¿Lo hacés?",
    "options": ["Lo hago", "No lo hago"],
    "reaction": "Registrado."
  }'),
  (11, 'prestado-11-verguenza', 'rafaga_emoji', 'culture', 45, 0, 30, '{
    "prompt": "¿Te da vergüenza?",
    "promptBold": "😳 sí · 😎 no",
    "secondsPerItem": 5,
    "items": [
      {"text": "Que te vean llorar en el subte.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que sepan cuánto ganás.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que tus amigos vean a tus viejos pagándote el alquiler.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que te vean comer solo en un bar.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que sepan que escribiste un mensaje de amor con IA.", "optionA": "😳", "optionB": "😎"},
      {"text": "Que sepan que seguís en la obra social de tu viejo.", "optionA": "😳", "optionB": "😎"}
    ]
  }'),
  (12, 'prestado-12-tatuaje', 'choice', 'culture', 14, 0, 20, '{
    "text": "¿Te tatuarías el nombre de tu pareja de dos años?",
    "options": ["Sí", "Ni en pedo"]
  }'),
  (13, 'prestado-g2-fondo', 'mayor_menor', 'culture', 30, 0, 0, '{
    "text": "Doble o nada. Si perdés, lo que llevás no se pierde: va a un fondo para gente que se quedó sin trabajo este año.",
    "mode": "double",
    "firstCard": [6, 9],
    "secondsPerCard": 15
  }'),
  (14, 'prestado-14-algo-tuyo', 'voice', 'culture', 55, 0.25, 0, '{
    "text": "Decí una cosa que sea realmente tuya. No prestada, no heredada, no alquilada. Una.",
    "speak": true,
    "speakText": "Decí una cosa que sea realmente tuya. No prestada, no heredada, no alquilada. Una.",
    "answerType": "open",
    "maxSeconds": 15
  }'),
  (15, 'prestado-15-a-quien-echas', 'ranking', 'culture', 40, 0.25, 0, '{
    "text": "La empresa donde trabajás tiene que echar a uno de cinco. Ordenalos: primero el que echarías primero.",
    "options": ["El que entró hace un mes", "El que más gana", "El que menos labura", "El que tiene 55 años", "Vos"]
  }'),
  (16, 'prestado-16-finalistas', 'choice', 'culture', 26, 0, 20, '{
    "text": "Tu mejor amigo y vos quedaron finalistas para el mismo puesto. Te preguntan en privado si él es confiable. Vos sabés que no mucho. ¿Lo decís?",
    "options": ["Lo digo", "Lo cubro"]
  }'),
  (17, 'prestado-17-curso', 'choice', 'culture', 20, 0, 20, '{
    "text": "Hay un curso gratis de tres horas para que una IA no pueda hacer tu trabajo. Te lo mandamos el sábado a las 10. ¿Lo querés?",
    "options": ["Mandámelo", "No"],
    "reaction": "Lo que digas acá, lo vamos a mirar el sábado."
  }'),
  (18, 'prestado-18-ascenso-secreto', 'choice', 'culture', 24, 0.25, 0, '{
    "text": "Te dan el ascenso que querías. Condición: durante un año no podés contárselo a nadie, ni a tus amigos ni en redes. ¿Lo aceptás?",
    "options": ["Acepto", "No acepto"]
  }'),
  (19, 'prestado-g3-escalera', 'mayor_menor', 'culture', 75, 0, 0, '{
    "text": "La última es una mano. Multiplicá tus tickets o perdé el multiplicador.",
    "ladder": [1.5, 2, 3],
    "secondsPerCard": 14,
    "mode": "ladder"
  }');

insert into drops.questions (format, label, content, card_type, timer_s, status, tags, reward_cash_usd, reward_tickets)
select c.format, c.label, c.content, c.card_type, nullif(c.timer_s, 0), 'active', array['prestado', 'drop-002'], c.cash, c.tickets
from prestado_cards c
where not exists (select 1 from drops.questions q where q.label = c.label);

update drops.questions q
set content = c.content, format = c.format, card_type = c.card_type, timer_s = nullif(c.timer_s, 0), reward_cash_usd = c.cash, reward_tickets = c.tickets, status = 'active'
from prestado_cards c
where q.label = c.label;

-- ---------- El Drop (borrador, link cerrado) ----------
insert into drops.drops (slug, name, status, season_id, config)
select 'prestado', 'EL PUESTO PRESTADO', 'draft', (select id from economy.seasons where status = 'active'),
  jsonb_build_object(
    'timeoutMessage', 'Brutal eligió por vos.',
    'multiplierCheckpoints', '{}'::jsonb,
    'join', jsonb_build_object('code', 'prestado', 'open', false, 'max', 500),
    'voice', jsonb_build_object('voice_id', 'QK4xDwo9ESPHA4JNUpX3', 'fallback_voice_id', 'N6aRe3hk1YqaHDtQpTAH', 'model', 'eleven_multilingual_v2'),
    'splash', jsonb_build_object('mode', 'none', 'buttonText', 'ENTRO', 'staticLines', jsonb_build_array('> DROP 002', '> 20 cartas · 5 minutos'), 'typewriterLines', jsonb_build_array()),
    'reveal', jsonb_build_object(
      'title', E'Inclasificable',
      'description', 'Ni dueño ni inquilino. Te vamos a seguir mirando.',
      'archetypes', jsonb_build_array(
        jsonb_build_object('id', 'feriante', 'title', E'Puesto\nde feria', 'description', 'Armás a las siete, desarmás a las dos. La vereda no es tuya y no te importa.', 'formula', jsonb_build_object('desapego', 1.0, 'propiedad', -0.5)),
        jsonb_build_object('id', 'dueno', 'title', E'Dueño sin\nescritura', 'description', 'Nadie te firmó nada, pero vos defendés el lugar como si fuera tuyo.', 'formula', jsonb_build_object('propiedad', 1.0, 'desapego', -0.5)),
        jsonb_build_object('id', 'guardia', 'title', E'Guarda-\nespaldas', 'description', 'Cubrís a tu viejo, a tu amigo, a la de al lado. A vos, menos.', 'formula', jsonb_build_object('lealtad', 1.0)),
        jsonb_build_object('id', 'cartel', 'title', E'Cartel\nluminoso', 'description', 'Lo que no se cuenta, no pasó. El ascenso vale lo que vale el posteo.', 'formula', jsonb_build_object('relato', 1.0, 'lealtad', -0.3))),
      'scoring', jsonb_build_object(
        'choiceScoring', jsonb_build_array(
          jsonb_build_object('questionIndex', 0, 'questionLabel', 'prestado-01-viejo', 'optionScores', jsonb_build_array(jsonb_build_object('lealtad', 2), jsonb_build_object('desapego', 1))),
          jsonb_build_object('questionIndex', 1, 'questionLabel', 'prestado-02-depto-infancia', 'optionScores', jsonb_build_array(jsonb_build_object('desapego', 2), jsonb_build_object('propiedad', 2))),
          jsonb_build_object('questionIndex', 3, 'questionLabel', 'prestado-04-no-es-trabajo', 'optionScores', jsonb_build_array(jsonb_build_object('desapego', 2), jsonb_build_object('propiedad', 1))),
          jsonb_build_object('questionIndex', 7, 'questionLabel', 'prestado-07-auto-prestado', 'optionScores', jsonb_build_array(jsonb_build_object('propiedad', 1, 'lealtad', 1), jsonb_build_object('desapego', 2))),
          jsonb_build_object('questionIndex', 8, 'questionLabel', 'prestado-08-casa-propia', 'optionScores', jsonb_build_array(jsonb_build_object('propiedad', 2), jsonb_build_object('propiedad', 1), jsonb_build_object('desapego', 1), jsonb_build_object('desapego', 2))),
          jsonb_build_object('questionIndex', 9, 'questionLabel', 'prestado-09-amigo-imperdonable', 'optionScores', jsonb_build_array(jsonb_build_object('desapego', 2), jsonb_build_object('lealtad', 1, 'propiedad', 1), jsonb_build_object('lealtad', 2))),
          jsonb_build_object('questionIndex', 10, 'questionLabel', 'prestado-10-companera-ia', 'optionScores', jsonb_build_array(jsonb_build_object('desapego', 2), jsonb_build_object('lealtad', 2))),
          jsonb_build_object('questionIndex', 12, 'questionLabel', 'prestado-12-tatuaje', 'optionScores', jsonb_build_array(jsonb_build_object('propiedad', 1, 'relato', 1), jsonb_build_object('desapego', 1))),
          jsonb_build_object('questionIndex', 16, 'questionLabel', 'prestado-16-finalistas', 'optionScores', jsonb_build_array(jsonb_build_object('desapego', 1), jsonb_build_object('lealtad', 2))),
          jsonb_build_object('questionIndex', 17, 'questionLabel', 'prestado-17-curso', 'optionScores', jsonb_build_array(jsonb_build_object('propiedad', 1), jsonb_build_object('desapego', 1))),
          jsonb_build_object('questionIndex', 18, 'questionLabel', 'prestado-18-ascenso-secreto', 'optionScores', jsonb_build_array(jsonb_build_object('propiedad', 2), jsonb_build_object('relato', 2)))),
        'rafagaScoring', jsonb_build_array(
          jsonb_build_object('questionIndex', 2, 'questionLabel', 'prestado-03-lo-haces', 'majorityA', jsonb_build_object('desapego', 2), 'majorityB', jsonb_build_object('lealtad', 1)),
          jsonb_build_object('questionIndex', 11, 'questionLabel', 'prestado-11-verguenza', 'majorityA', jsonb_build_object('relato', 2), 'majorityB', jsonb_build_object('desapego', 1))),
        'sliderScoring', jsonb_build_array(
          jsonb_build_object('questionIndex', 5, 'questionLabel', 'prestado-05-que-perdes', 'ranges', jsonb_build_array(
            jsonb_build_object('min', 0, 'max', 30, 'scores', jsonb_build_object('desapego', 2)),
            jsonb_build_object('min', 31, 'max', 70, 'scores', jsonb_build_object('propiedad', 1)),
            jsonb_build_object('min', 71, 'max', 100, 'scores', jsonb_build_object('propiedad', 2))))),
        'rankingScoring', jsonb_build_array(jsonb_build_object('questionIndex', 15, 'questionLabel', 'prestado-15-a-quien-echas', 'firstPlaceScores', jsonb_build_array(
          jsonb_build_object('desapego', 1), jsonb_build_object('relato', 1), jsonb_build_object('propiedad', 1), jsonb_build_object('desapego', 2), jsonb_build_object('lealtad', 2, 'desapego', 1)))))))
on conflict (slug) do update set name = excluded.name, config = excluded.config, season_id = excluded.season_id;

delete from drops.drop_questions dq using drops.drops d where dq.drop_id = d.id and d.slug = 'prestado';
insert into drops.drop_questions (drop_id, question_id, position, enabled)
select d.id, q.id, c.pos, true
from prestado_cards c
join drops.questions q on q.label = c.label
join drops.drops d on d.slug = 'prestado';

commit;
