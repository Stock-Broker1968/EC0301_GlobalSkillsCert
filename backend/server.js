// =====================================================
// SERVER.JS - Backend EC0301 COMPLETO v4.0
// MySQL Hostinger + Stripe + Postmark + WhatsApp
// =====================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const postmark = require('postmark');
const cron = require('node-cron');

// Configuraciones
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Clientes externos
const postmarkClient = process.env.POSTMARK_SERVER_TOKEN 
    ? new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN)
    : null;

let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

let pool;

// =====================================================
// CONEXIÓN A MYSQL
// =====================================================
async function connectDB() {
    try {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
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
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Generar código único
        const accessCode = crypto.randomInt(10000000, 99999999).toString();
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 días

        // 1. Insertar usuario
        const [result] = await conn.execute(
            `INSERT INTO usuarios 
             (email, nombre, telefono, codigo_acceso, stripe_session_id, 
              payment_status, fecha_pago, fecha_registro, fecha_expiracion, activo) 
             VALUES (?, ?, ?, ?, ?, 'paid', NOW(), NOW(), ?, 1)`,
            [
                userData.email.toLowerCase().trim(),
                userData.name,
                userData.whatsapp || null,
                accessCode,
                userData.stripeSessionId,
                expiresAt
            ]
        );

        const userId = result.insertId;

        // 2. Guardar en historial de códigos
        await conn.execute(
            `INSERT INTO codigos_acceso_historico 
             (usuario_id, codigo, tipo, fecha_creacion, fecha_expiracion, activo)
             VALUES (?, ?, 'initial', NOW(), ?, 1)`,
            [userId, accessCode, expiresAt]
        );

        // 3. Registrar transacción
        await conn.execute(
            `INSERT INTO transacciones 
             (usuario_id, stripe_session_id, monto, moneda, estado, fecha_creacion)
             VALUES (?, ?, 999.00, 'MXN', 'completed', NOW())`,
            [userId, userData.stripeSessionId]
        );

        // 4. Log de actividad
        await conn.execute(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, detalles, fecha, ip)
             VALUES (?, 'registro', 'Usuario creado exitosamente', NOW(), ?)`,
            [userId, userData.ip || '']
        );

        await conn.commit();

        return {
            id: userId,
            name: userData.name,
            email: userData.email.toLowerCase(),
            telefono: userData.whatsapp,
            accessCode,
            expiresAt
        };

    } catch (error) {
        await conn.rollback();
        console.error('❌ Error createUser:', error.message);
        
        // Registrar error
        try {
            await pool.execute(
                `INSERT INTO error_logs (tipo, mensaje, stack, fecha) 
                 VALUES ('createUser', ?, ?, NOW())`,
                [error.message, error.stack]
            );
        } catch(e) {}
        
        throw error;
    } finally {
        conn.release();
    }
}

async function renewUserAccess(userId, stripeSessionId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Obtener usuario
        const [users] = await conn.execute(
            'SELECT * FROM usuarios WHERE id = ?',
            [userId]
        );
        
        if (!users[0]) throw new Error('Usuario no encontrado');
        const user = users[0];

        // Calcular nueva fecha desde la expiración actual o desde hoy
        const baseDate = user.fecha_expiracion && new Date(user.fecha_expiracion) > new Date() 
            ? new Date(user.fecha_expiracion) 
            : new Date();
        
        const newExpiresAt = new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000);

        // Actualizar usuario
        await conn.execute(
            `UPDATE usuarios 
             SET fecha_expiracion = ?, payment_status = 'paid', activo = 1 
             WHERE id = ?`,
            [newExpiresAt, userId]
        );

        // Registrar renovación en historial
        await conn.execute(
            `INSERT INTO codigos_acceso_historico 
             (usuario_id, codigo, tipo, fecha_creacion, fecha_expiracion, activo)
             VALUES (?, ?, 'renewal', NOW(), ?, 1)`,
            [userId, user.codigo_acceso, newExpiresAt]
        );

        // Registrar transacción
        await conn.execute(
            `INSERT INTO transacciones 
             (usuario_id, stripe_session_id, monto, moneda, estado, fecha_creacion)
             VALUES (?, ?, 999.00, 'MXN', 'completed', NOW())`,
            [userId, stripeSessionId]
        );

        // Log actividad
        await conn.execute(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, detalles, fecha, ip)
             VALUES (?, 'renovacion', 'Acceso renovado por 90 días', NOW(), '')`,
            [userId]
        );

        await conn.commit();

        return { expiresAt: newExpiresAt, email: user.email, nombre: user.nombre };

    } catch (error) {
        await conn.rollback();
        console.error('❌ Error renewUserAccess:', error.message);
        throw error;
    } finally {
        conn.release();
    }
}

