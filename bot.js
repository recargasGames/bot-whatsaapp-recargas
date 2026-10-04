const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
app.use(express.json());

// ⚠️ CAMBIA ESTA CLAVE POR UNA TUYA!
const API_SECRET = 'pon-tu-clave-secreta-aqui-12345';

let sock;

async function conectar() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    sock = await makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;

        // ========== MOSTRAR QR BIEN GRANDE ==========
        if (qr) {
            console.log('\n');
            console.log('╔══════════════════════════════════════╗');
            console.log('║     📲 ESCANEA ESTE CÓDIGO QR        ║');
            console.log('║   con WhatsApp en tu teléfono        ║');
            console.log('╚══════════════════════════════════════╝');
            console.log('\n');
            qrcode.generate(qr, { small: false }); // false = más grande
            console.log('\n');
            console.log('═════════════════════════════════════════');
            console.log('👉 Abre WhatsApp → Dispositivos vinculados');
            console.log('═════════════════════════════════════════\n');
        }

        if (connection === 'open') {
            console.log('\n✅ ✅ ✅ BOT CONECTADO Y LISTO ✅ ✅ ✅');
            console.log('   RecargasGames 🎮 — Envío automático activo\n');
        }

        if (connection === 'close') {
            const reconectar = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`\n⚠️ Desconectado — Reintentando...`);
            if (reconectar) {
                setTimeout(conectar, 3000);
            } else {
                console.log('❌ Sesión cerrada manualmente — Borra la carpeta "auth" para escanear de nuevo');
            }
        }
    });
}

// ========== ENDPOINT PARA ENVIAR ==========
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
        let num = numero_whatsapp.replace(/\D/g, '');
        if (num.startsWith('0')) num = num.slice(1);
        if (!num.startsWith('58')) num = '58' + num;
        num += '@s.whatsapp.net';

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
        console.log(`✅ Mensaje enviado a ${numero_whatsapp} — ${producto}`);

    } catch (error) {
        console.error('❌ Error al enviar:', error);
        res.status(500).json({ error: 'No se pudo enviar: ' + error.message });
    }
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, async () => {
    console.log(`🌐 Servidor corriendo en el puerto ${PUERTO}`);
    await conectar();
});
