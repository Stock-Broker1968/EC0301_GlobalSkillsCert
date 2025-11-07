// ============================================================
// Backend Generando EC0301 - Producción en Render
// Stripe + MySQL (Hostinger) + Postmark + WhatsApp Cloud API + JWT
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { ServerClient } = require('postmark');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CONFIGURACIÓN DE CORS (solo permite tu frontend)
// ============================================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://ec0301-globalskillscert.onrender.com',
  credentials: true
}));

// ============================================================
// CONEXIÓN A BASE DE DATOS MYSQL (Hostinger)
// ============================================================
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test de conexión a BD al iniciar
(async () => {
  try {
    const [rows] = await dbPool.execute('SELECT 1');
    console.log('✅ Conexión a MySQL exitosa');
  } catch (error) {
    console.error('❌ Error de conexión a MySQL:', error.message);
  }
})();

// ============================================================
// POSTMARK CLIENT (envío de emails)
// ============================================================
const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN);

// ============================================================
// WHATSAPP CLOUD API CONFIG
// ============================================================
const WHATSAPP_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ============================================================
// FUNCIÓN: Enviar mensaje por WhatsApp
// ============================================================
async function sendWhatsAppMessage(userPhone, message) {
  try {
    // Limpia el teléfono y asegura formato internacional (ej: 521XXXXXXXXXX para México)
    let toPhone = userPhone.replace(/\D/g, '');
    
    // Si el número no tiene código de país, agregar 521 (México)
    if (toPhone.length === 10) {
      toPhone = '521' + toPhone;
    }

    const payload = {
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: message }
    };

    const resp = await fetch(WHATSAPP_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`WhatsApp API error: ${errorText}`);
    }

    console.log(`✅ WhatsApp enviado correctamente a ${toPhone}`);
    return true;
  } catch (err) {
    console.error('❌ Error enviando WhatsApp:', err.message);
    return false;
  }
}

// ============================================================
// FUNCIÓN: Enviar email con Postmark
// ============================================================
async function sendEmailWithPostmark(email, subject, textBody) {
  try {
    await postmarkClient.sendEmail({
      "From": process.env.POSTMARK_FROM_EMAIL,
      "To": email,
      "Subject": subject,
      "TextBody": textBody
    });
    console.log(`✅ Email enviado correctamente a ${email}`);
    return true;
  } catch (err) {
    console.error('❌ Error enviando email con Postmark:', err.message);
    return false;
  }
}

