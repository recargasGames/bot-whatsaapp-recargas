const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();

// ⚠️ CLAVE SECRETA — Cámbiala por una tuya en producción!
const API_SECRET = 'pon-una-clave-segura-aqui-12345';

app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

// Mostrar QR para vincular
client.on('qr', qr => {
    console.log('\n=========================================');
    console.log('📲 ESCANEA ESTE QR CON TU WHATSAPP');
    console.log('=========================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\n=========================================\n');
});

client.on('ready', () => {
    console.log('\n✅ BOT CONECTADO Y LISTO — RecargasGames 🎮\n');
    console.log('Endpoint listo: POST /enviar-producto\n');
});

// ========== ENDPOINT — TU PASARELA LLAMA AQUÍ ==========
app.post('/enviar-producto', async (req, res) => {
    const { numero_whatsapp, producto, datos, clave_secreta } = req.body;

    // Verificar clave secreta
    if (clave_secreta !== API_SECRET) {
        return res.status(403).json({ error: 'Clave inválida' });
    }

    if (!numero_whatsapp || !producto) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    try {
        // Limpiar número y agregar código de país Venezuela +58
        let numeroLimpio = numero_whatsapp.replace(/\D/g, '');
        if (numeroLimpio.startsWith('0')) numeroLimpio = numeroLimpio.slice(1);
        if (!numeroLimpio.startsWith('58')) numeroLimpio = '58' + numeroLimpio;

        const id = await client.getNumberId(numeroLimpio + '@c.us');
        if (!id) {
            return res.status(404).json({ error: 'Número no tiene WhatsApp' });
        }

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

✅ ¡Disfrútalo! Gracias por confiar en nosotros.`;
        }
        else if (producto.includes('Roblox') || producto.includes('PIN')) {
            mensaje = `🎉 ¡Compra confirmada! RecargasGames 🎮

🎁 ${producto}

🔢 Código/PIN:
${datos.codigo || '---'}

✅ Canjea aquí: https://roblox.com/redeem

Gracias por tu compra! 🎮`;
        }
        else if (producto.includes('PlayStation')) {
            mensaje = `🎉 ¡Compra confirmada! RecargasGames 🎮

🎮 ${producto}

🔢 Código:
${datos.codigo || '---'}

✅ Canjea en PlayStation Store

Gracias por tu compra! 🎮`;
        }
        else {
            mensaje = `🎉 ¡Compra confirmada! RecargasGames 🎮

📦 ${producto}

📋 Datos:
${JSON.stringify(datos, null, 2)}

✅ ¡Gracias por tu compra!`;
        }

        // Enviar mensaje
        await client.sendMessage(id._serialized, mensaje);
        
        res.json({ ok: true, mensaje: 'Enviado correctamente ✅' });
        console.log(`✅ Enviado a ${numeroLimpio} — ${producto}`);

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'No se pudo enviar' });
    }
});

// Iniciar servidor
const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
    console.log(`🌐 Servidor corriendo en el puerto ${PUERTO}`);
});

client.initialize();
