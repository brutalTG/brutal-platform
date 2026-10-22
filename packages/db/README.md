# db

Esquema y migraciones de Supabase. Única fuente de verdad de la base, para test y para producción.

- `migrations/`: archivos SQL, en orden, solo hacia adelante.
- Esquemas: `core` (nodos, consentimientos, links, admins), `economy` (libro de movimientos, temporadas, reclamos), `messaging` (WhatsApp), `drops`, `pressure`.

Estado: esquema en rediseño. No hay migraciones todavía.
