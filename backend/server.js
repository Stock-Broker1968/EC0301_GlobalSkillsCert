// =====================================================
// SERVER.JS - Backend EC0301 con MySQL Hostinger
// =====================================================

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Stripe = require('stripe');
const postmark = require('postmark');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// CONFIGURACIÓN
// =====================================================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const postmarkClient = process.env.POSTMARK_API_KEY 
    ? new postmark.ServerClient(process.env.POSTMARK_API_KEY) 
    : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://ec0301-globalskillscert.onrender.com';

// =====================================================
// MYSQL CONNECTION POOL
// =====================================================
let pool;

async function connectDB() {
    try {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            port: process.env.MYSQL_PORT || 3306,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: { rejectUnauthorized: false }
        });
        
        // Test connection
        const conn = await pool.getConnection();
        console.log('✅ MySQL conectado a Hostinger');
        conn.release();
        return true;
    } catch (error) {
        console.error('❌ Error MySQL:', error.message);
        return false;
    }
}

// =====================================================
// FUNCIONES DE BASE DE DATOS
// =====================================================

async function findUserByEmail(email) {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM usuarios WHERE email = ? LIMIT 1',
            [email.toLowerCase()]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('Error findUser:', error.message);
        return null;
    }
}

async function findUserByCode(code) {
    try {
        const [rows] = await pool.execute(
            `SELECT u.*, ac.codigo, ac.fecha_expiracion 
             FROM usuarios u 
             JOIN access_codes ac ON u.id = ac.usuario_id 
             WHERE ac.codigo = ? AND ac.activo = 1 
             LIMIT 1`,
            [code]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('Error findUserByCode:', error.message);
        return null;
    }
}

async function createUser(userData) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // Insertar usuario
        const [userResult] = await conn.execute(
            `INSERT INTO usuarios (nombre, email, whatsapp, fecha_registro, activo) 
             VALUES (?, ?, ?, NOW(), 1)`,
            [userData.name, userData.email.toLowerCase(), userData.whatsapp || null]
        );
        const userId = userResult.insertId;
        
        // Generar código de acceso
        const accessCode = crypto.randomInt(10000000, 99999999).toString();
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 días
        
        // Insertar código de acceso
        await conn.execute(
            `INSERT INTO access_codes (usuario_id, codigo, fecha_creacion, fecha_expiracion, activo) 
             VALUES (?, ?, NOW(), ?, 1)`,
            [userId, accessCode, expiresAt]
        );
        
        // Registrar transacción
        await conn.execute(
            `INSERT INTO transacciones (usuario_id, stripe_session_id, monto, moneda, estado, fecha) 
             VALUES (?, ?, ?, 'MXN', 'completed', NOW())`,
            [userId, userData.stripeSessionId, 999.00]
        );
        
        await conn.commit();
        
        return {
            id: userId,
            name: userData.name,
            email: userData.email.toLowerCase(),
            whatsapp: userData.whatsapp,
            accessCode,
            expiresAt,
            isActive: true
        };
    } catch (error) {
        await conn.rollback();
        console.error('Error createUser:', error.message);
        throw error;
    } finally {
        conn.release();
    }
}

