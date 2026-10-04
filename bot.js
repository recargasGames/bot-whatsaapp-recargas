const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');

const app = express();

// ✅ CORS — PERMITE QUE TU PÁGINA SE CONECTE
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// ⚠️ CAMBIA ESTA CLAVE POR UNA TUYA!
const API_SECRET = 'pon-tu-clave-secreta-aqui-12345';

let sock;
let qrCodeData = null;

// ========== PÁGINA CON QR VISUAL ==========
app.get('/', (req, res) => {
    if (!qrCodeData) {
        return res.send(`
            <html>
            <body style="background:#1a1a1a;color:white;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
                <h1 style="color:#10b981;">✅ RecargasGames — Bot de WhatsApp</h1>
                <h2>Esperando código QR...</h2>
                <p>Recarga la página en unos segundos</p>
                <script>setTimeout(()=>location.reload(), 3000);</script>
            </body>
            </html>
        `);
    }
    
    res.send(`
        <html>
        <body style="background:#1a1a1a;color:white;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
            <h1 style="color:#10b981;font-size:28px;margin-bottom:10px;">📲 ESCANEA ESTE CÓDIGO</h1>
            <p style="font-size:18px;margin-bottom:30px;">Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
            <img src="${qrCodeData}" style="width:300px;height:300px;border-radius:12px;box-shadow:0 0 30px rgba(16,185,129,0.3);">
            <p style="margin-top:30px;color:#888;">Escanea con la cámara de tu teléfono</p>
        </body>
        </html>
    `);
});

// ========== CONECTAR WHATSAPP ==========
async function conectar() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    sock = await makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr, { scale: 8 });
            console.log('\n' + '═'.repeat(55));
            console.log('📲 ENTRA A TU PÁGINA PARA ESCANEAR EL QR:');
            console.log('👉 ' + (process.env.RENDER_EXTERNAL_URL || 'Tu URL en Render') + '\n');
            console.log('═'.repeat(55) + '\n');
        }

        if (connection === 'open') {
            qrCodeData = null;
            console.log('\n✅ ✅ ✅ BOT CONECTADO Y LISTO ✅ ✅ ✅');
            console.log('   RecargasGames 🎮 — Envío automático activo\n');
        }

        if (connection === 'close') {
            const reconectar = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('\n⚠️ Desconectado — ' + (reconectar ? 'Reintentando...' : 'Sesión cerrada\n'));
            if (reconectar) setTimeout(conectar, 3000);
        }
    });
}

// ========== ENDPOINT — ENVIAR MENSAJE ==========
app.post('/enviar-producto', async (req, res) => {
    const { numero_whatsapp, producto, datos, clave_secreta } = req.body;

    if (clave_secreta !== API_SECRET) {
        return res.status(403).json({ error: 'Clave inválida' });
    }
    if (!sock) {
        return res.status(503).json({ error: 'Bot no conectado — Escanea el QR primero' });
    }
    if (!numero_whatsapp || !producto) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    try {
        // Formatear número a Venezuela +58
        let num = numero_whatsapp.replace(/\D/g, '');
        if (num.startsWith('0')) num = num.slice(1);
        if (!num.startsWith('58')) num = '58' + num;
        num += '@s.whatsapp.net';

        // Mensaje según producto
        let mensaje = '';
        if (producto.includes('Netflix')) {
            mensaje = `🎉 ¡Compra confirmada! RecargasGames 🎮

📺 NETFLIX — ${producto}

🔑 Cuenta: ${datos.cuenta || '---'}
🔐 Contraseña: ${datos.clave || '---'}
📅 Vencimiento: ${datos.vencimiento || '30 días'}

✅ ¡Disfrútalo! Gracias por confiar en nosotros.`;
        }
        else if (producto.includes('Disney')) {
            mensaje = `🎉 ¡Compra confirmada! RecargasGames 🎮

✨ DISNEY+ — ${producto}

🔑 Cuenta: ${datos.cuenta || '---'}
🔐 Contraseña: ${datos.clave || '---'}
📅 Vencimiento: ${datos.vencimiento || '30 días'}

✅ ¡Disfrútalo!`;
        }
        else if (producto.includes('Roblox') || producto.includes('PIN')) {
            mensaje = `🎉 ¡Compra confirmada! RecargasGames 🎮

🎁 ${producto}

🔢 Código:
${datos.codigo || '---'}

✅ Canjea en: https://roblox.com/redeem

Gracias por tu compra! 🎮`;
        }
        else {
            mensaje = `🎉 ¡Compra confirmada! RecargasGames 🎮

📦 ${producto}

${JSON.stringify(datos, null, 2)}

✅ ¡Gracias por tu compra!`;
        }

        await sock.sendMessage(num, { text: mensaje });
        res.json({ ok: true, mensaje: 'Enviado correctamente ✅' });
        console.log(`✅ Enviado a ${numero_whatsapp} — ${producto}`);

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'No se pudo enviar: ' + error.message });
    }
});

// ========== INICIAR SERVIDOR ==========
const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, async () => {
    console.log(`🌐 Servidor corriendo en el puerto ${PUERTO}`);
    await conectar();
});
