-- Pantalla final con premio, tier list para ordenar y onboarding sin redes (11 nov 2026).
begin;
update core.apps set config = jsonb_set(config #- '{onboarding,platforms}', '{onboarding,intro,subtitle}', '"Cuatro datos para empezar. Después te conocemos jugando."')
where slug = 'drops';
insert into drops.questions (format, label, content, card_type, timer_s, status, tags, reward_cash_usd, reward_tickets)
select 'ranking', 'tribu-03-tier-ranking', $j${"text": "Armá tu tier list: arriba lo que más te gusta, abajo lo que menos", "options": ["Trap", "Cumbia", "RKT", "Rock nacional", "Indie", "Folklore", "Pop", "Electrónica"]}$j$::jsonb, 'culture', 60, 'active',
  array['tribu','politica-cultura','nucleo','tier-list','musica','ranking'], 0, 30
where not exists (select 1 from drops.questions where label = 'tribu-03-tier-ranking');
update drops.drop_questions dq set question_id = (select id from drops.questions where label = 'tribu-03-tier-ranking')
from drops.drops d where d.id = dq.drop_id and d.slug = 'tribu'
  and dq.question_id = (select id from drops.questions where label = 'tribu-03-tier-musica');
update drops.drops set config = jsonb_set(config, '{reveal,prize}',
  '{"title": "LOLLAPALOOZA", "lines": ["1 FULL PASS", "2 DAY PASS"], "drawDate": "10-12-26", "ticketsPerChance": 100}'::jsonb)
where slug = 'tribu';
select d.slug, q.label, q.format, dq.position from drops.drop_questions dq join drops.drops d on d.id = dq.drop_id join drops.questions q on q.id = dq.question_id
where d.slug = 'tribu' and dq.position between 2 and 4 order by dq.position;
commit;