// ============================================================
// ENDPOINT: Raíz (verificación de salud del servidor)
// ============================================================
app.get('/', (req, res) => {
  res.send('¡Backend Generando EC v1.2 está funcionando! ✅ Stripe + MySQL + Postmark + WhatsApp Cloud API');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// STRIPE WEBHOOK (debe ir ANTES del middleware express.json)
// ============================================================
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log(`✅ Webhook verificado: ${event.type}`);
  } catch (err) {
    console.error(`❌ Error verificación webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // === MANEJO DEL EVENTO: Pago completado ===
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`🛒 Pago completado para sesión: ${session.id}`);

    try {
      const customerDetails = session.customer_details || {};
      const email = customerDetails.email;
      const phone = customerDetails.phone;
      const customerName = customerDetails.name || 'Usuario';

      if (!email) {
        throw new Error('No se proporcionó email en el pago.');
      }

      // Generar código de acceso de 6 dígitos
      const accessCode = Math.random().toString().substring(2, 8);
      const hashedCode = await bcrypt.hash(accessCode, 10);

      // Guardar en base de datos
      const [dbResult] = await dbPool.execute(
        `INSERT INTO access_codes (code_hash, email, phone, stripe_session_id, expires_at, created_at) 
         VALUES (?, ?, ?, ?, NOW() + INTERVAL 30 DAY, NOW())`,
        [hashedCode, email, phone, session.id]
      );
      console.log(`   ✅ Código guardado en BD con ID: ${dbResult.insertId}`);

      // Enviar por EMAIL
      const emailSubject = '🎉 Tu código de acceso a SkillsCert EC0301';
      const emailBody = `Hola ${customerName},\n\n¡Gracias por tu pago!\n\nTu código de acceso a la plataforma Generando EC0301 es:\n\n${accessCode}\n\nEste código es válido por 30 días.\n\nIngresa en: ${process.env.FRONTEND_URL}\n\n¡Éxito en tu certificación!\n\nEquipo SkillsCert`;
      
      await sendEmailWithPostmark(email, emailSubject, emailBody);

      // Enviar por WHATSAPP (si hay teléfono)
      if (phone) {
        const whatsappMessage = `¡Hola ${customerName}! 🎉\n\nGracias por tu pago. Tu código de acceso a la plataforma Generando EC0301 es:\n\n*${accessCode}*\n\nVálido por 30 días.\nIngresa en: ${process.env.FRONTEND_URL}\n\n¡Éxito! 🚀`;
        await sendWhatsAppMessage(phone, whatsappMessage);
      }

      console.log(`   ✅ Notificaciones enviadas exitosamente`);

    } catch (error) {
      console.error(`❌ Error en lógica post-pago para sesión ${session.id}:`, error);
      
      // Notificar al admin por email en caso de error crítico
      try {
        await sendEmailWithPostmark(
          process.env.POSTMARK_ALERT_EMAIL,
          '⚠️ Error en webhook de pago',
          `Error procesando pago de sesión ${session.id}:\n\n${error.message}\n\nStack:\n${error.stack}`
        );
      } catch (alertError) {
        console.error('❌ No se pudo enviar alerta al admin:', alertError.message);
      }
    }
  }

  res.status(200).json({ received: true });
});

// ============================================================
// MIDDLEWARE JSON (después del webhook)
// ============================================================
app.use(express.json());

// ============================================================
// ENDPOINT: Crear sesión de pago en Stripe
// ============================================================
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'oxxo'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: { 
            name: 'Acceso Plataforma Generando EC0301',
            description: 'Acceso completo por 30 días a materiales, evaluaciones y certificación'
          },
          unit_amount: 50000, // $500.00 MXN
        },
        quantity: 1,
      }],
      mode: 'payment',
      billing_address_collection: 'required',
      customer_creation: 'always',
      customer_email: req.body.email || null,
      phone_number_collection: { enabled: true },
      success_url: `${process.env.FRONTEND_URL}/success.html`,
      cancel_url: `${process.env.FRONTEND_URL}/index.html`,
      payment_method_options: { 
        oxxo: { expires_after_days: 3 }
      }
    });

    console.log(`✅ Sesión de Checkout creada: ${session.id}`);
    res.json({ id: session.id });

  } catch (error) {
    console.error("❌ Error creando sesión de Stripe:", error);
    res.status(500).json({ error: 'No se pudo iniciar el proceso de pago.' });
  }
});

// ============================================================
// RUTAS DE AUTENTICACIÓN CON JWT
// ============================================================
const authRouter = express.Router();
app.use('/api/auth', authRouter);

// --- Login con código de acceso ---
authRouter.post('/login-code', async (req, res) => {
  const { accessCode } = req.body;

  if (!accessCode) {
    return res.status(400).json({ error: 'Código de acceso requerido.' });
  }

  try {
    // Buscar códigos válidos (no usados y no expirados)
    const [rows] = await dbPool.execute(
      'SELECT * FROM access_codes WHERE is_used = 0 AND expires_at > NOW()',
      []
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Código inválido o expirado.' });
    }

    let validCodeMatch = null;

    // Comparar el código ingresado con los hashes
    for (const row of rows) {
      const isMatch = await bcrypt.compare(accessCode, row.code_hash);
      if (isMatch) {
        validCodeMatch = row;
        break;
      }
    }

    if (!validCodeMatch) {
      return res.status(401).json({ error: 'Código inválido o expirado.' });
    }

    // Marcar código como usado
    await dbPool.execute(
      'UPDATE access_codes SET is_used = 1, used_at = NOW() WHERE id = ?',
      [validCodeMatch.id]
    );

    // Crear token JWT
    const token = jwt.sign(
      {
        id: validCodeMatch.id,
        email: validCodeMatch.email,
        phone: validCodeMatch.phone
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log(`✅ Login exitoso para: ${validCodeMatch.email}`);
    res.status(200).json({ 
      message: 'Inicio de sesión exitoso.', 
      token,
      user: {
        email: validCodeMatch.email,
        phone: validCodeMatch.phone
      }
    });

  } catch (error) {
    console.error("❌ Error en /login-code:", error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
  console.log(`📧 Postmark configurado`);
  console.log(`📱 WhatsApp Cloud API configurado`);
  console.log(`💳 Stripe configurado`);
  console.log(`🗄️  MySQL configurado`);
});
