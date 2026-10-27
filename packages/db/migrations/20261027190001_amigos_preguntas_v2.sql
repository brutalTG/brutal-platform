-- Amigos de mierda: dos dilemas de la casa que quedaban bobos se cambian por situaciones que un grupo de verdad reconoce.

update amigos.questions
set prompt = 'Existe un grupo de WhatsApp de tus amigos sin vos. Te llega el link. Podés leerlo una sola vez.',
    detail = 'Después no podés hacer como que no lo leíste.',
    option_a = 'Lo leo', option_b = 'No lo abro'
where origin = 'house' and prompt = 'Podés saber con certeza si tus amigos te quieren o solo te aguantan.';

update amigos.questions
set prompt = 'Tu viejo te ofrece quedarte con la empresa familiar. Si decís que no, la vende y esa plata no te toca nunca.',
    detail = 'Si decís que sí, laburás con él todos los días hasta que se jubile. No se va a jubilar.',
    option_a = 'Me quedo con la empresa', option_b = 'Que la venda'
where origin = 'house' and prompt = 'Hay un botón. Lo apretás y tus viejos pierden todo, pero vos sos exactamente quien querés ser a los 40.';
