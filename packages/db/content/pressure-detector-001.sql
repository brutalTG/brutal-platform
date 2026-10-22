-- Contenido inicial del detector de mentiras (PRESSURE · La máquina).
-- Idempotente: se puede correr de nuevo. Después se edita desde el panel.
-- No es una migración: es contenido. Se carga en test y, con OK, en producción.

begin;

-- Temporada activa: los tickets de todas las apps suman acá.
insert into economy.seasons (slug, name, starts_at, ends_at, status)
select 't1-2026', 'Temporada 1', now(), timestamptz '2026-12-31 23:59:59-03', 'active'
where not exists (select 1 from economy.seasons where status = 'active');

-- Estudio al que aporta la señal del detector.
insert into signal.studies (slug, name, thesis, status)
values ('libertad-estructura', 'Libertad o estructura',
        'Para la Gen Z argentina pesa más quién decide sobre ellos que el sector (Estado o privado) donde trabajan.', 'field')
on conflict (slug) do nothing;

insert into signal.subtheses (study_id, code, statement, position)
select s.id, x.code, x.statement, x.pos
from signal.studies s,
     (values ('LE1', 'Cambian plata por autonomía: aceptan ganar menos si nadie les dice qué hacer.', 1),
             ('LE2', 'La estabilidad del Estado ya no compensa el aburrimiento ni la jerarquía.', 2),
             ('LE3', 'El control del horario se vive como falta de respeto, no como norma.', 3)) as x(code, statement, pos)
where s.slug = 'libertad-estructura'
on conflict (study_id, code) do nothing;

-- El juego. Reglas, recompensas y frases de la máquina viven en la definición.
insert into pressure.experiments (slug, name, series, episode, format, status, max_duration_s, study_id, definition)
select 'detector-001', 'La máquina', 'Detector', 1, 'voice_game', 'testing', 420, s.id,
  jsonb_build_object(
    'pitch', jsonb_build_array(
      'Una máquina te va a hacer 10 preguntas.',
      'En 3 tenés que mentirle. Vos elegís cuáles.',
      'Si no te agarra ninguna, ganás.'),
    'rules', jsonb_build_object('lies', 3, 'win_max_caught', 0),
    'rewards', jsonb_build_object('per_answer', 50, 'max', 500, 'win_bonus', 200),
    'voice', jsonb_build_object('voice_id', 'HnC0hwQkrsAhaQN1Y2HD', 'fallback_voice_id', 'MjtZn5tagxL1RO6w9ER5', 'model', 'eleven_flash_v2_5'),
    'lines', jsonb_build_object(
      'intro', 'Soy la máquina. Diez preguntas. Tres veces me vas a mentir, y vos elegís cuándo. Yo solo escucho.',
      'calibration_start', 'Primero te calibro. Estas, contestalas con la verdad.',
      'calibration_end', 'Listo. Ya sé cómo suena tu verdad. Y cómo suena tu mentira.',
      'game_start', 'Empezamos. Antes de cada respuesta, marcá en secreto si vas a mentir. Yo no veo tu pantalla.',
      'reactions', jsonb_build_array('Anotado.', 'Mmm.', 'El papel se movió.', 'Seguí.', 'Eso lo voy a revisar.', 'Interesante.', 'Ajá.', 'Bien.', 'Qué rápido contestaste.', 'Eso tardó.'),
      'unclear', 'No te entendí. ¿Sí o no?',
      'not_heard', 'No te escuché. Hablá más fuerte.',
      'accusation', 'Terminamos. Me mentiste en la {a}, en la {b} y en la {c}.',
      'win', 'No te agarré ninguna. Me ganaste. Esta vez.',
      'lose', 'Te agarré.')
  )
from signal.studies s where s.slug = 'libertad-estructura'
on conflict (slug) do nothing;

-- Preguntas. Se recargan solo si el experimento todavía no tiene ninguna.
insert into pressure.items (experiment_id, section, position, kind, prompt, screen_text, answer_type, follow_up, subthesis_id, source_note)
select e.id, x.section, x.pos, x.kind, x.prompt, x.screen, x.atype, x.follow,
       (select st.id from signal.subtheses st join signal.studies s2 on s2.id = st.study_id
         where s2.slug = 'libertad-estructura' and st.code = x.sub),
       x.source