async function logActivity(userId, action, details, ip = '') {
    try {
        await pool.execute(
            `INSERT INTO logs_actividad (usuario_id, accion, detalles, fecha, ip) 
             VALUES (?, ?, ?, NOW(), ?)`,
            [userId, action, details, ip]
        );
    } catch (error) {
        console.error('Error logging:', error.message);
    }
}

// =====================================================
// ENVÍO DE CORREO ELECTRÓNICO
// =====================================================
async function sendWelcomeEmail(user) {
    if (!postmarkClient) {
        console.log('⚠️ Postmark no configurado - correo no enviado');
        return false;
    }

    try {
        const expDate = new Date(user.expiresAt).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        await postmarkClient.sendEmail({
            From: process.env.POSTMARK_FROM_EMAIL,
            To: user.email,
            Subject: '🎓 Bienvenido a EC0301 - Tu código de acceso',
            HtmlBody: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
        .content { padding: 40px; }
        .content h2 { color: #1e293b; margin-top: 0; }
        .content p { color: #475569; line-height: 1.6; }
        .code-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
        .code-label { color: rgba(255,255,255,0.9); margin: 0 0 10px; font-size: 14px; }
        .code { font-size: 42px; font-weight: bold; color: white; letter-spacing: 8px; font-family: 'Courier New', monospace; }
        .info { background: #f1f5f9; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .btn { display: inline-block; background: #6366f1; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
        .btn:hover { background: #4f46e5; }
        .footer { background: #1e293b; color: #94a3b8; padding: 30px; text-align: center; font-size: 14px; }
        .footer a { color: #667eea; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 SkillsCert EC0301</h1>
        </div>
        <div class="content">
            <h2>¡Hola ${user.name}! 👋</h2>
            <p>Tu pago ha sido procesado exitosamente. Ahora tienes acceso completo al <strong>Sistema EC0301</strong> para el diseño e impartición de cursos de capacitación.</p>
            
            <div class="code-box">
                <p class="code-label">Tu código de acceso personal:</p>
                <div class="code">${user.accessCode}</div>
            </div>
            
            <div class="info">
                <strong>📅 Vigencia:</strong> 90 días (hasta el ${expDate})
            </div>
            
            <div style="text-align: center;">
                <a href="${FRONTEND_URL}" class="btn">🚀 Acceder al Sistema</a>
            </div>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
                <strong>💡 Consejo:</strong> Guarda este correo. Necesitarás tu código para acceder al sistema.<br>
                Si tienes dudas, responde a este correo.
            </p>
        </div>
        <div class="footer">
            <p><strong>GlobalSkillsCert</strong> - Sistema EC0301</p>
            <p>© 2024 Todos los derechos reservados</p>
        </div>
    </div>
</body>
</html>`,
            TextBody: `¡Hola ${user.name}!\n\nTu código de acceso EC0301: ${user.accessCode}\n\nAccede en: ${FRONTEND_URL}\n\nVálido hasta: ${expDate}\n\n¡Éxito en tu capacitación!`
        });

        console.log(`📧 Correo enviado a: ${user.email}`);

        // Registrar envío
        try {
            await pool.execute(
                `INSERT INTO email_delivery_log 
                 (usuario_id, tipo, destinatario, estado, fecha_envio)
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

async function sendExpirationWarning(user, daysLeft) {
    if (!postmarkClient) return false;

    try {
        await postmarkClient.sendEmail({
            From: process.env.POSTMARK_FROM_EMAIL,
            To: user.email,
            Subject: `⚠️ Tu acceso EC0301 expira en ${daysLeft} días`,
            HtmlBody: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f5; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
        <div style="background: #f59e0b; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">⚠️ Renovación Próxima</h1>
        </div>
        <div style="padding: 40px;">
            <h2>Hola ${user.nombre},</h2>
            <p>Tu acceso al sistema EC0301 está por vencer.</p>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <strong>Quedan ${daysLeft} días</strong> hasta el ${new Date(user.fecha_expiracion).toLocaleDateString('es-MX')}
            </div>
            <p>Renueva ahora para continuar sin interrupciones:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}/renovar" style="background: #f59e0b; color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: 600;">Renovar Acceso</a>
            </div>
        </div>
    </div>
</body>
</html>`
        });

        console.log(`⚠️ Alerta enviada a: ${user.email}`);
        return true;
    } catch (error) {
        console.error('❌ Error enviando alerta:', error.message);
        return false;
    }
}

// =====================================================
// ENVÍO DE WHATSAPP
// =====================================================
async function sendWhatsAppCode(phone, message, name) {
    if (!phone || !twilioClient) {
        console.log('⚠️ WhatsApp no configurado o teléfono faltante');
        return false;
    }

    try {
        // Limpiar número y agregar código de país
        const cleanPhone = phone.replace(/\D/g, '');
        const fullPhone = cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`;

        await twilioClient.messages.create({
            body: message,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:+${fullPhone}`
        });

        console.log(`📱 WhatsApp enviado a: +${fullPhone}`);
        return true;

    } catch (error) {
        console.error('❌ Error WhatsApp:', error.message);
        return false;
    }
}

// =====================================================
// TAREA PROGRAMADA - CONTROL DE VIGENCIA
// =====================================================
function setupExpirationCron() {
    // Ejecutar diariamente a las 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        try {
            console.log('🔍 Verificando usuarios próximos a expirar...');

            // Usuarios que expiran en 7 días
            const [expiringSoon] = await pool.execute(`
                SELECT id, email, nombre, telefono, codigo_acceso, fecha_expiracion
                FROM usuarios
                WHERE activo = 1 
                AND payment_status = 'paid'
                AND fecha_expiracion BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
            `);

            for (const user of expiringSoon) {
                const daysLeft = Math.ceil(
                    (new Date(user.fecha_expiracion) - new Date()) / (1000 * 60 * 60 * 24)
                );
                
                // Enviar email
                await sendExpirationWarning(user, daysLeft);
                
                // Enviar WhatsApp
                if (user.telefono) {
                    const msg = `⚠️ Hola ${user.nombre}!\n\nTu acceso EC0301 expira en ${daysLeft} días.\n\nRenueva en: ${FRONTEND_URL}/renovar`;
                    await sendWhatsAppCode(user.telefono, msg, user.nombre);
                }
            }

            // Desactivar usuarios expirados
            const [result] = await pool.execute(`
                UPDATE usuarios 
                SET activo = 0, payment_status = 'expired'
                WHERE fecha_expiracion < NOW() 
                AND activo = 1
            `);

            console.log(`⚠️ Advertencias: ${expiringSoon.length} | 🔒 Expirados: ${result.affectedRows}`);

        } catch (error) {
            console.error('❌ Error en tarea de expiración:', error.message);
        }
    });

    console.log('⏰ Tarea cron de expiración configurada (8:00 AM diario)');
}

// =====================================================
// EXPRESS APP
// =====================================================
const app = express();

app.use(cors({
    origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// Middleware de logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// =====================================================
// ENDPOINTS
// =====================================================

app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'EC0301 GlobalSkillsCert API v4.0',
        database: pool ? 'MySQL Hostinger ✅' : 'Not connected ❌',
        postmark: postmarkClient ? 'Configured ✅' : 'Not configured ❌',
        whatsapp: twilioClient ? 'Configured ✅' : 'Not configured ❌'
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        db: !!pool,
        email: !!postmarkClient,
        whatsapp: !!twilioClient
    });
});

// =====================================================
// CHECKOUT - Crear sesión de pago
// =====================================================
app.post('/create-checkout', async (req, res) => {
    try {
        const { name, email, whatsapp } = req.body;

        if (!name || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Nombre y correo son requeridos.' 
            });
        }

        // Verificar si ya existe usuario con acceso activo
        const existingUser = await findUserByEmail(email);
        if (existingUser && existingUser.codigo_acceso && existingUser.fecha_expiracion) {
            const expDate = new Date(existingUser.fecha_expiracion);
            if (expDate > new Date()) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Este correo ya tiene un acceso activo. Usa tu código para iniciar sesión.' 
                });
            }
        }

        console.log(`📝 Creando checkout: ${name} | ${email}`);

        // Crear sesión de Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'mxn',
                    product_data: { name: 'Acceso EC0301 - 90 días' },
                    unit_amount: 99900 // $999.00 MXN
                },
                quantity: 1
            }],
            mode: 'payment',
            customer_email: email,
            metadata: { userName: name, userEmail: email, userWhatsapp: whatsapp || '' },
            success_url: `${FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/index.html?canceled=true`
        });

        console.log(`✅ Stripe session creada: ${session.id}`);
        res.json({ success: true, url: session.url });

    } catch (error) {
        console.error('❌ Error checkout:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error al crear sesión de pago.' 
        });
    }
});

// =====================================================
// VERIFY PAYMENT - Verificar pago y crear usuario
// =====================================================
app.post('/verify-payment', async (req, res) => {
    try {
        const { session_id } = req.body;

        if (!session_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Session ID es requerido.' 
            });
        }

        console.log(`🔍 Verificando pago: ${session_id}`);

        // Obtener sesión de Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ 
                success: false, 
                message: 'El pago no ha sido completado.' 
            });
        }

        const email = (session.customer_email || session.metadata?.userEmail || '').toLowerCase().trim();
        const name = session.metadata?.userName || 'Usuario';
        const whatsapp = session.metadata?.userWhatsapp || '';

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email no encontrado en la sesión de pago.' 
            });
        }

        // Verificar si ya existe
        let user = await findUserByEmail(email);

        if (user && user.codigo_acceso) {
            console.log(`👤 Usuario ya existe: ${email}`);
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
            stripeSessionId: session_id,
            ip: req.ip
        });

        console.log(`✅ Usuario creado: ${email} | Código: ${user.accessCode}`);

        // Enviar notificaciones
        await sendWelcomeEmail(user);
        
        if (whatsapp) {
            const whatsappMsg = `¡Hola ${name}! 🎓\n\nTu código de acceso EC0301:\n\n*${user.accessCode}*\n\nVálido por 90 días.\n\nAccede en: ${FRONTEND_URL}\n\n¡Éxito en tu capacitación!`;
            await sendWhatsAppCode(whatsapp, whatsappMsg, name);
        }

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
        console.error('❌ Error verify-payment:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar el pago: ' + error.message 
        });
    }
});

// =====================================================
// LOGIN - Iniciar sesión con código
// =====================================================
app.post('/login', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ 
                success: false, 
                message: 'Correo y código de acceso son requeridos.' 
            });
        }

        console.log(`🔐 Intento de login: ${email}`);

        // Buscar usuario con código
        const user = await findUserByEmailAndCode(email, code);

        if (!user) {
            console.log(`❌ Credenciales incorrectas: ${email}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Correo o código de acceso incorrectos.' 
            });
        }

        // Verificar si está activo
        if (!user.activo) {
            return res.status(403).json({ 
                success: false, 
                message: 'Tu cuenta ha sido desactivada. Contacta a soporte.' 
            });
        }

        // Verificar expiración
        if (user.fecha_expiracion && new Date() > new Date(user.fecha_expiracion)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Tu acceso ha expirado. Renueva tu suscripción para continuar.' 
            });
        }

        const token = crypto.randomBytes(32).toString('hex');

        // Registrar login
        await logActivity(user.id, 'login', 'Login exitoso', req.ip);

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
        console.error('❌ Error login:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error en el servidor al intentar iniciar sesión.' 
        });
    }
});

// =====================================================
// RENEW ACCESS - Renovar acceso
// =====================================================
app.post('/renew-access', async (req, res) => {
    try {
        const { email, stripe_session_id } = req.body;

        if (!email || !stripe_session_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email y session_id son requeridos.' 
            });
        }

        console.log(`🔄 Renovación solicitada: ${email}`);

        // Verificar pago en Stripe
        const session = await stripe.checkout.sessions.retrieve(stripe_session_id);
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ 
                success: false, 
                message: 'El pago no ha sido completado.' 
            });
        }

        // Buscar usuario
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuario no encontrado.' 
            });
        }

        // Renovar acceso
        const renewal = await renewUserAccess(user.id, stripe_session_id);

        // Enviar notificaciones
        await sendWelcomeEmail({
            id: user.id,
            name: renewal.nombre,
            email: renewal.email,
            accessCode: user.codigo_acceso,
            expiresAt: renewal.expiresAt
        });

        if (user.telefono) {
            const whatsappMsg = `✅ ¡Hola ${user.nombre}!\n\nTu acceso EC0301 ha sido renovado exitosamente.\n\nNueva fecha de expiración: ${new Date(renewal.expiresAt).toLocaleDateString('es-MX')}\n\nAccede en: ${FRONTEND_URL}`;
            await sendWhatsAppCode(user.telefono, whatsappMsg, user.nombre);
        }

        console.log(`✅ Renovación exitosa: ${email} hasta ${renewal.expiresAt}`);

        res.json({
            success: true,
            message: 'Acceso renovado exitosamente por 90 días más.',
            expiresAt: renewal.expiresAt
        });

    } catch (error) {
        console.error('❌ Error renovación:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error al renovar acceso: ' + error.message 
        });
    }
});

