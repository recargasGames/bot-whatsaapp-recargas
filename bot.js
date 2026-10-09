const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '1mb' }));

const API_SECRET = process.env.BOT_TOKEN || 'recargasgames-bot-2026-secreta';

let sock;
let qrCodeData = null;
let botConectado = false;

// ========== PÁGINA CON QR ==========
app.get('/', (req, res) => {
    if (botConectado) {
        return res.send(`<html><body style="background:#1a1a1a;color:white;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;">
            <h1 style="color:#10b981;font-size:32px;">✅ BOT CONECTADO</h1>
            <p style="font-size:18px;color:#ccc;">RecargasGames — Bot de WhatsApp activo</p>
        </body></html>`);
    }
    if (!qrCodeData) {
        return res.send(`<html><body style="background:#1a1a1a;color:white;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;">
            <h1 style="color:#10b981;">✅ RecargasGames — Bot</h1>
            <h2>Esperando QR...</h2>
            <script>setTimeout(()=>location.reload(), 3000);</script>
        </body></html>`);
    }
    res.send(`<html><body style="background:#1a1a1a;color:white;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
        <h1 style="color:#10b981;font-size:28px;margin-bottom:10px;">📲 ESCANEA ESTE CÓDIGO</h1>
        <p style="font-size:18px;margin-bottom:30px;">Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
        <img src="${qrCodeData}" style="width:300px;height:300px;border-radius:12px;box-shadow:0 0 30px rgba(16,185,129,0.3);">
    </body></html>`);
});

// ========== ESTADO ==========
app.get('/estado', (req, res) => {
    res.json({ conectado: botConectado, tiene_qr: !!qrCodeData });
});

// ========== CONECTAR ==========
async function conectar() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    sock = await makeWASocket({ auth: state, printQRInTerminal: false });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr, { scale: 8 });
            botConectado = false;
            console.log('📲 QR listo — escanea en la URL de Render');
        }
        if (connection === 'open') {
            qrCodeData = null;
            botConectado = true;
            console.log('✅ BOT CONECTADO Y LISTO');
        }
        if (connection === 'close') {
            botConectado = false;
            const reconectar = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reconectar) setTimeout(conectar, 3000);
        }
    });
}

function formatearNumero(numero_whatsapp) {
    let num = String(numero_whatsapp || '').replace(/\D/g, '');
    if (num.startsWith('0')) num = num.slice(1);
    if (!num.startsWith('58')) num = '58' + num;
    return num + '@s.whatsapp.net';
}

// ========== ENDPOINT VIEJO (por compatibilidad) ==========
app.post('/enviar-producto', async (req, res) => {
    const { numero_whatsapp, producto, datos, clave_secreta } = req.body;
    if (clave_secreta !== API_SECRET) return res.status(403).json({ error: 'Clave inválida' });
    if (!sock || !botConectado) return res.status(503).json({ error: 'Bot no conectado' });
    if (!numero_whatsapp || !producto) return res.status(400).json({ error: 'Faltan datos' });
    try {
        const num = formatearNumero(numero_whatsapp);
        let mensaje = `🎉 *¡Compra confirmada!* RecargasGames 🎮\n\n📦 ${producto}\n\n${JSON.stringify(datos, null, 2)}`;
        await sock.sendMessage(num, { text: mensaje });
        res.json({ ok: true, mensaje: 'Enviado ✅' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo enviar: ' + error.message });
    }
});

// ========== 🆕 ENDPOINT NUEVO — MENSAJE LIBRE COMPLETO ==========
app.post('/enviar-mensaje-libre', async (req, res) => {
    const { numero_whatsapp, mensaje, clave_secreta } = req.body;

    if (clave_secreta !== API_SECRET) return res.status(403).json({ error: 'Clave inválida' });
    if (!sock || !botConectado) return res.status(503).json({ error: 'Bot no conectado — Escanea el QR' });
    if (!numero_whatsapp || !mensaje) return res.status(400).json({ error: 'Faltan: numero_whatsapp, mensaje' });

    try {
        const num = formatearNumero(numero_whatsapp);
        await sock.sendMessage(num, { text: mensaje });
        console.log(`✅ WhatsApp enviado a ${numero_whatsapp} (${mensaje.length} chars)`);
        res.json({ ok: true, mensaje: 'Enviado ✅' });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'No se pudo enviar: ' + error.message });
    }
});

// ========== INICIAR ==========
const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, async () => {
    console.log(`🌐 Puerto ${PUERTO}`);
    await conectar();
});
