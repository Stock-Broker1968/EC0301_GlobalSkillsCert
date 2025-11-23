// =====================================================
// SERVER.JS - Backend EC0301 con MySQL Hostinger
// Adaptado a estructura existente de tablas
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
            ssl: { rejectUnauthorized: false }
        });
        
        const conn = await pool.getConnection();
        console.log('✅ MySQL Hostinger conectado');
        conn.release();
        return true;
    } catch (error) {
        console.error('❌ Error MySQL:', error.message);
        return false;
    }
}

// =====================================================
// FUNCIONES DE BASE DE DATOS
// Adaptadas a tu estructura: usuarios tiene codigo_acceso
// =====================================================

async function findUserByEmail(email) {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM usuarios WHERE email = ? LIMIT 1',
            [email.toLowerCase().trim()]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('Error findUserByEmail:', error.message);
        return null;
    }
}

async function findUserByEmailAndCode(email, code) {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM usuarios 
             WHERE email = ? AND codigo_acceso = ? 
             LIMIT 1`,
            [email.toLowerCase().trim(), code.trim()]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('Error findUserByEmailAndCode:', error.message);
        return null;
    }
}

async function createUser(userData) {
    try {
        const accessCode = crypto.randomInt(10000000, 99999999).toString();
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        
        const [result] = await pool.execute(
            `INSERT INTO usuarios 
             (email, nombre, telefono, codigo_acceso, stripe_session_id, payment_status, fecha_pago, fecha_registro, fecha_expiracion) 
             VALUES (?, ?, ?, ?, ?, 'paid', NOW(), NOW(), ?)`,
            [
                userData.email.toLowerCase().trim(),
                userData.name,
                userData.whatsapp || null,
                accessCode,
                userData.stripeSessionId,
                expiresAt
            ]
        );
        
        // Guardar en historial de códigos
        try {
            await pool.execute(
                `INSERT INTO codigos_acceso_historico (usuario_id, codigo, tipo, fecha_creacion, fecha_expiracion, activo)
                 VALUES (?, ?, 'initial', NOW(), ?, 1)`,
                [result.insertId, accessCode, expiresAt]
            );
        } catch(e) { console.log('Info: No se pudo guardar en historial'); }
        
        // Registrar transacción
        try {
            await pool.execute(
                `INSERT INTO transacciones (usuario_id, stripe_session_id, monto, moneda, estado, fecha_creacion)
                 VALUES (?, ?, 999.00, 'MXN', 'completed', NOW())`,
                [result.insertId, userData.stripeSessionId]
            );
        } catch(e) { console.log('Info: No se pudo registrar transacción'); }
        
        return {
            id: result.insertId,
            name: userData.name,
            email: userData.email.toLowerCase(),
            telefono: userData.whatsapp,
            accessCode,
            expiresAt
        };
    } catch (error) {
        console.error('Error createUser:', error.message);
        throw error;
    }
}

async function logActivity(userId, action, details) {
    try {
        await pool.execute(
            `INSERT INTO logs_actividad (usuario_id, accion, detalles, fecha, ip) 
             VALUES (?, ?, ?, NOW(), ?)`,
            [userId, action, details, '']
        );
    } catch (error) {
        // Silenciar errores de log
    }
}

// =====================================================
// ENVÍO DE CORREO CON POSTMARK
// =====================================================
async function sendWelcomeEmail(user) {
    if (!postmarkClient) {
        console.log('⚠️ Postmark no configurado - correo no enviado');
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
        body { font-family: 'Segoe UI', Arial; background: #f4f4f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { padding: 40px; }
        .code-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
        .code { font-size: 36px; font-weight: bold; color: white; letter-spacing: 4px; font-family: monospace; }
        .btn { display: inline-block; background: #6366f1; color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>🎓 SkillsCert EC0301</h1></div>
        <div class="content">
            <h2>¡Hola ${user.name}!</h2>
            <p>Tu pago ha sido procesado exitosamente. Ya tienes acceso completo al sistema EC0301.</p>
            <div class="code-box">
                <p style="color: rgba(255,255,255,0.8); margin: 0 0 10px;">Tu código de acceso:</p>
                <div class="code">${user.accessCode}</div>
            </div>
            <p><strong>Correo:</strong> ${user.email}</p>
            <p><strong>Válido hasta:</strong> ${expDate}</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}" class="btn">Acceder al Sistema</a>
            </div>
            <p style="color: #64748b; font-size: 14px;">Guarda este correo con tu código de acceso.</p>
        </div>
        <div class="footer"><p>© 2024 GlobalSkillsCert - Sistema EC0301</p></div>
    </div>
</body>
</html>`,
            TextBody: `¡Hola ${user.name}!\n\nTu código de acceso: ${user.accessCode}\n\nAccede en: ${FRONTEND_URL}\n\nVálido hasta: ${expDate}`
        });

        console.log(`📧 Correo enviado a: ${user.email}`);
        
        // Registrar envío
        try {
            await pool.execute(
                `INSERT INTO email_delivery_log (usuario_id, tipo, destinatario, estado, fecha_envio)
                 VALUES (?, 'welcome', ?, 'sent', NOW())`,
                [user.id, user.email]
            );
        } catch(e) {}
        
        return true;
    } catch (error) {
        console.error('❌ Error enviando correo:', error.message);
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
        service: 'EC0301 GlobalSkillsCert API v3.1',
        database: pool ? 'MySQL Hostinger' : 'Not connected',
        postmark: postmarkClient ? 'Configured' : 'Not configured'
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
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

        // Verificar si ya existe con código activo
        const existingUser = await findUserByEmail(email);
        if (existingUser && existingUser.codigo_acceso && existingUser.fecha_expiracion) {
            const expDate = new Date(existingUser.fecha_expiracion);
            if (expDate > new Date()) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Este correo ya tiene acceso activo. Usa tu código para iniciar sesión.' 
                });
            }
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

        console.log(`✅ Stripe session: ${session.id}`);
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

        console.log(`🔍 Verificando pago: ${session_id}`);

        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ success: false, message: 'Pago no completado.' });
        }

        const email = (session.customer_email || session.metadata?.userEmail || '').toLowerCase().trim();
        const name = session.metadata?.userName || 'Usuario';
        const whatsapp = session.metadata?.userWhatsapp || '';

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email no encontrado en la sesión.' });
        }

        // Verificar si ya existe
        let user = await findUserByEmail(email);

        if (user && user.codigo_acceso) {
            // Usuario existe, devolver datos existentes
            console.log(`👤 Usuario existente: ${email}`);
            return res.json({
                success: true,
                token: crypto.randomBytes(32).toString('hex'),
                user: {
                    name: user.nombre,
                    email: user.email,
                    accessCode: user.codigo_acceso,
                    expiresAt: user.fecha_expiracion
                }
            });
        }

        // Crear nuevo usuario
        user = await createUser({
            name,
            email,
            whatsapp,
            stripeSessionId: session_id
        });

        console.log(`👤 Usuario creado: ${email} | Código: ${user.accessCode}`);

        // Enviar correo de bienvenida
        await sendWelcomeEmail(user);

        const token = crypto.randomBytes(32).toString('hex');

        res.json({
            success: true,
            token,
            user: {
                name: user.name,
                email: user.email,
                accessCode: user.accessCode,
                expiresAt: user.expiresAt
            }
        });

    } catch (error) {
        console.error('❌ Verify error:', error.message);
        res.status(500).json({ success: false, message: 'Error verificando pago: ' + error.message });
    }
});