from pressure.experiments e,
(values
  -- Calibración: verdad obligatoria + una mentira obvia.
  ('calibration', 1, 'calibration', '¿Cuántos años tenés?', 'Edad', 'number', null, null, null),
  ('calibration', 2, 'calibration', '¿Estudiás, trabajás, las dos cosas o ninguna?', '¿Estudiás o trabajás?', 'open', null, null, null),
  ('calibration', 3, 'calibration', '¿En qué provincia vivís?', 'Provincia', 'open', null, null, null),
  ('calibration', 4, 'obvious_lie', 'Ahora mentime. Decime que tenés ochenta años.', 'Mentime: tenés 80 años', 'open', null, null, null),
  -- Juego: 7 de cultura y 3 de señal (con repregunta).
  ('game', 1, 'fun', '¿Lloraste con la final que perdimos contra España?', '¿Lloraste con la final contra España?', 'yes_no', null, null,
     'Argentina perdió la final del Mundial 2026 contra España (19/7/2026).'),
  ('game', 2, 'fun', 'France Football hace votar la mejor temporada de la historia, y el 2008 de Cristiano va primero con el setenta y cinco por ciento. ¿Estás de acuerdo con que le gane a Messi?',
     '¿Cristiano 2008 mejor que cualquier Messi?', 'agree', null, null,
     'BOAT de France Football: CR7 2008 con 75%, Messi 2012 y 2023 con 9% cada una; resultados el 28/10/2026. Infobae 22/10/2026.'),
  ('game', 3, 'signal', 'Prefiero ganar menos y que nadie me diga qué hacer. ¿De acuerdo o no?', 'Ganar menos y que nadie me mande', 'agree',
     '¿Y si fuera la mitad de la plata?', 'LE1', null),
  ('game', 4, 'fun', 'Hay fans que acamparon meses en La Plata para ver a BTS. ¿Vos acamparías una semana en la calle por tu artista favorito?',
     '¿Acamparías una semana por tu artista?', 'yes_no', null, null,
     'BTS toca en el Estadio Único de La Plata el 23 y 24/10/2026; desalojaron fans que acampaban meses antes.'),
  ('game', 5, 'fun', '¿Stalkeaste a un ex en las últimas dos semanas?', '¿Stalkeaste a un ex?', 'yes_no', null, null, null),
  ('game', 6, 'signal', '¿Aceptarías un laburo en planta permanente en el Estado aunque sea aburrido?', '¿Planta permanente aunque sea aburrido?', 'yes_no',
     '¿Por qué?', 'LE2', null),
  ('game', 7, 'fun', 'Varias provincias ya prohibieron el celular en el aula. ¿Estás de acuerdo?', '¿Prohibir el celular en el aula?', 'agree', null, null,
     'Provincia de Buenos Aires prohibió por ley el celular en primarias (julio 2026); Neuquén fue la primera.'),
  ('game', 8, 'fun', '¿Entregaste algo que hizo una inteligencia artificial diciendo que lo hiciste vos?', '¿Entregaste algo hecho por una IA como tuyo?', 'yes_no', null, null, null),
  ('game', 9, 'signal', 'Un jefe que te controla el horario es una falta de respeto. ¿De acuerdo o no?', 'Que te controlen el horario es una falta de respeto', 'agree',
     '¿Y si te paga el doble?', 'LE3', null),
  ('game', 10, 'fun', '¿Le mentiste a tu vieja este mes sobre dónde estabas?', '¿Le mentiste a tu vieja sobre dónde estabas?', 'yes_no', null, null, null)
) as x(section, pos, kind, prompt, screen, atype, follow, sub, source)
where e.slug = 'detector-001'
  and not exists (select 1 from pressure.items i where i.experiment_id = e.id);

-- Mensajes de WhatsApp. Son mensajes de sesión (responden a un mensaje del nodo), no plantillas.
insert into messaging.templates (key, purpose, provider_name, category, body, status) values
  ('pressure_invite', 'Link al detector cuando un invitado escribe', 'session', 'utility',
   'La máquina te está esperando.' || chr(10) || '10 preguntas. 3 mentiras. Que no te agarre.' || chr(10) || chr(10) || '{link}' || chr(10) || chr(10) || 'El link es tuyo, no lo pases. Necesitás auriculares o un lugar tranquilo: es con voz.', 'approved'),
  ('pressure_result', 'Resultado al terminar', 'session', 'utility',
   '{verdict}' || chr(10) || '+{tickets} Golden Tickets.' || chr(10) || 'Vas #{position} de {players} en la temporada.' || chr(10) || chr(10) || 'Escribí RANKING para ver la tabla.', 'approved'),
  ('ranking', 'Tabla de la temporada', 'session', 'utility', '{table}', 'approved'),
  ('opt_out', 'Confirmación de baja', 'session', 'utility', 'Listo, no te escribimos más. Si querés volver, mandá JUGAR.', 'approved')
on conflict (key) do update set body = excluded.body, purpose = excluded.purpose;

commit;
