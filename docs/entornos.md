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

| App | Proyecto test | Dominio test | Proyecto producción |
| --- | --- | --- | --- |
| panel | `brutal-panel-test` | `test-panel.brutal.lat` | pendiente |

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
