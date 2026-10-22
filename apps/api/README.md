# api

API central en `api.brutal.lat`. Única pieza que escribe en `core`, `economy` y `messaging`.

Origen: `server/` de `brutal-production` (rama `agent/panel-test-access`), Hono. Se porta a Vercel. El limpiador de memoria del limitador de pedidos se reemplaza por el firewall de Vercel o un límite guardado en la base.
