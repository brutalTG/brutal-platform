-- Link de grupo: de dónde llegó cada uno (`?de=grupo1`, o `r-<código>` si se lo reenvió otro jugador)
-- y un evento nuevo, 'shared', cuando un jugador toca "pasáselo a alguien".

alter table drops.join_events add column source text check (source is null or source ~ '^[a-z0-9_-]{1,40}$');
alter table drops.join_events drop constraint join_events_event_check;
alter table drops.join_events add constraint join_events_event_check check (event in ('open', 'joined', 'shared'));
create index join_events_source_idx on drops.join_events (drop_slug, source);
