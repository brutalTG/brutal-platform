-- El texto de cada mensaje, para que el panel muestre la conversación tal cual fue.
alter table messaging.messages add column body text check (body is null or length(body) <= 4096);