async function getUserWithCode(email) {
    try {
        const [rows] = await pool.execute(
            `SELECT u.*, ac.codigo as accessCode, ac.fecha_expiracion as expiresAt, ac.activo as codeActive
             FROM usuarios u 
             LEFT JOIN access_codes ac ON u.id = ac.usuario_id AND ac.activo = 1
             WHERE u.email = ? 
             ORDER BY ac.fecha_creacion DESC
             LIMIT 1`,
            [email.toLowerCase()]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('Error getUserWithCode:', error.message);
        return null;
    }
}

async function logActivity(userId, action, details) {
    try {
        await pool.execute(
            `INSERT INTO logs_actividad (usuario_id, accion, detalles, fecha) VALUES (?, ?, ?, NOW())`,
            [userId, action, details]
        );
    } catch (error) {
        console.error('Error logging:', error.message);
    }
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// =====================================================
// ENVÍO DE CORREO
// =====================================================
async function sendWelcomeEmail(user) {
    if (!postmarkClient) {
        console.log('⚠️ Postmark no configurado');
        return false;
    }

    try {
        const expDate = new Date(user.expiresAt).toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        await postmarkClient.sendEmail({
            From: process.env.POSTMARK_FROM_EMAIL || 'info@skillscert.com.mx',
            To: user.email,
            Subject: '🎓 ¡Bienvenido a SkillsCert EC0301! - Tu código de acceso',
            HtmlBody: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { padding: 40px 30px; }
        .code-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
        .code { font-size: 36px; font-weight: bold; color: white; letter-spacing: 4px; font-family: monospace; }
        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>🎓 SkillsCert EC0301</h1></div>
        <div class="content">
            <h2>¡Hola ${user.name}!</h2>
            <p>Tu pago ha sido procesado exitosamente.</p>
            <div class="code-box">
                <p style="color: rgba(255,255,255,0.8); margin: 0 0 10px;">Tu código de acceso:</p>
                <div class="code">${user.accessCode}</div>
            </div>
            <p><strong>Correo:</strong> ${user.email}</p>
            <p><strong>Válido hasta:</strong> ${expDate}</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}" class="btn">Acceder al Sistema</a>
            </div>
        </div>
        <div class="footer"><p>© 2024 GlobalSkillsCert</p></div>
    </div>
</body>
</html>`,
            TextBody: `¡Hola ${user.name}!\n\nTu código: ${user.accessCode}\n\nAccede en: ${FRONTEND_URL}\n\nVálido hasta: ${expDate}`
        });

        console.log(`📧 Correo enviado a: ${user.email}`);
        
        // Registrar envío en BD
        try {
            await pool.execute(
                `INSERT INTO email_delivery_log (usuario_id, tipo, destinatario, estado, fecha) 
                 VALUES (?, 'welcome', ?, 'sent', NOW())`,
                [user.id, user.email]
            );
        } catch(e) {}
        
        return true;
    } catch (error) {
        console.error('❌ Error correo:', error.message);
        return false;
    }
}

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

// =====================================================
// RUTAS
// =====================================================

app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'EC0301 GlobalSkillsCert API v3.0',
        database: pool ? 'MySQL Hostinger' : 'Not connected'
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', db: !!pool });
});

// =====================================================
// POST /create-checkout
// =====================================================
app.post('/create-checkout', async (req, res) => {
    try {
        const { name, email, whatsapp } = req.body;

        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'Nombre y correo requeridos.' });
        }

        // Verificar si ya existe
        const existingUser = await getUserWithCode(email);
        if (existingUser && existingUser.accessCode) {
            return res.status(400).json({ 
                success: false, 
                message: 'Este correo ya tiene una cuenta activa. Usa tu código de acceso para iniciar sesión.' 
            });
        }

        console.log(`📝 Checkout: ${name} | ${email}`);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: email,
            line_items: [{
                price_data: {
                    currency: 'mxn',
                    product_data: { name: 'Acceso SkillsCert EC0301', description: '90 días de acceso' },
                    unit_amount: 99900
                },
                quantity: 1
            }],
            metadata: { userName: name, userEmail: email, userWhatsapp: whatsapp || '' },
            success_url: `${FRONTEND_URL}/index.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/index.html?canceled=true`
        });

        res.json({ success: true, url: session.url });

    } catch (error) {
        console.error('❌ Checkout error:', error.message);
        res.status(500).json({ success: false, message: 'Error al crear sesión de pago.' });
    }
});

// =====================================================
// POST /verify-payment
// =====================================================
app.post('/verify-payment', async (req, res) => {
    try {
        const { session_id } = req.body;
        if (!session_id) {
            return res.status(400).json({ success: false, message: 'Session ID requerido.' });
        }

        console.log(`🔍 Verificando: ${session_id}`);

        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ success: false, message: 'Pago no completado.' });
        }

        const email = (session.customer_email || session.metadata?.userEmail).toLowerCase();
        const name = session.metadata?.userName || 'Usuario';
        const whatsapp = session.metadata?.userWhatsapp || '';

        // Verificar si ya existe
        let user = await getUserWithCode(email);

        if (!user || !user.accessCode) {
            // Crear nuevo usuario
            user = await createUser({
                name,
                email,
                whatsapp,
                stripeSessionId: session_id
            });
            console.log(`👤 Usuario creado: ${email} | Código: ${user.accessCode}`);
            
            // Enviar correo
            await sendWelcomeEmail(user);
        }

        const token = generateToken();

        res.json({
            success: true,
            token,
            user: {
                name: user.name || user.nombre,
                email: user.email,
                accessCode: user.accessCode,
                expiresAt: user.expiresAt || user.fecha_expiracion
            }
        });

    } catch (error) {
        console.error('❌ Verify error:', error.message);
        res.status(500).json({ success: false, message: 'Error verificando pago.' });
    }
});

// =====================================================
// POST /login
// =====================================================
app.post('/login', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'Correo y código requeridos.' });
        }

        console.log(`🔐 Login: ${email}`);

        const user = await getUserWithCode(email);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado.' });
        }

        if (!user.accessCode || user.accessCode !== code.trim()) {
            return res.status(401).json({ success: false, message: 'Código de acceso incorrecto.' });
        }

        if (!user.activo) {
            return res.status(403).json({ success: false, message: 'Cuenta desactivada.' });
        }

        const expiresAt = user.expiresAt || user.fecha_expiracion;
        if (expiresAt && new Date() > new Date(expiresAt)) {
            return res.status(403).json({ success: false, message: 'Tu acceso ha expirado.' });
        }

        const token = generateToken();
        
        // Log actividad
        await logActivity(user.id, 'login', `Login exitoso desde ${req.ip}`);

        console.log(`✅ Login: ${email}`);

        res.json({
            success: true,
            token,
            user: { 
                name: user.nombre || user.name, 
                email: user.email, 
                expiresAt 
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error.message);
        res.status(500).json({ success: false, message: 'Error en login.' });
    }
});

// =====================================================
// 404
// =====================================================
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Not found: ${req.path}` });
});

// =====================================================
// INICIAR
// =====================================================
async function start() {
    const dbConnected = await connectDB();
    
    app.listen(PORT, () => {
        console.log('═'.repeat(50));
        console.log('🚀 EC0301 Backend v3.0 (MySQL)');
        console.log(`📡 Puerto: ${PORT}`);
        console.log(`💾 MySQL: ${dbConnected ? '✅ Conectado' : '❌ Error'}`);
        console.log(`📧 Postmark: ${postmarkClient ? '✅' : '❌'}`);
        console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅' : '❌'}`);
        console.log('═'.repeat(50));
    });
}

start();
