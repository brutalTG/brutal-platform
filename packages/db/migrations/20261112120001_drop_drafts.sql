-- Cambios sin publicar de un Drop en juego: el panel los guarda acá y los jugadores siguen viendo
-- la versión publicada hasta que alguien toca "Publicar cambios".
create table drops.drop_drafts (
  drop_id uuid primary key references drops.drops(id) on delete cascade,
  payload jsonb not null,
  saved_at timestamptz not null default now()
);
alter table drops.drop_drafts enable row level security;
grant all on drops.drop_drafts to service_role;
