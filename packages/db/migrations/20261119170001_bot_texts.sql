-- Textos del bot editables desde el panel (Mensajes). Las variables entre llaves se completan solas
-- con lo que esté cargado en el Drop en juego (premio, fecha, tickets por chance) y con los datos del jugador.
insert into messaging.templates (key, purpose, provider_name, category, body, status) values
('drops_pitch', 'Respuesta a JUGAR (o cualquier mensaje) de alguien que todavía no hizo el onboarding', 'brutal_drops_pitch', 'utility',
$t$BRUTAL: preguntas random, caos y dilemas. Son unos minutos.
Cada respuesta suma Golden Tickets 🎟 y {tickets_por_chance} tickets = 1 chance en el sorteo de {premio} (sorteo el {fecha}).

Arrancá acá (primero cuatro datos, un minuto):
{link}

El link es tuyo, no lo pases. Para no recibir más mensajes, escribí BAJA.$t$, 'approved'),
('drops_pitch_ready', 'Respuesta a JUGAR de alguien que ya hizo el onboarding', 'brutal_drops_pitch_ready', 'utility',
$t$BRUTAL: preguntas random, caos y dilemas. Son unos minutos.
Cada respuesta suma Golden Tickets 🎟 y {tickets_por_chance} tickets = 1 chance en el sorteo de {premio} (sorteo el {fecha}).

Tu Drop te está esperando:
{link}

El link es tuyo, no lo pases. Para no recibir más mensajes, escribí BAJA.$t$, 'approved'),
('web_claim_ok', 'Respuesta al reclamar los tickets desde la pantalla final', 'brutal_web_claim_ok', 'utility',
$t$Listo, {nombre}. Tus tickets están a tu nombre.

Tenés {tickets} Golden Tickets 🎟 ({chances} chances).
Premio: {premio}. Sorteo el {fecha}.
{tickets_por_chance} tickets = 1 chance. Al ganador le avisamos por acá, por WhatsApp.

¿Querés más chances? Por cada amigo que juegue el Drop desde tu link sumás +{tickets_por_amigo} tickets:
{link_invitar}

Para no recibir más mensajes, escribí BAJA.$t$, 'approved'),
('web_claim_played', 'Reclamo de un número que ya había jugado este Drop', 'brutal_web_claim_played', 'utility',
$t$Ese número ya había jugado este Drop, así que los tickets de esta partida no se suman.$t$, 'approved'),
('web_claim_used', 'Reclamo con un código que ya usó otro número', 'brutal_web_claim_used', 'utility',
$t$Ese código ya lo reclamó otro número. Si es un error, escribinos acá.$t$, 'approved')
on conflict (key) do nothing;
