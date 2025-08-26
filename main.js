require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MY_PHONE_NUMBER = process.env.MY_PHONE_NUMBER;

// Validate required environment variables
if (!OPENAI_API_KEY) {
    console.error('❌ ERROR: OPENAI_API_KEY environment variable is required');
    console.error('💡 Please set OPENAI_API_KEY in your .env file');
    process.exit(1);
}

if (!MY_PHONE_NUMBER) {
    console.error('❌ ERROR: MY_PHONE_NUMBER environment variable is required');
    console.error('💡 Please set MY_PHONE_NUMBER in your .env file (format: 569XXXXXXXX@c.us)');
    process.exit(1);
}

console.log('🤖 Usando OpenAI Whisper API');

console.log('🎵→📝 Transcriptor de Audio de WhatsApp iniciando...');

// Health monitoring
let lastMessageTime = Date.now();
let isClientReady = false;

// Health check interval
setInterval(async () => {
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime;
    const status = isClientReady ? '🟢 READY' : '🟡 NOT_READY';
    console.log(`❤️ Health Check - Status: ${status}, Last activity: ${Math.round(timeSinceLastMessage/1000/60)}m ago`);
    
    // If no activity for more than 2 hours and client should be ready, log warning
    if (isClientReady && timeSinceLastMessage > 2 * 60 * 60 * 1000) {
        console.log('⚠️ WARNING: No activity for over 2 hours. Connection might be stale.');
    }
    
    // If bot has been NOT_READY for more than 30 minutes, force restart
    if (!isClientReady && timeSinceLastMessage > 30 * 60 * 1000) {
        console.log('🚨 CRITICAL: Bot has been NOT_READY for over 30 minutes - forcing process restart');
        setTimeout(() => {
            console.log('🔄 Force restarting process due to prolonged NOT_READY state...');
            process.exit(1); // PM2 will restart
        }, 2000);
    }
    
    // Periodic connectivity test
    if (isClientReady) {
        try {
            const state = await client.getState();
            console.log(`🔗 Connection state: ${state}`);
            if (state !== 'CONNECTED') {
                console.log('⚠️ WARNING: Client not in CONNECTED state. Might need restart.');
            }
        } catch (error) {
            console.error('❌ Error checking connection state:', error.message);
            console.log('🔄 Connection seems broken, marking as not ready');
            isClientReady = false;
            
            // Auto-recover from session closed errors
            if (error.message.includes('Session closed') || error.message.includes('Protocol error')) {
                console.log('🚨 Detected browser session closed - attempting automatic recovery');
                setTimeout(() => {
                    console.log('🔄 Starting recovery process...');
                    console.log('⚠️ This recovery will restart the entire PM2 process for a clean slate');
                    // Instead of trying to reinitialize the same client, restart the entire process
                    process.exit(1); // PM2 will automatically restart the process
                }, 5000);
            }
        }
    }
}, 10 * 60 * 1000); // Every 10 minutes for more frequent monitoring

client.on('ready', () => {
    console.log('✅ Cliente listo!');
    console.log('🎧 Escuchando mensajes de voz para transcribir...');
    isClientReady = true;
    lastMessageTime = Date.now();
});

client.on('qr', qr => {
    console.log('📱 Escanea este código QR con tu teléfono');
    qrcode.generate(qr, {small: true});
});

// Add comprehensive error handlers
client.on('auth_failure', msg => {
    console.error('❌ Autenticación falló', msg);
    process.exit(1);
});

client.on('disconnected', (reason) => {
    console.log('❌ Cliente desconectado:', reason);
    console.log('📊 Disconnect details:', {
        reason: reason,
        timestamp: new Date().toISOString(),
        wasReady: isClientReady,
        timeSinceLastMessage: Date.now() - lastMessageTime
    });
    
    isClientReady = false;
    
    if (reason === 'NAVIGATION') {
        console.log('🔄 Reintentando conexión...');
        setTimeout(() => {
            console.log('🔄 Reinicializando cliente...');
            client.initialize();
        }, 5000);
    } else {
        console.log('🔄 Reinicio automático por desconexión inesperada...');
        setTimeout(() => {
            console.log('🔄 Reinicializando cliente...');
            client.initialize();
        }, 10000);
    }
});

// Additional WhatsApp client event monitoring
client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Loading: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
    console.log('🔐 Cliente autenticado exitosamente');
});

client.on('authentication_failure', (msg) => {
    console.error('🔐❌ Fallo de autenticación:', msg);
});

client.on('change_state', (state) => {
    console.log('🔄 Estado cambiado:', state);
});

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    console.error('Client ready state:', isClientReady);
    console.error('Last message time:', new Date(lastMessageTime).toISOString());
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    console.error('Client ready state:', isClientReady);
    console.error('Last message time:', new Date(lastMessageTime).toISOString());
});

