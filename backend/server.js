// === Importar dependencias ===
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// === Configuración de CORS SEGURA ===
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://ec0301-globalskillscert.onrender.com'
}));

// === Conexión a base de datos (MySQL Hostinger) ===
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// === Endpoint sencillo de salud/backend ===
app.get('/', (req, res) => {
  res.send('¡Backend Generando EC v1.1 con Auth está funcionando!');
});

// === Debe ir ANTES del .json() para Stripe Webhook ===
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`🛒 Pago completado para sesión: ${session.id}`);
    try {
      const customerDetails = session.customer_details || {};
      const email = customerDetails.email;
      const phone = customerDetails.phone;
      // Simulación solo, completa tu lógica aquí según lo que ocupes guardar/enviar
      const accessCode = Math.random().toString().substring(2, 8);
      const hashedCode = await bcrypt.hash(accessCode, 10);
      await dbPool.execute(
        'INSERT INTO access_codes (code_hash, email, phone, stripe_session_id, expires_at) VALUES (?, ?, ?, ?, NOW() + INTERVAL 1 DAY)',
        [hashedCode, email, phone, session.id]
      );
      console.log(`   - Código guardado. Simular envío a WhatsApp ${phone}: ${accessCode}`);
    } catch (dbOrApiError) {
      console.error(`❌ Error en lógica post-pago:`, dbOrApiError);
    }
  }

  res.status(200).json({ received: true });
});

// === Middleware para JSON, después del webhook (por Stripe) ===
app.use(express.json());

// === Endpoint: Crear sesión de pago Stripe ===
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'oxxo'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: { name: 'Acceso Plataforma Generando EC' },
            unit_amount: 50000,
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      billing_address_collection: 'required',
      customer_creation: 'always',
      customer_email: req.body.email || null,
      phone_number_collection: { enabled: true },
      success_url: `${process.env.FRONTEND_URL}/Paginas_principales/success.html`,
      cancel_url: `${process.env.FRONTEND_URL}/Paginas_principales/index.html`,
      payment_method_options: { oxxo: { expires_after_days: 3 } }
    });
    res.json({ id: session.id });
  } catch (error) {
    console.error("❌ Error creando sesión Stripe:", error);
    res.status(500).json({ error: 'No se pudo iniciar el proceso de pago.' });
  }
});

// === Rutas de autenticación/login por código ===
const authRouter = express.Router();
app.use('/api/auth', authRouter);

authRouter.post('/login-code', async (req, res) => {
  const { accessCode } = req.body;
  if (!accessCode) return res.status(400).json({ error: 'Código de acceso requerido.' });
  try {
    const [rows] = await dbPool.execute(
      'SELECT * FROM access_codes WHERE is_used = 0 AND expires_at > NOW()',
      []
    );
    let validCodeMatch = null;
    for (const row of rows) {
      if (await bcrypt.compare(accessCode, row.code_hash)) {
        validCodeMatch = row;
        break;
      }
    }
    if (!validCodeMatch) return res.status(401).json({ error: 'Código inválido o expirado.' });
    await dbPool.execute(
      'UPDATE access_codes SET is_used = 1, used_at = NOW() WHERE id = ?',
      [validCodeMatch.id]
    );
    const token = jwt.sign(
      {
        id: validCodeMatch.id,
        email: validCodeMatch.email,
        phone: validCodeMatch.phone
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(200).json({ message: 'Inicio de sesión exitoso.', token });
  } catch (error) {
    console.error("❌ Error en /login-code:", error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// === Iniciar servidor ===
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
