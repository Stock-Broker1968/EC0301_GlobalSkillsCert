require('dotenv').config(); // Cargar las variables de entorno
const express = require('express');
const fetch = require('node-fetch');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Stripe API
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CORS - Asegúrate de que el frontend se conecta correctamente
// ============================================
const allowedOrigin = 'https://ec0301-globalskillscert.onrender.com'; // URL del frontend
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'stripe-signature'],
  credentials: true
}));

// ============================================
// MYSQL POOL - Conexión a la base de datos
// ============================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});

async function checkDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL conectado');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error MySQL:', error.message);
    return false;
  }
}

// ============================================
// Enviar mensaje de WhatsApp usando Meta API
// ============================================
async function sendWhatsAppMessage(phone, code) {
  const body = {
    messaging_product: "whatsapp",
    to: phone, // El teléfono del usuario
    text: { body: `Tu código de acceso para SkillsCert EC0301 es: ${code}` }
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v13.0/${process.env.PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (data.error) {
      console.error('Error al enviar el mensaje de WhatsApp:', data.error);
    } else {
      console.log('Mensaje de WhatsApp enviado correctamente:', data);
    }
  } catch (error) {
    console.error('Error al enviar mensaje por WhatsApp:', error);
  }
}

// ============================================
// Enviar correo usando Postmark
// ============================================
async function sendEmailCode(email, code) {
  const body = {
    From: 'info@skillscert.com', // Dirección de correo del remitente
    To: email, // Dirección de correo del destinatario
    Subject: 'Tu Código de Acceso a SkillsCert EC0301',
    TextBody: `Tu código de acceso para SkillsCert EC0301 es: ${code}`,
    HtmlBody: `<p>Tu código de acceso para SkillsCert EC0301 es: <strong>${code}</strong></p>`
  };

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.POSTMARK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (data.ErrorCode) {
      console.error('Error al enviar el correo:', data.Message);
    } else {
      console.log('Correo enviado correctamente:', data);
    }
  } catch (error) {
    console.error('Error al enviar el correo:', error);
  }
}

// ============================================
// Generar código de acceso
// ============================================
function generarCodigoAcceso() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// Guardar usuario y código en base de datos
// ============================================
async function guardarUsuarioYCodigo(email, nombre, telefono, codigo, stripeSessionId, monto, ipAddress) {
  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.execute('SELECT id FROM usuarios WHERE email = ?', [email]);

    let usuarioId;
    if (existing.length > 0) {
      usuarioId = existing[0].id;
      await conn.execute(
        `UPDATE usuarios 
         SET codigo_acceso = ?,
             nombre = COALESCE(?, nombre),
             telefono = COALESCE(?, telefono),
             stripe_session_id = ?,
             payment_status = 'paid',
             monto_pagado = monto_pagado + ?,
             fecha_pago = NOW(),
             fecha_expiracion = DATE_ADD(NOW(), INTERVAL 90 DAY),
             activo = 1
         WHERE id = ?`,
        [codigo, nombre, telefono, stripeSessionId, monto, usuarioId]
      );
    } else {
      const [result] = await conn.execute(
        `INSERT INTO usuarios 
         (email, nombre, telefono, codigo_acceso, stripe_session_id, payment_status, monto_pagado, moneda, fecha_pago, fecha_expiracion, fecha_registro, activo, ip_registro)
         VALUES (?, ?, ?, ?, ?, 'paid', ?, 'MXN', NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), NOW(), 1, ?)`,
        [email, nombre, telefono, codigo, stripeSessionId, monto, ipAddress]
      );
      usuarioId = result.insertId;
    }

    // Registrar el código en histórico
    await conn.execute(
      'INSERT INTO codigos_acceso_historico (usuario_id, email, codigo, usado, fecha_generacion, fecha_primer_uso, origen, ip_generacion, activo) VALUES (?, ?, ?, 1, NOW(), NOW(), ?, ?, 1)',
      [usuarioId, email, codigo, 'stripe_payment', ipAddress]
    );

    return usuarioId;
  } finally {
    conn.release();
  }
}

// ============================================
// Procesar pago completado desde webhook de Stripe
// ============================================
async function procesarPagoCompletado(session, ip) {
  const email = session.customer_details.email;
  const nombre = session.metadata?.nombre || session.customer_details.name || 'Usuario';
  const telefono = session.metadata?.telefono || session.customer_details.phone;
  const codigo = generarCodigoAcceso();
  const monto = session.amount_total / 100; // Convertir de centavos a pesos

  console.log('Procesando pago para:', email);

  const usuarioId = await guardarUsuarioYCodigo(email, nombre, telefono, codigo, session.id, monto, ip);

  await logActividad(usuarioId, email, 'pago', `Pago completado: ${session.id}`, ip);

  await sendEmailCode(email, codigo); // Enviar código por email
  await sendWhatsAppMessage(telefono, codigo); // Enviar código por WhatsApp

  console.log('✅ Pago procesado. Código:', codigo);
  return { usuarioId, email, codigo };
}

// ============================================
// Webhook de Stripe
// ============================================
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Webhook verificado:', event.type);
  } catch (err) {
    console.error('❌ Error verificando webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('💳 Pago completado (webhook):', session.id);
    try {
      await procesarPagoCompletado(session, req.ip);
    } catch (error) {
      console.error('Error procesando pago (webhook):', error.message);
    }
  }

  res.json({ received: true });
});

// ============================================
// Crear sesión de pago
// ============================================
app.post('/create-checkout-session', async (req, res) => {
  const { email, name, phone } = req.body;
  const code = generarCodigoAcceso(); // Generar código de acceso para el usuario

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: { name: 'Acceso SkillsCert EC0301' },
          unit_amount: 99900
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/?canceled=true`,
      customer_email: email,
      metadata: { email, nombre: name, telefono: phone }
    });

    // Enviar el código por correo y WhatsApp antes de completar el pago
    await sendEmailCode(email, code); // Enviar el código por correo
    await sendWhatsAppMessage(phone, code); // Enviar el código por WhatsApp

    res.json({ success: true, id: session.id });
  } catch (error) {
    console.error('Error al crear sesión:', error);
    res.status(500).json({ success: false, error: 'No se pudo crear la sesión de pago' });
  }
});

// ============================================
// Verificar pago después de completar el pago
// ============================================
app.post('/verify-payment', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Session ID requerido' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.json({ success: false, error: 'Pago no completado' });
    }

    const result = await procesarPagoCompletado(session, req.ip);
    res.json({
      success: true,
      email: result.email,
      accessCode: result.codigo,
      expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Error al verificar pago:', error);
    res.status(500).json({ success: false, error: 'Error al verificar el pago' });
  }
});

// ============================================
// Inicio del servidor
// ============================================
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  const dbConnected = await checkDatabaseConnection();
  console.log(dbConnected ? '✅ Base de datos conectada' : '❌ Error de conexión');
});

