// ============================================
// ARCHIVO: backend/server.js
// ============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE CRÍTICO
// ============================================

// 1. CORS - DEBE IR ANTES DE LAS RUTAS
app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://tudominio.com', // Reemplazar con tu dominio en producción
    'https://ec0301-globalskillscert-backend.onrender.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// 2. Body Parser - NECESARIO para leer req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Logging de requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// ENDPOINTS
// ============================================

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe: !!process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing'
  });
});

// CREATE CHECKOUT SESSION - ESTE ES EL ENDPOINT QUE FALLA
app.post('/create-checkout-session', async (req, res) => {
  console.log('📝 Recibiendo petición de checkout...');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  try {
    // Validar que Stripe esté configurado
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe Secret Key no configurada');
    }

    // Validar que la clave sea correcta (test o live)
    if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      throw new Error('Stripe Secret Key inválida');
    }

    console.log('✅ Stripe configurado correctamente');

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: 'Acceso SkillsCert EC0301',
              description: 'Sistema completo de diseño de cursos EC0301',
            },
            unit_amount: 50000, // 500 MXN = 50000 centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin || 'http://localhost:5500'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'http://localhost:5500'}/index.html?canceled=true`,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'ec0301-frontend'
      }
    });

    console.log('✅ Sesión creada:', session.id);

    // IMPORTANTE: Responder con el objeto completo
    res.json({
      id: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('❌ Error creando sesión de Stripe:', error.message);
    console.error('Stack:', error.stack);

    // Respuesta de error estructurada
    res.status(500).json({
      error: error.message,
      type: error.type || 'api_error',
      code: error.code || 'unknown_error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// VERIFY PAYMENT - Endpoint faltante
app.post('/verify-payment', async (req, res) => {
  console.log('🔍 Verificando pago...');
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Session ID requerido' 
    });
  }

  try {
    // Recuperar sesión de Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log('Session status:', session.payment_status);

    if (session.payment_status === 'paid') {
      // Generar código de acceso único
      const accessCode = generateAccessCode();
      
      // Aquí deberías guardar en base de datos:
      // - email: session.customer_details.email
      // - accessCode
      // - timestamp
      // - sessionId

      console.log('✅ Pago verificado para:', session.customer_details.email);

      return res.json({
        success: true,
        email: session.customer_details.email,
        accessCode: accessCode,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.json({
        success: false,
        error: 'Pago no completado',
        status: session.payment_status
      });
    }

  } catch (error) {
    console.error('❌ Error verificando pago:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// LOGIN - Validar código de acceso
app.post('/login', async (req, res) => {
  console.log('🔐 Intentando login...');
  const { email, accessCode } = req.body;

  if (!email || !accessCode) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email y código requeridos' 
    });
  }

  try {
    // Aquí deberías validar contra base de datos
    // Por ahora, validación simple para testing
    
    // TODO: Implementar validación real
    // const user = await db.users.findOne({ email, accessCode });
    
    console.log(`Login intento para: ${email}`);

    // TEMPORAL: Aceptar cualquier código para testing
    if (accessCode.length === 8) {
      return res.json({
        success: true,
        token: generateJWT({ email }), // Implementar JWT real
        user: { email }
      });
    }

    res.status(401).json({
      success: false,
      error: 'Credenciales inválidas'
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function generateAccessCode() {
  // Generar código alfanumérico de 8 caracteres
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateJWT(payload) {
  // TODO: Implementar JWT real con jsonwebtoken
  // Por ahora, simple base64
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// ============================================
// MANEJO DE ERRORES 404
// ============================================
app.use((req, res) => {
  console.log('❌ 404 - Ruta no encontrada:', req.path);
  res.status(404).json({ 
    error: 'Endpoint no encontrado',
    path: req.path,
    method: req.method
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
  console.log('================================================');
  console.log('🚀 Servidor EC0301 iniciado');
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Configurado' : '❌ NO configurado'}`);
  console.log('================================================');
});

// ============================================
// MANEJO DE ERRORES NO CAPTURADOS
// ============================================
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