// Listen to all incoming messages
client.on('message_create', async message => {
    try {
        // Log all messages for debugging and update health monitoring
        console.log(`📩 Mensaje de ${message.from} ${message.body || '[media]'}`);
        lastMessageTime = Date.now();

        // Skip muted group chats
        if (message.from.includes('@g.us')) {
            const chat = await message.getChat();
            if (chat.isMuted) {
                console.log('🔇 Grupo silenciado, ignorando mensaje');
                return;
            }
        }

        // Debug media messages
        if (message.hasMedia) {
            console.log(`🔍 Media detectado - Tipo: ${message.type}, hasMedia: ${message.hasMedia}`);
            
            // Add timeout wrapper for media processing
            const processMediaWithTimeout = async () => {
                return Promise.race([
                    processMedia(message),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Media processing timeout')), 30000)
                    )
                ]);
            };
            
            try {
                await processMediaWithTimeout();
            } catch (error) {
                console.error('❌ Error procesando media:', error.message);
                return;
            }
        }

        // Test command
        if (message.body === '!ping') {
            await message.reply('🏓 pong');
        }

        // Help command
        if (message.body === '!help') {
            await message.reply('📱 Mandame un audio y te lo paso a texto!\n\n🏓 Comandos:\n• `!ping` - Pruébame\n• `!help` - Muestra este mensaje');
        }

    } catch (error) {
        console.error('❌ Error en manejador de mensajes', error.message);
        console.error('Stack trace:', error.stack);
    }
});

// Extract media processing to separate function
async function processMedia(message) {
    try {

        // Skip non-audio media types early (especially stickers)
        if (message.type !== 'ptt' && message.type !== 'audio') {
            console.log(`⏭️ Saltando media tipo: ${message.type}`);
            return;
        }

        console.log('⬇️ Descargando media...');
        // Get media to check mimetype for voice messages with error handling
        let media;
        try {
            media = await message.downloadMedia();
        } catch (downloadError) {
            console.error('❌ Error descargando media:', downloadError.message);
            throw new Error(`Error descargando media: ${downloadError.message}`);
        }

        // Check if media download failed
        if (!media || !media.mimetype) {
            console.log('⏭️ Media no disponible o sin mimetype');
            return;
        }

        console.log(`🔍 Media mimetype: ${media.mimetype}`);

        // Check if it's a voice message by mimetype or type
        const isVoiceMessage = message.type === 'ptt' ||
                             media.mimetype.includes('audio/ogg') ||
                             media.mimetype.includes('audio/mpeg') ||
                             media.mimetype.includes('audio/mp4');

        if (isVoiceMessage) {
            console.log('🎤 Mensaje de voz detectado!');
            console.log(`   De ${message.from}`);
            console.log(`   Tipo ${message.type}`);
            console.log(`   Mimetype: ${media.mimetype}`);

            try {
                console.log('✅ Mensaje de voz descargado exitosamente');
                console.log(`   Tamaño ${media.data.length} caracteres (base64)`);

                // Convert base64 to buffer and save temporarily
                const audioBuffer = Buffer.from(media.data, 'base64');
                const tempFile = `temp_audio_${Date.now()}.mp3`;

                console.log(`💾 Guardando archivo temporal ${tempFile}`);
                fs.writeFileSync(tempFile, audioBuffer);

                console.log('🔄 Enviando a OpenAI Whisper para transcripción...');

                // Transcribe using OpenAI Whisper
                const transcript = await transcribeOpenAI(tempFile);

                if (transcript && transcript.trim()) {
                    console.log(`📝 Transcripción exitosa "${transcript}"`);

                    // Send transcript privately to your number instead of replying
                    const chat = await client.getChatById(MY_PHONE_NUMBER);
                    const contact = await message.getContact();
                    console.log('📞 Contact info:', {
                        pushname: contact.pushname,
                        name: contact.name,
                        from: message.from,
                        isMyContact: contact.isMyContact
                    });
                    const contactName = contact.name || contact.pushname || message.from;
                    console.log('📝 Using contact name:', contactName);
                    await chat.sendMessage(`*Audio de ${contactName}*\n\n_"${transcript}"_`);
                    console.log('✅ Transcripción privada enviada!');

                } else {
                    console.log('❌ Transcripción vacía o no recibida');
                    await message.reply('❌ Ups no se pudo traducir');
                }

                // Clean up temp file
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                    console.log('🗑️ Archivo temporal limpiado');
                }

            } catch (voiceError) {
                console.error('❌ Error procesando mensaje de voz:', voiceError.message);
                console.error('Voice error stack:', voiceError.stack);
                try {
                    await message.reply('❌ Error procesando mensaje de voz');
                } catch (replyError) {
                    console.error('❌ Error enviando respuesta de error:', replyError.message);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error en processMedia:', error.message);
        throw error;
    }
}


// Function to transcribe audio using OpenAI Whisper
async function transcribeOpenAI(filePath) {
    try {
        console.log(`🔊 Iniciando transcripción para ${filePath}`);

        const form = new FormData();
        form.append('model', 'whisper-1');
        form.append('file', fs.createReadStream(filePath));
        form.append('response_format', 'text');

        const response = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                },
                timeout: 30000 // 30 second timeout
            }
        );

        const transcript = response.data.trim();
        console.log(`✅ Respuesta de Whisper API "${transcript}"`);

        return transcript;

    } catch (error) {
        console.error('❌ Error de Whisper API', error.response?.data || error.message);
        throw new Error(`Transcripción falló ${error.message}`);
    }
}


// Initialize the client
client.initialize();