// =====================================================
// GET USER INFO - Obtener información de usuario
// =====================================================
app.post('/get-user-info', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email y código son requeridos.' 
            });
        }

        const user = await findUserByEmailAndCode(email, code);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuario no encontrado.' 
            });
        }

        // Calcular días restantes
        const daysLeft = user.fecha_expiracion 
            ? Math.ceil((new Date(user.fecha_expiracion) - new Date()) / (1000 * 60 * 60 * 24))
            : 0;

        res.json({
            success: true,
            user: {
                nombre: user.nombre,
                email: user.email,
                telefono: user.telefono,
                fecha_registro: user.fecha_registro,
                fecha_expiracion: user.fecha_expiracion,
                dias_restantes: daysLeft > 0 ? daysLeft : 0,
                activo: user.activo,
                payment_status: user.payment_status
            }
        });

    } catch (error) {
        console.error('❌ Error get-user-info:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener información del usuario.' 
        });
    }
});

// =====================================================
// ADMIN - Obtener estadísticas (protegido)
// =====================================================
app.get('/admin/stats', async (req, res) => {
    try {
        // Verificación básica de admin (implementar JWT en producción)
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.ADMIN_SECRET_KEY) {
            return res.status(403).json({ 
                success: false, 
                message: 'No autorizado.' 
            });
        }

        const [stats] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM usuarios WHERE activo = 1) AS usuarios_activos,
                (SELECT COUNT(*) FROM usuarios WHERE fecha_expiracion > NOW()) AS usuarios_vigentes,
                (SELECT COUNT(*) FROM usuarios 
                 WHERE fecha_expiracion BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)) AS proximos_expirar,
                (SELECT COUNT(*) FROM transacciones 
                 WHERE estado = 'completed' AND DATE(fecha_creacion) = CURDATE()) AS pagos_hoy,
                (SELECT COALESCE(SUM(monto), 0) FROM transacciones 
                 WHERE estado = 'completed' AND DATE(fecha_creacion) = CURDATE()) AS ingresos_hoy,
                (SELECT COALESCE(SUM(monto), 0) FROM transacciones 
                 WHERE estado = 'completed' AND MONTH(fecha_creacion) = MONTH(CURDATE())) AS ingresos_mes,
                (SELECT COUNT(*) FROM transacciones WHERE estado = 'completed') AS total_transacciones
        `);

        res.json({
            success: true,
            stats: stats[0]
        });

    } catch (error) {
        console.error('❌ Error stats:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener estadísticas.' 
        });
    }
});

// =====================================================
// ADMIN - Listar usuarios
// =====================================================
app.get('/admin/users', async (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.ADMIN_SECRET_KEY) {
            return res.status(403).json({ 
                success: false, 
                message: 'No autorizado.' 
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const filter = req.query.filter || 'all'; // all, active, expired, expiring

        let whereClause = '';
        if (filter === 'active') {
            whereClause = 'WHERE activo = 1 AND fecha_expiracion > NOW()';
        } else if (filter === 'expired') {
            whereClause = 'WHERE fecha_expiracion < NOW()';
        } else if (filter === 'expiring') {
            whereClause = 'WHERE fecha_expiracion BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)';
        }

        const [users] = await pool.execute(`
            SELECT 
                id, nombre, email, telefono, codigo_acceso,
                fecha_registro, fecha_expiracion, payment_status, activo,
                DATEDIFF(fecha_expiracion, NOW()) AS dias_restantes
            FROM usuarios
            ${whereClause}
            ORDER BY fecha_registro DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        const [total] = await pool.execute(`
            SELECT COUNT(*) as count FROM usuarios ${whereClause}
        `);

        res.json({
            success: true,
            users,
            pagination: {
                total: total[0].count,
                limit,
                offset,
                pages: Math.ceil(total[0].count / limit)
            }
        });

    } catch (error) {
        console.error('❌ Error listing users:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error al listar usuarios.' 
        });
    }
});

