-- PRESSURE · Ráfaga al tacto dentro del detector.
-- Una sección nueva de preguntas: un disparador (texto, imagen o video) y dos emojis grandes, 3 segundos.
-- Algunas vuelven al final por voz ("echo"): la diferencia entre lo que tocó y lo que dijo es señal.

alter table pressure.items drop constraint items_section_check;
alter table pressure.items add constraint items_section_check check (section in ('calibration', 'game', 'rafaga'));

alter table pressure.items drop constraint items_kind_check;
alter table pressure.items add constraint items_kind_check check (kind in ('calibration', 'obvious_lie', 'fun', 'signal', 'flash', 'trap'));

alter table pressure.items drop constraint items_check;
alter table pressure.items add constraint items_check check (section <> 'game' or kind in ('fun', 'signal'));
alter table pressure.items drop constraint items_check1;
alter table pressure.items add constraint items_check1 check (section <> 'calibration' or kind in ('calibration', 'obvious_lie'));
alter table pressure.items add constraint items_rafaga_kind check (section <> 'rafaga' or kind in ('flash', 'trap'));

alter table pressure.items
  -- Imagen o video que se ve en la ráfaga. Si no hay, se muestra el texto grande.
  add column media_url text check (media_url is null or length(media_url) <= 500),
  -- Los dos emojis. El primero equivale a "sí" (o a la opción A) cuando vuelve por voz.
  add column emoji_a text check (emoji_a is null or length(emoji_a) <= 16),
  add column emoji_b text check (emoji_b is null or length(emoji_b) <= 16),
  -- Vuelve al final por voz, con permiso para mentir.
  add column echo boolean not null default false,
  -- Solo trampas: cuál es el toque correcto.
  add column correct text check (correct is null or correct in ('a', 'b'));

alter table pressure.items add constraint items_rafaga_emojis
  check (section <> 'rafaga' or (emoji_a is not null and emoji_b is not null));
alter table pressure.items add constraint items_trap_correct
  check (kind <> 'trap' or correct is not null);
alter table pressure.items add constraint items_echo_only_flash
  check (not echo or kind = 'flash');
