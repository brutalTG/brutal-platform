-- Detector v2: repreguntas condicionales y frases para la acusación.
-- follow_up_when: cuándo se hace la repregunta según lo que respondió (sí/de acuerdo o no/en desacuerdo).
-- claim_yes / claim_no: lo que "dijo" el jugador, para que la máquina lo acuse con sus palabras:
-- "Mentiste cuando dijiste {claim}".
alter table pressure.items
  add column follow_up_when text not null default 'always' check (follow_up_when in ('always', 'yes', 'no')),
  add column claim_yes text check (claim_yes is null or length(claim_yes) between 3 and 120),
  add column claim_no text check (claim_no is null or length(claim_no) between 3 and 120);