// =====================================================
// TEST EMAIL - Endpoint de prueba de correo
// =====================================================
app.post('/test-email', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email es requerido.' 
            });
        }

        const testUser = {
            id: 0,
            name: 'Usuario de Prueba',
            email: email,
            accessCode: '12345678',
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        };

        const result = await sendWelcomeEmail(testUser);

        res.json({
            success: result,
            message: result ? 'Email de prueba enviado exitosamente.' : 'Error al enviar email.'
        });

    } catch (error) {
        console.error('❌ Error test-email:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error al enviar email de prueba.' 
        });
    }
});

// =====================================================
// TEST WHATSAPP - Endpoint de prueba de WhatsApp
// =====================================================
app.post('/test-whatsapp', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'Teléfono es requerido.' 
            });
        }

        const testMessage = '🧪 Prueba de WhatsApp desde EC0301.\n\nSi recibes este mensaje, la configuración es correcta. ✅';
        const result = await sendWhatsAppCode(phone, testMessage, 'Prueba');

        res.json({
            success: result,
            message: result ? 'WhatsApp de prueba enviado exitosamente.' : 'Error al enviar WhatsApp.'
        });

    } catch (error) {
        console.error('❌ Error test-whatsapp:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error al enviar WhatsApp de prueba.' 
        });
    }
});

