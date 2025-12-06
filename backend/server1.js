require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mysql = require('mysql2/promise');

const app = express();

// Middleware
app.use(cors({
  origin: ['https://ec0301-globalskillscert.onrender.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.raw({type: 'application/octet-stream'}));

// Pool de conexiones MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend online ✅' });
});

// Test DB
app.get('/test-db', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT 1');
    connection.release();
    res.json({ status: 'DB conectada ✅', data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 1. CREATE CHECKOUT SESSION
app.post('/create-checkout-session', async (req, res) => {
  const { nombre, email, telefono } = req.body;
  
  if (!nombre || !email || !telefono) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PRICE_ID || 'prod_TOYcBbqNsWEKUt',
        quantity: 1
      }],
      mode: 'payment',
      success_url: `https://ec0301-globalskillscert.onrender.com/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://ec0301-globalskillscert.onrender.com/payment`,
      customer_email: email,
      metadata: { nombre, email, telefono }
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. VERIFY PAYMENT
app.post('/verify-payment', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID requerido' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Pago no completado' });
    }

    // Generar código de acceso
    const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { nombre, email, telefono } = session.metadata;

    // Guardar en MySQL
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO access_codes (email, code, nombre, telefono, created_at, expires_at, status) 
         VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 1)`,
        [email, accessCode, nombre, telefono]
      );
    } finally {
      connection.release();
    }

    res.json({ 
      success: true, 
      accessCode, 
      email,
      nombre,
      message: 'Pago verificado y código generado'
    });
  } catch (error) {
    console.error('Error verificando pago:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. RESEND NOTIFICATION
app.post('/resend-notification', async (req, res) => {
  const { email, type } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT code FROM access_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1',
        [email]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Código no encontrado' });
      }

      res.json({ success: true, message: 'Notificación reenviada' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error reenviando notificación:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook Stripe
app.post('/webhook/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('Webhook recibido:', event.type);
    res.json({ received: true });
  } catch (error) {
    console.error('Error webhook:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en puerto ${PORT}`);
});
