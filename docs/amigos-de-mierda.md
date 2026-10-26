# AMIGOS DE MIERDA

Un juego para gente que no quiere tanto a sus amigos. Es un experimento más de BRUTAL: graba nodos y observaciones igual que Drops y Pressure.

## El juego

- Alguien le escribe al número del juego ("Quiero jugar con mi grupo"). Nombra su grupo, elige el primer dilema (o escribe el suyo), contesta, carga los nombres de sus amigos y apuesta qué va a contestar cada uno.
- El bot le devuelve una imagen y un link para pegar en el grupo. Cada amigo entra tocando su nombre, contesta y ve en el acto si el fundador lo leyó.
- Desde el día 2: a las 18 le toca preguntar a uno (rota). Elige de la biblioteca o escribe su dilema, y puede marcar una víctima. A las 21 sale a todos. Cada uno contesta, apuesta por los demás y le manda un audio de 10 segundos a su "objetivo" del día. A las 23 (o antes, si terminaron todos) llega el reveal: la grilla de quién leyó a quién. El objetivo escucha el audio y dice si lo leyó: si sí, suma.
- Tres días sin contestar: pausa automática. Temporada de 14 días: etiquetas en voz ClickHole y la tabla. OTRA arranca otra.
- SALIR corta los mensajes. BORRAME borra respuestas, apuestas y audios y excluye sus observaciones. Mayores de 18: si alguien declara menos, queda afuera.

## Dónde vive cada cosa

| Pieza | Dónde |
| --- | --- |
| Motor del juego | `apps/api/lib/amigos/` (`engine.ts`, `rules.ts`, `text.ts`), con pruebas de una temporada entera en memoria |
| Base | Esquema `amigos.*` en `packages/db/migrations/20261025180001_amigos.sql` |
| Imágenes | `apps/api/lib/amigos/images.tsx`, servidas firmadas en `/amigos/img/...` |
| Número de WhatsApp | `apps/wa-gateway` (ver su README) |
| Panel | `/amigos`: grupos, simulador, rondas, audios. `/amigos/preguntas`: biblioteca con vista previa |
| Sitio | `apps/amigos` |

## Señal que deja

En `signal.observations`, `app_slug = 'amigos'`:

| instrument_type | kind | Qué es |
| --- | --- | --- |
| `amigos_question` | choice | Lo que contestó, con latencia |
| `amigos_bet` | game_move | Lo que apostó sobre un amigo, junto a lo que contestó él mismo y lo que contestó el amigo: el par "lo que pienso / lo que creo que piensa el otro" |
| `amigos_voice` | voice / text | El audio al objetivo, con transcripción |
| `amigos_rating` | game_move | Si el objetivo dice que lo leyeron |
| `amigos_authoring` | text | Qué pregunta eligió o escribió cuando le tocó preguntar |
| `amigos_onboarding` | declared | Edad declarada |

## Para que ande en test

1. Aplicar la migración en `brutal-sandbox` y agregar `amigos` a Supabase → Data API → Exposed schemas.
2. API (test): `AMIGOS_WHATSAPP_MODE=mock` para probar desde el panel sin número. Con número: `gateway`, más `AMIGOS_GATEWAY_URL`, `AMIGOS_GATEWAY_SECRET`, `AMIGOS_PUBLIC_NUMBER` y `API_PUBLIC_URL`.
3. Gateway en Railway con un volumen (`/data`), `API_URL`, `GATEWAY_SECRET` y `PAIR_PHONE`. Vincular desde `/qr`.
4. Sitio: proyecto de Vercel `amigos` con `AMIGOS_PUBLIC_NUMBER` y `API_URL`.
