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

Mientras la cuenta esté en el plan gratuito no hay entornos personalizados. Se resuelve así:

- Cada app es un proyecto de Vercel.
- La rama `main` publica en producción con los dominios `*.brutal.lat`.
- La rama `test` publica como vista previa, con su dominio fijo `test-*.brutal.lat` asignado a esa rama y sus variables cargadas solo para esa rama.

El plan gratuito es para uso no comercial. Antes de abrir a usuarios reales hay que pasar a Pro.

## Variables por app

Se completan a medida que cada app se porta. Los valores nunca van en este repo.
