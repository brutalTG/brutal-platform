# Entornos

Dos entornos idénticos. Lo único que cambia entre ellos son los dominios, la base y las claves.

| | Producción | Test |
| --- | --- | --- |
| Rama | `main` | `test` |
| Base (Supabase) | `brutal-production` | `brutal-sandbox` |
| Dominios | `*.brutal.lat` | `test-*.brutal.lat` |
| WhatsApp | WATI, número real | Simulado desde el panel (`WHATSAPP_MODE=mock`) |
| ElevenLabs | Agentes publicados, con autenticación | Ramas de prueba de los mismos agentes |
| Datos | Reales | De prueba; se pueden borrar en cualquier momento |

## Cómo funciona en Vercel (plan gratuito)

Mientras la cuenta esté en el plan gratuito no hay entornos personalizados. Se resuelve con **un proyecto de Vercel por app y por entorno**:

- `brutal-<app>-test`: publica la rama `test` en `test-<app>.brutal.lat`, con las claves de `brutal-sandbox` y `BRUTAL_ENV=test`.
- `brutal-<app>`: publica la rama `main` en `<app>.brutal.lat`, con las claves de producción. Se crea recién cuando la app pasa a producción.

Así cada entorno tiene sus propias variables y no hay forma de que test lea claves de producción.
Las URLs `*.vercel.app` quedan detrás del login de Vercel; solo los dominios `brutal.lat` son públicos.

| App | Proyecto test | Dominio test | Proyecto producción | Dominio producción |
| --- | --- | --- | --- | --- |
| panel | `brutal-panel-test` | `test-panel.brutal.lat` | `brutal-panel` | `panel.brutal.lat` |
| api | `brutal-api-test` | `test-api.brutal.lat` | `brutal-api` | `api.brutal.lat` |
| pressure | `brutal-pressure-test` | `test-pressure.brutal.lat` | `brutal-pressure` | `pressure.brutal.lat` |
| drops | `brutal-drops-test` | `test-drops.brutal.lat` | `brutal-drops` | `drops.brutal.lat` |
| amigos | — | — | `brutal-amigos` | `amigos.brutal.lat` |

El gateway de WhatsApp de AMIGOS DE MIERDA (`apps/wa-gateway`) corre fuera de Vercel, en Render, como
Background Worker con disco en `/data`. Ver `apps/wa-gateway/README.md`.

Los proyectos de test tienen como rama de producción `main` en Vercel, así que un push a `test` arma una vista previa
que no toca el dominio. Para publicar en el dominio de test, Claude crea un despliegue de producción de la rama `test`
(o se cambia en Vercel → Settings → Git → Production Branch → `test`).

### Variables del panel

| Variable | Qué es | Quién la carga |
| --- | --- | --- |
| `BRUTAL_ENV` | `test` o `production` | Claude |
| `SUPABASE_URL` | URL de la base del entorno | Claude |
| `PANEL_SESSION_SECRET` | Firma de la sesión, aleatoria | Claude |
| `PANEL_PASSWORD` | Contraseña del panel | Nacho |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de la base | Nacho |

Además, la base tiene que exponer los esquemas en Supabase → Data API → Exposed schemas: `core, signal, profile, economy, messaging, drops, pressure`.

El plan gratuito es para uso no comercial. Antes de abrir a usuarios reales hay que pasar a Pro.

## Variables por app

Se completan a medida que cada app se porta. Los valores nunca van en este repo.

### Variables del API

| Variable | Qué es | Quién la carga |
| --- | --- | --- |
| `BRUTAL_ENV`, `SUPABASE_URL`, `PRESSURE_ORIGIN` | Entorno, base y dónde vive el juego | Claude |
| `API_SESSION_SECRET` | Firma de los tokens de partida | Claude |
| `INTERNAL_API_SECRET` | Canal panel → API (el mismo valor en el panel) | Claude |
| `WATI_WEBHOOK_SECRET` | Va en la URL del webhook que se configura en WATI | Claude |
| `WHATSAPP_MODE` | `mock` (simulado) o `wati` (real) | Claude, con OK de Nacho |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de la base | Nacho |
| `ELEVENLABS_API_KEY` | Voz y transcripción | Nacho |
| `WATI_API_ENDPOINT`, `WATI_API_TOKEN`, `WATI_CHANNEL_NUMBER` | WhatsApp | Nacho |

### Variables del juego (pressure)

`NEXT_PUBLIC_API_URL`. No tiene claves.

### Variables del reproductor (drops)

`VITE_API_URL` (la URL del API terminada en `/drops`). No tiene claves.

### Limpiar test

`packages/db/scripts/test-wipe-synthetic.sql`: borra los datos simulados y deja el contenido real del detector.
Se niega a correr si encuentra números que no son de prueba.