// =====================================================
// 404 - Ruta no encontrada
// =====================================================
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: `Endpoint no encontrado: ${req.method} ${req.path}` 
    });
});

// =====================================================
// ERROR HANDLER GLOBAL
// =====================================================
app.use((error, req, res, next) => {
    console.error('❌ Error no manejado:', error);
    
    // Registrar error en BD
    if (pool) {
        pool.execute(
            `INSERT INTO error_logs (tipo, mensaje, stack, fecha) 
             VALUES ('unhandled', ?, ?, NOW())`,
            [error.message, error.stack]
        ).catch(e => console.error('No se pudo registrar error:', e.message));
    }
    
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================
async function startServer() {
    const dbConnected = await connectDB();

    if (!dbConnected) {
        console.error('❌ No se pudo conectar a la base de datos. Abortando...');
        process.exit(1);
    }

    // Configurar tarea cron de expiración
    setupExpirationCron();

    app.listen(PORT, () => {
        console.log('═'.repeat(60));
        console.log('🚀 EC0301 Backend v4.0 - COMPLETO');
        console.log('═'.repeat(60));
        console.log(`📡 Puerto: ${PORT}`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`💾 MySQL: ${dbConnected ? '✅ Conectado' : '❌ Error'}`);
        console.log(`📧 Postmark: ${postmarkClient ? '✅ Configurado' : '❌ No configurado'}`);
        console.log(`📱 WhatsApp: ${twilioClient ? '✅ Configurado' : '❌ No configurado'}`);
        console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Configurado' : '❌ No configurado'}`);
        console.log(`🌍 Frontend: ${FRONTEND_URL}`);
        console.log(`⚙️ Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log('═'.repeat(60));
        console.log('📋 Endpoints disponibles:');
        console.log('   GET  /');
        console.log('   GET  /health');
        console.log('   POST /create-checkout');
        console.log('   POST /verify-payment');
        console.log('   POST /login');
        console.log('   POST /renew-access');
        console.log('   POST /get-user-info');
        console.log('   POST /test-email');
        console.log('   POST /test-whatsapp');
        console.log('   GET  /admin/stats (protegido)');
        console.log('   GET  /admin/users (protegido)');
        console.log('═'.repeat(60));
        console.log('✅ Servidor iniciado correctamente');
        console.log('⏰ Tarea cron configurada: 8:00 AM diario');
        console.log('═'.repeat(60));
    });
}

// Manejo de señales para cierre graceful
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    if (pool) {
        await pool.end();
        console.log('✅ Conexiones de BD cerradas');
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Cerrando servidor...');
    if (pool) {
        await pool.end();
        console.log('✅ Conexiones de BD cerradas');
    }
    process.exit(0);
});

// Iniciar
startServer().catch(error => {
    console.error('❌ Error fatal al iniciar servidor:', error);
    process.exit(1);
    // 1. POST /create-checkout-session
app.post('/create-checkout-session', async (req, res) => {
  const { nombre, email, telefono } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: 'prod_TOYcBbqNsWEKUt', // Tu product ID
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
    res.status(500).json({ error: error.message });
  }
});

// 2. POST /verify-payment
app.post('/verify-payment', async (req, res) => {
  const { sessionId } = req.body;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { nombre, email, telefono } = session.metadata;
      
      // Guardar en MySQL
      await pool.execute(
        "INSERT INTO access_codes (email, code, nombre, telefono, created_at, expires_at, status) VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 1)",
        [email, accessCode, nombre, telefono]
      );
      
      res.json({ success: true, accessCode, email });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. POST /resend-notification
app.post('/resend-notification', async (req, res) => {
  res.json({ success: true });
});

});
