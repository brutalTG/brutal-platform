# wa-gateway

El número de WhatsApp de **AMIGOS DE MIERDA**. Es un proceso que mantiene abierta la sesión del número (como WhatsApp Web), le pasa al API cada mensaje que entra, manda lo que el API le pide y le da cuerda al reloj del juego una vez por minuto.

No usa la API oficial de Meta: no hay plantillas ni ventana de 24 horas. A cambio, va contra los términos de WhatsApp y el número se puede caer. Por eso:

- Usar un número propio del juego, con SIM, que ya tenga historia. Nunca el de WATI ni el de BRUTAL.
- Calentarlo unos días usándolo a mano antes de conectarlo.
- El bot solo le habla a quien le escribió primero, con ritmo humano (escribe, espera) y con un tope por minuto (`MAX_PER_MINUTE`, 30 por defecto).
- Si el número cae, se cambia el número en `AMIGOS_PUBLIC_NUMBER` del API y se vuelve a vincular: los grupos siguen.

## Dónde corre

Necesita estar prendido siempre: Railway, una VM chica o una compu. Vercel no sirve porque apaga los procesos entre pedidos. La sesión vive en `AUTH_DIR`, que tiene que ser un volumen persistente (si se borra, hay que volver a vincular).

```bash
docker build -f apps/wa-gateway/Dockerfile -t amigos-gateway .
docker run -v amigos-data:/data -p 8080:8080 \
  -e API_URL=https://test-api.brutal.lat \
  -e GATEWAY_SECRET=... \
  -e PAIR_PHONE=54911XXXXXXXX \
  amigos-gateway
```

## Variables

| Variable | Qué es |
| --- | --- |
| `API_URL` | El API de BRUTAL del entorno (`https://test-api.brutal.lat` o `https://api.brutal.lat`) |
| `GATEWAY_SECRET` | Secreto compartido con el API (`AMIGOS_GATEWAY_SECRET`). 32+ caracteres |
| `PAIR_PHONE` | El número del juego, solo dígitos. Si está, al arrancar pide un código de vinculación |
| `AUTH_DIR` | Carpeta de la sesión (volumen). Por defecto `./auth`; en Docker `/data/auth` |
| `TICK_SECONDS` | Cada cuánto corre el reloj del juego. 60 por defecto |
| `MAX_PER_MINUTE` | Tope de mensajes salientes por minuto. 30 por defecto |

## Vincular el número

1. Arrancar el gateway con `PAIR_PHONE`.
2. Abrir `https://<gateway>/qr?key=<GATEWAY_SECRET>`: muestra un código de 8 letras y un QR.
3. En el teléfono del juego: WhatsApp → Dispositivos vinculados → Vincular dispositivo → Vincular con número de teléfono, y poner el código. O escanear el QR.
4. La página pasa a "Conectado como …".

## Del lado del API

| Variable del API | Valor |
| --- | --- |
| `AMIGOS_WHATSAPP_MODE` | `gateway` (en test sin número: `mock`) |
| `AMIGOS_GATEWAY_URL` | La URL pública del gateway |
| `AMIGOS_GATEWAY_SECRET` | El mismo `GATEWAY_SECRET` |
| `AMIGOS_PUBLIC_NUMBER` | El número del juego, solo dígitos (arma los links `wa.me`) |
| `API_PUBLIC_URL` | La URL pública del API (WhatsApp baja las imágenes de ahí) |

## Endpoints

- `GET /health`: si está conectado. Público.
- `GET /qr?key=…`: página para vincular.
- `GET /status`: estado, colas y contadores.
- `POST /send` `{to, text?, image_url?, audio_url?}`: encola un mensaje. Lo usa el API.
- `POST /pair` `{phone}`: pide un código de vinculación nuevo.
