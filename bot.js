const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
app.use(express.json());

const API_SECRET = 'pon-tu-clave-secreta-aqui-12345'; // Cámbiala!

let sock; // Conexión global

// ========== CONECTAR WHATSAPP ==========
async function conectar() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    sock = await makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log('\n📲 ESCANEA ESTE QR CON WHATSAPP:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('\n✅ BOT CONECTADO Y LISTO — RecargasGames 🎮\n');
        }

        if (connection === 'close') {
            const reconectar = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reconectar) conectar();
        }
    });
}

// ========== ENDPOINT — TU PASARELA LLAMA AQUÍ ==========
app.post('/enviar-producto', async (req, res) => {
    const { numero_whatsapp, producto, datos, clave_secreta } = req.body;

    if (clave_secreta !== API_SECRET) {
        return res.status(403).json({ error: 'Clave inválida' });
    }
    if (!sock) {
        return res.status(503).json({ error: 'Bot no conectado' });
    }
    if (!numero_whatsapp || !producto) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    try {
        // Limpiar número → formato Venezuela +58
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

        // Enviar mensaje
        await sock.sendMessage(num, { text: mensaje });
        res.json({ ok: true, mensaje: 'Enviado ✅' });
        console.log(`✅ Enviado a ${numero_whatsapp}`);

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'No se pudo enviar' });
    }
});

// Iniciar todo
const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, async () => {
    console.log(`🌐 Servidor en puerto ${PUERTO}`);
    await conectar();
});