// =====================================================
// POST /login
// =====================================================
app.post('/login', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'Correo y código de acceso son requeridos.' });
        }

        console.log(`🔐 Intento login: ${email}`);

        // Buscar usuario por email
        const user = await findUserByEmail(email);

        if (!user) {
            console.log(`❌ Usuario no encontrado: ${email}`);
            return res.status(401).json({ success: false, message: 'Usuario no encontrado. Verifica tu correo electrónico.' });
        }

        // Verificar código
        if (!user.codigo_acceso || user.codigo_acceso !== code.trim()) {
            console.log(`❌ Código incorrecto para: ${email}`);
            return res.status(401).json({ success: false, message: 'Código de acceso incorrecto.' });
        }

        // Verificar expiración
        if (user.fecha_expiracion && new Date() > new Date(user.fecha_expiracion)) {
            return res.status(403).json({ success: false, message: 'Tu acceso ha expirado. Renueva tu suscripción.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        
        // Registrar login
        await logActivity(user.id, 'login', 'Login exitoso');

        console.log(`✅ Login exitoso: ${email}`);

        res.json({
            success: true,
            token,
            user: {
                name: user.nombre,
                email: user.email,
                expiresAt: user.fecha_expiracion
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error.message);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
});

// =====================================================
// 404
// =====================================================
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Endpoint no encontrado: ${req.method} ${req.path}` });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================
async function start() {
    const dbConnected = await connectDB();
    
    app.listen(PORT, () => {
        console.log('═'.repeat(50));
        console.log('🚀 EC0301 Backend v3.1 (MySQL Hostinger)');
        console.log(`📡 Puerto: ${PORT}`);
        console.log(`💾 MySQL: ${dbConnected ? '✅ Conectado' : '❌ Error'}`);
        console.log(`📧 Postmark: ${postmarkClient ? '✅ Configurado' : '❌ No configurado'}`);
        console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Configurado' : '❌ No configurado'}`);
        console.log('═'.repeat(50));
    });
}

start();
