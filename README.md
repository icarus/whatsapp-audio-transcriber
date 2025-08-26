### Un bot para transcribir audios en WhatsApp, áutomaticamente y en cualquier dispositivo.
¿Cuántas veces has tenido que pausar la música o sacarte los audífonos para escuchar un audio? Este bot resuelve eso: transcribe cualquier audio y te manda el texto por privado, déjalo corriendo y lo hará por siempre y en cualquier dispositivo.

## Setup
```bash
git clone <repo-url>
cd whatsapp-audio-transcriber
npm install
cp .env.example .env
# Editar .env con tu API key de OpenAI y número
npm run pm2:start
```

Escanear código QR y listo.

## Variables de entorno
```env
OPENAI_API_KEY=sk-proj-tu-api-key
MY_PHONE_NUMBER=569xxxxxxxx@c.us
```

## Comandos
- `npm run pm2:start` - Iniciar bot
- `npm run pm2:logs` - Ver logs
- `npm run health` - Check de salud
- `!ping` (por WhatsApp) - Test del bot

## Monitoreo
El bot incluye auto-recovery para conexiones caídas y health checks cada 10 minutos. Si se cuelga, se reinicia solo.

## Cómo funciona
El bot escucha audios de WhatsApp, los manda a OpenAI Whisper y te envía la transcripción al privado.
