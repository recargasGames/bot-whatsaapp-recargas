const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();

const API_SECRET = 'pon-tu-clave-secreta-aqui-12345';

app.use(express.json());

// ✅ Configuración para Render SIN necesitar Chrome
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ],
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});

client.on('qr', qr => {
    console.log('\n📲 ESCANEA ESTE QR CON WHATSAPP:\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n✅ BOT CONECTADO — RecargasGames 🎮\n');
});

// ========== ENDPOINT PARA ENVIAR PRODUCTOS ==========
app.post('/enviar-producto', async (req, res) => {
    const { numero_whatsapp, producto, datos, clave_secreta } = req.body;

    if (clave_secreta !== API_SECRET) {
        return res.status(403).json({ error: 'Clave inválida' });
    }

    if (!numero_whatsapp || !producto) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    try {
        let numeroLimpio = numero_whatsapp.replace(/\D/g, '');
        if (numeroLimpio.startsWith('0')) numeroLimpio = numeroLimpio.slice(1);
        if (!numeroLimpio.startsWith('58')) numeroLimpio = '58' + numeroLimpio;

        const id = await client.getNumberId(numeroLimpio + '@c.us');
        if (!id) {
            return res.status(404).json({ error: 'Número no tiene WhatsApp' });
        }

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

        await client.sendMessage(id._serialized, mensaje);
        res.json({ ok: true, mensaje: 'Enviado ✅' });
        console.log(`✅ Enviado a ${numeroLimpio}`);

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'No se pudo enviar' });
    }
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
    console.log(`🌐 Servidor en puerto ${PUERTO}`);
});

client.initialize();
