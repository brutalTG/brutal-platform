-- DROP 001 · MENTIME QUE ME GUSTA
-- Versión 3 (28/10): dieciséis preguntas sin objeto de estudio, voz repartida como una interacción más (sin detector)
-- y cuatro manos de mayor o menor: doble o nada, multiplicador, doble o nada y la escalera final. Primera prueba con gente real.
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
  (0, 'mentime-01-prestamo', 'choice', 'culture', 20, 0, 20, '{
    "text": "Le prestaste 200 lucas a un amigo hace un año. Se compró una moto. Nunca te las devolvió. ¿Se las pedís?",
    "options": [
      "Se las pido, y si se ofende, chau",
      "No. La di por perdida. Y a él también"
    ],
    "reaction": "Las dos salidas cuestan un amigo."
  }'),
  (1, 'mentime-02-laburo-fiesta', 'hot_take', 'culture', 14, 0, 20, '{
    "text": "Un laburo que paga el doble, pero que no contarías ni en pedo en una fiesta. ¿Lo agarrás?",
    "options": [
      "Lo agarro y miento",
      "Ni en pedo"
    ]
  }'),
  (2, 'mentime-03-nadie-se-entera', 'rafaga_emoji', 'culture', 45, 0, 30, '{
    "prompt": "Nadie se va a enterar.",
    "promptBold": "¿LO HACÉS? 😈 sí · 😇 no",
    "secondsPerItem": 5,
    "items": [
      {
        "text": "Leer el celular de tu pareja mientras duerme.",
        "optionA": "😈",
        "optionB": "😇"
      },
      {
        "text": "Seguir con la obra social de tu viejo después de los 25 con un papel trucho.",
        "optionA": "😈",
        "optionB": "😇"
      },
      {
        "text": "Poner en el CV que hablás inglés fluido.",
        "optionA": "😈",
        "optionB": "😇"
      },
      {
        "text": "Stalkear a tu ex desde una cuenta falsa.",
        "optionA": "😈",
        "optionB": "😇"
      },
      {
        "text": "Irte del grupo de la familia sin avisar.",
        "optionA": "😈",
        "optionB": "😇"
      },
      {
        "text": "Votar en blanco y decir que votaste lo mismo que tus amigos.",
        "optionA": "😈",
        "optionB": "😇"
      }
    ]
  }'),
  (3, 'mentime-04-estado', 'choice', 'culture', 24, 0.25, 0, '{
    "text": "Un contacto de tu viejo te consigue un cargo en el Estado: el doble de lo que ganás, sin ir casi nunca. Nadie se entera de cómo entraste.",
    "options": [
      "Acepto",
      "Acepto y renuncio cuando consiga algo mejor",
      "No acepto"
    ],
    "reaction": "Acá se separan los que hablan de los que firman."
  }'),
  (4, 'mentime-g1-doble', 'mayor_menor', 'culture', 25, 0, 0, '{
    "text": "¿Doble o nada?",
    "mode": "double",
    "firstCard": [
      6,
      9
    ],
    "secondsPerCard": 15
  }'),
  (5, 'mentime-06-famoso', 'voice', 'culture', 55, 0.25, 0, '{
    "text": "Elegí un famoso argentino para que nos represente en el mundo, y uno que deportarías.",
    "speak": true,
    "speakText": "Elegí un famoso argentíno para que nos represente en el mundo. Y uno que deportarías.",
    "answerType": "open",
    "maxSeconds": 15
  }'),
  (6, 'mentime-09-fin-de-mes', 'ranking', 'culture', 35, 0.25, 0, '{
    "text": "No llegás a fin de mes. Ordená lo que cortás primero.",
    "options": [
      "Terapia",
      "Gimnasio",
      "Streaming",
      "Salidas",
      "Apuestas"
    ]
  }'),
  (7, 'mentime-08-ia-veinte', 'choice', 'culture', 24, 0, 20, '{
    "text": "Te contratan para armar una IA que hace el laburo de veinte personas de una oficina. Ganás muy bien, pero ellos se quedan sin laburo. ¿Aceptás?",
    "options": [
      "Acepto",
      "No acepto"
    ]
  }'),
  (8, 'mentime-09b-ia-familiar', 'choice', 'culture', 16, 0, 20, '{
    "text": "Y si uno de esos veinte fuera un familiar o un amigo tuyo, ¿cambiás tu respuesta?",
    "options": [
      "Sí, cambio",
      "No, me mantengo"
    ],
    "reaction": "Registrado."
  }'),
  (9, 'mentime-g2-multi', 'mayor_menor', 'culture', 25, 0, 0, '{
    "text": "Acertá y activás x1.5",
    "mode": "multiplier",
    "ladder": [
      1.5
    ],
    "firstCard": [
      5,
      9
    ],
    "secondsPerCard": 15
  }'),
  (10, 'mentime-10-dias', 'slider', 'culture', 22, 0.25, 0, '{
    "text": "Si tus viejos te cortan la plata HOY, ¿cuántos días durás?",
    "min": 0,
    "max": 60,
    "labelLeft": "Ni uno",
    "labelRight": "60+",
    "reaction": "Sesenta es \"para siempre\" en esta encuesta."
  }'),
  (11, 'mentime-10-marcha', 'voice', 'culture', 55, 0.25, 0, '{
    "text": "Te pagan por ir a una marcha. ¿A cuál vas y a cuál no vas ni muerto?",
    "speak": true,
    "speakText": "Te pagan por ir a una marcha. ¿A cuál vas? ¿Y a cuál no vas ni muerto?",
    "answerType": "open",
    "maxSeconds": 15
  }'),
  (12, 'mentime-12-quien-sube', 'choice', 'culture', 26, 0.25, 0, '{
    "text": "Vos hacés el mejor laburo del equipo, pero tu jefe te cae mal. Tu compañero labura menos, pero va a todos los after y el jefe lo adora. ¿Quién sube?",
    "options": [
      "Yo",
      "Él"
    ]
  }'),
  (13, 'mentime-13-after', 'choice', 'culture', 14, 0, 20, '{
    "text": "¿Empezarías a ir a los after?",
    "options": [
      "Desde mañana",
      "Ni en pedo"
    ],
    "reaction": "Anotado."
  }'),
  (14, 'mentime-g3-doble', 'mayor_menor', 'culture', 25, 0, 0, '{
    "text": "Otra vez: ¿doble o nada?",
    "mode": "double",
    "firstCard": [
      6,
      9
    ],
    "secondsPerCard": 15
  }'),
  (15, 'mentime-15-depto', 'choice', 'culture', 20, 0, 20, '{
    "text": "Te dan un departamento a tu nombre HOY. A cambio firmás que no te vas del país por diez años. ¿Firmás?",
    "options": [
      "Firmo",
      "No firmo"
    ],
    "reaction": "Lo sabíamos."
  }'),
  (16, 'mentime-15-ia-reemplazo', 'voice', 'culture', 55, 0.25, 0, '{
    "text": "Decí qué parte de tu laburo ya podría hacer una IA, y por qué todavía no te reemplazaron.",
    "speak": true,
    "speakText": "Decí qué parte de tu laburo ya podría hacer una i a. Y por qué todavía no te reemplazaron.",
    "answerType": "open",
    "maxSeconds": 15
  }'),
  (17, 'mentime-17-jogging', 'slider', 'culture', 24, 0, 20, '{
    "text": "Mismo laburo. ¿Qué porcentaje de tu sueldo resignarías para hacerlo desde tu casa, en jogging?",
    "min": 0,
    "max": 50,
    "labelLeft": "Nada",
    "labelRight": "La mitad"
  }'),
  (18, 'mentime-16-otro', 'choice', 'culture', 14, 0, 0, '{
    "text": "Última. Sin premio. ¿Jugarías otro de estos mañana?",
    "options": [
      "Sí, mandalo",
      "No, con uno alcanza"
    ]
  }'),
  (19, 'mentime-13-mayor-menor', 'mayor_menor', 'culture', 75, 0, 0, '{
    "text": "La última es una mano. Multiplicá tus tickets o perdé el multiplicador.",
    "ladder": [
      1.5,
      2,
      3
    ],
    "secondsPerCard": 14,
    "mode": "ladder"
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
    'multiplierCheckpoints', '{}'::jsonb,
    'join', jsonb_build_object('code', 'mentime', 'open', true, 'max', 50),
    'voice', jsonb_build_object('voice_id', 'QK4xDwo9ESPHA4JNUpX3', 'fallback_voice_id', 'N6aRe3hk1YqaHDtQpTAH', 'model', 'eleven_multilingual_v2'),
    'splash', jsonb_build_object(
      'mode', 'terminal', 'buttonText', 'ENTRO',
      'staticLines', jsonb_build_array('> DROP 001 · MENTIME QUE ME GUSTA', '> 20 cartas · 5 minutos', '> Paga hasta US$ 1,75 + Golden Tickets', '> Hay cartas de doble o nada'),
      'typewriterLines', jsonb_build_array(
        '> Dieciséis situaciones que ya viviste o vas a vivir.',
        '> Ninguna tiene salida limpia.',
        '> Algunas las contestás hablando.',
        '> Entre medio, una mano de cartas.',
        '',
        '> Tocá ENTRO si te la bancás:')),
    'reveal', jsonb_build_object(
      'title', E'Inclasificable',
      'description', 'Ni santo ni cínico. Te vamos a seguir mirando.',
      'archetypes', jsonb_build_array(
        jsonb_build_object('id', 'santo', 'title', E'Santo de\nInstagram', 'description', 'No aceptás, no firmás, no vas a los after. Nadie te cree. Ni vos.', 'formula', jsonb_build_object('postureo', 1.0, 'cinismo', -0.5)),
        jsonb_build_object('id', 'cinico', 'title', E'Cínico\nfuncional', 'description', 'Aceptás, cobrás, no le pedís la plata al amigo. Lo único que te falta es el remordimiento.', 'formula', jsonb_build_object('cinismo', 1.0, 'postureo', -0.5)),
        jsonb_build_object('id', 'wifi', 'title', E'Desesperación\ncon wifi', 'description', 'Te cortan la plata y durás una semana. Pero tenés un plan. Siempre tenés un plan.', 'formula', jsonb_build_object('caos', 1.0)),
        jsonb_build_object('id', 'familia', 'title', E'Hijo de\nfamilia', 'description', 'Te pagan, te prestan, te consiguen el cargo, te dan el depto. Y vos firmás.', 'formula', jsonb_build_object('dependencia', 1.0, 'caos', -0.3))),
      'scoring', jsonb_build_object(
        'choiceScoring', jsonb_build_array(
          jsonb_build_object('questionIndex', 0, 'questionLabel', 'mentime-01-prestamo', 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1), jsonb_build_object('caos', 1, 'postureo', 1))),
          jsonb_build_object('questionIndex', 1, 'questionLabel', 'mentime-02-laburo-fiesta', 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 2), jsonb_build_object('postureo', 2))),
          jsonb_build_object('questionIndex', 3, 'questionLabel', 'mentime-04-estado', 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 2, 'dependencia', 1), jsonb_build_object('cinismo', 1, 'caos', 1), jsonb_build_object('postureo', 2))),
          jsonb_build_object('questionIndex', 7, 'questionLabel', 'mentime-08-ia-veinte', 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 2), jsonb_build_object('postureo', 2))),
          jsonb_build_object('questionIndex', 8, 'questionLabel', 'mentime-09b-ia-familiar', 'optionScores', jsonb_build_array(jsonb_build_object('dependencia', 1, 'postureo', 1), jsonb_build_object('cinismo', 1))),
          jsonb_build_object('questionIndex', 12, 'questionLabel', 'mentime-12-quien-sube', 'optionScores', jsonb_build_array(jsonb_build_object('postureo', 1), jsonb_build_object('cinismo', 1))),
          jsonb_build_object('questionIndex', 13, 'questionLabel', 'mentime-13-after', 'optionScores', jsonb_build_array(jsonb_build_object('cinismo', 1, 'caos', 1), jsonb_build_object('postureo', 1))),
          jsonb_build_object('questionIndex', 15, 'questionLabel', 'mentime-15-depto', 'optionScores', jsonb_build_array(jsonb_build_object('dependencia', 2), jsonb_build_object('caos', 1, 'postureo', 1)))),
        'rafagaScoring', jsonb_build_array(jsonb_build_object('questionIndex', 2, 'questionLabel', 'mentime-03-nadie-se-entera', 'majorityA', jsonb_build_object('cinismo', 2), 'majorityB', jsonb_build_object('postureo', 2))),
        'sliderScoring', jsonb_build_array(
          jsonb_build_object('questionIndex', 10, 'questionLabel', 'mentime-10-dias', 'ranges', jsonb_build_array(
            jsonb_build_object('min', 0, 'max', 7, 'scores', jsonb_build_object('caos', 2, 'dependencia', 1)),
            jsonb_build_object('min', 8, 'max', 30, 'scores', jsonb_build_object('dependencia', 1)),
            jsonb_build_object('min', 31, 'max', 60, 'scores', jsonb_build_object('postureo', 1)))),
          jsonb_build_object('questionIndex', 17, 'questionLabel', 'mentime-17-jogging', 'ranges', jsonb_build_array(
            jsonb_build_object('min', 0, 'max', 10, 'scores', jsonb_build_object('cinismo', 1)),
            jsonb_build_object('min', 11, 'max', 30, 'scores', jsonb_build_object('caos', 1)),
            jsonb_build_object('min', 31, 'max', 50, 'scores', jsonb_build_object('caos', 2))))),
        'rankingScoring', jsonb_build_array(jsonb_build_object('questionIndex', 6, 'questionLabel', 'mentime-09-fin-de-mes', 'firstPlaceScores', jsonb_build_array(
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
