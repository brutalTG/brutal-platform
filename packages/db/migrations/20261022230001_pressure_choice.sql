-- Dilemas: preguntas "¿A o B?" con dos opciones. La máquina entiende cuál eligió y acusa con eso.
-- claim_yes / claim_no pasan a ser la frase de la opción A y de la B.
alter table pressure.items drop constraint items_answer_type_check;
alter table pressure.items add constraint items_answer_type_check check (answer_type in ('yes_no', 'agree', 'number', 'open', 'choice'));
alter table pressure.items
  add column option_a text check (option_a is null or length(option_a) between 2 and 80),
  add column option_b text check (option_b is null or length(option_b) between 2 and 80);
alter table pressure.items add constraint items_choice_has_options
  check (answer_type <> 'choice' or (option_a is not null and option_b is not null));
