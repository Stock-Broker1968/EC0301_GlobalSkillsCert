// =====================================================
// SERVER.JS - Backend EC0301 GlobalSkillsCert
// Con Stripe + Postmark + WhatsApp Meta API
// =====================================================

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Stripe = require('stripe');
const postmark = require('postmark');

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// CONFIGURACIÓN DE SERVICIOS
// =====================================================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

const STRIPE_PRICE = 99900; // $999.00 MXN en centavos
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://ec0301-globalskillscert.onrender.com';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors({
    origin: [
        'https://ec0301-globalskillscert.onrender.com',
        'http://localhost:3000',
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// BASE DE DATOS EN MEMORIA
// Para producción usar MongoDB Atlas o PostgreSQL
// =====================================================
const users = new Map();
const sessions = new Map();
const pendingPayments = new Map();

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function generateAccessCode() {
    return crypto.randomInt(10000000, 99999999).toString();
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function getExpirationDate() {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date;
}

function formatPhoneForWhatsApp(phone) {
    // Limpiar y formatear número para WhatsApp
    let cleaned = phone.replace(/\D/g, '');
    // Si empieza con 52 (México) y tiene 10 dígitos después, está bien
    if (!cleaned.startsWith('52') && cleaned.length === 10) {
        cleaned = '52' + cleaned;
    }
    return cleaned;
}

// =====================================================
// ENVÍO DE CORREO CON POSTMARK
// =====================================================
async function sendWelcomeEmail(user) {
    try {
        const expirationDate = new Date(user.expiresAt).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        await postmarkClient.sendEmail({
            From: process.env.POSTMARK_FROM_EMAIL || 'soporte@globalskillscert.com',
            To: user.email,
            Subject: '🎓 ¡Bienvenido a SkillsCert EC0301! - Tu código de acceso',
            HtmlBody: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0; }
                        .content { padding: 40px 30px; }
                        .code-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
                        .code { font-size: 36px; font-weight: bold; color: white; letter-spacing: 4px; font-family: monospace; }
                        .info { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
                        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
                        .info-row:last-child { border-bottom: none; }
                        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
                        .footer { background: #1e293b; color: #94a3b8; padding: 30px; text-align: center; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎓 SkillsCert EC0301</h1>
                            <p>Sistema Profesional de Diseño Instruccional</p>
                        </div>
                        <div class="content">
                            <h2>¡Hola ${user.name}!</h2>
                            <p>Tu pago ha sido procesado exitosamente. Ya tienes acceso completo al sistema EC0301 para diseñar tus cursos de capacitación profesional.</p>
                            
                            <div class="code-box">
                                <p style="color: rgba(255,255,255,0.8); margin: 0 0 10px;">Tu código de acceso:</p>
                                <div class="code">${user.accessCode}</div>
                            </div>
                            
                            <div class="info">
                                <div class="info-row">
                                    <span><strong>Correo registrado:</strong></span>
                                    <span>${user.email}</span>
                                </div>
                                <div class="info-row">
                                    <span><strong>Acceso válido hasta:</strong></span>
                                    <span>${expirationDate}</span>
                                </div>
                                <div class="info-row">
                                    <span><strong>Duración:</strong></span>
                                    <span>90 días</span>
                                </div>
                            </div>
                            
                            <div style="text-align: center;">
                                <a href="${FRONTEND_URL}" class="btn">Acceder al Sistema</a>
                            </div>
                            
                            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                                <strong>Importante:</strong> Guarda este correo, ya que contiene tu código de acceso. 
                                Si tienes alguna duda, responde a este correo o contáctanos por WhatsApp.
                            </p>
                        </div>
                        <div class="footer">
                            <p>© 2024 GlobalSkillsCert - Sistema EC0301</p>
                            <p>Diseño instruccional bajo estándares CONOCER</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            TextBody: `
¡Hola ${user.name}!

Tu pago ha sido procesado exitosamente.

TU CÓDIGO DE ACCESO: ${user.accessCode}

Correo registrado: ${user.email}
Acceso válido hasta: ${expirationDate}

Accede al sistema en: ${FRONTEND_URL}

Guarda este correo con tu código de acceso.

© 2024 GlobalSkillsCert - Sistema EC0301
            `
        });

        console.log(`📧 Correo enviado a: ${user.email}`);
        return true;
    } catch (error) {
        console.error('❌ Error enviando correo:', error);
        return false;
    }
}

// =====================================================
// ENVÍO DE WHATSAPP CON META API
// =====================================================
async function sendWhatsAppMessage(user) {
    if (!user.whatsapp || !WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
        console.log('ℹ️ WhatsApp no configurado o número no proporcionado');
        return false;
    }

    try {
        const phoneNumber = formatPhoneForWhatsApp(user.whatsapp);
        const expirationDate = new Date(user.expiresAt).toLocaleDateString('es-MX');

        const response = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'template',
                template: {
                    name: 'codigo_acceso_ec0301',
                    language: { code: 'es_MX' },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: user.name },
                                { type: 'text', text: user.accessCode },
                                { type: 'text', text: expirationDate }
                            ]
                        }
                    ]
                }
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`📱 WhatsApp enviado a: ${phoneNumber}`);
            return true;
        } else {
            // Si no hay template, enviar mensaje de texto simple
            console.log('⚠️ Template no encontrado, enviando mensaje de texto...');
            return await sendWhatsAppTextMessage(user, phoneNumber);
        }
    } catch (error) {
        console.error('❌ Error enviando WhatsApp:', error);
        return false;
    }
}

async function sendWhatsAppTextMessage(user, phoneNumber) {
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'text',
                text: {
                    body: `🎓 *SkillsCert EC0301*\n\n¡Hola ${user.name}!\n\nTu pago fue procesado exitosamente.\n\n🔑 *Tu código de acceso:*\n${user.accessCode}\n\n📅 Válido hasta: ${new Date(user.expiresAt).toLocaleDateString('es-MX')}\n\n🌐 Accede en:\n${FRONTEND_URL}\n\nGuarda este mensaje con tu código.`
                }
            })
        });

        if (response.ok) {
            console.log(`📱 WhatsApp (texto) enviado a: ${phoneNumber}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error enviando WhatsApp texto:', error);
        return false;
    }
}

// =====================================================
// RUTAS DE LA API
// =====================================================

app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'EC0301 GlobalSkillsCert API',
        version: '2.1.0',
        endpoints: {
            POST: ['/login', '/create-checkout', '/verify-payment'],
            GET: ['/health', '/user/:email']
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        services: {
            stripe: !!process.env.STRIPE_SECRET_KEY,
            postmark: !!process.env.POSTMARK_API_KEY,
            whatsapp: !!WHATSAPP_TOKEN
        }
    });
});

// =====================================================
// POST /create-checkout
// =====================================================
app.post('/create-checkout', async (req, res) => {
    try {
        const { name, email, whatsapp } = req.body;

        if (!name || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Nombre y correo electrónico son requeridos.' 
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Formato de correo electrónico inválido.' 
            });
        }

        console.log(`📝 Checkout: ${name} | ${email} | ${whatsapp || 'Sin WhatsApp'}`);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: email,
            line_items: [{
                price_data: {
                    currency: 'mxn',
                    product_data: {
                        name: 'Acceso SkillsCert EC0301',
                        description: 'Sistema completo - 90 días de acceso'
                    },
                    unit_amount: STRIPE_PRICE
                },
                quantity: 1
            }],
            metadata: {
                userName: name,
                userEmail: email,
                userWhatsapp: whatsapp || ''
            },
            success_url: `${FRONTEND_URL}/index.html?session_id={CHECKOUT_SESSION_ID}&status=success`,
            cancel_url: `${FRONTEND_URL}/index.html?canceled=true`
        });

        pendingPayments.set(session.id, {
            name, email, whatsapp: whatsapp || '', createdAt: new Date()
        });

        console.log(`✅ Sesión Stripe: ${session.id}`);
        res.json({ success: true, url: session.url, sessionId: session.id });

    } catch (error) {
        console.error('❌ Error create-checkout:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al crear sesión de pago.' 
        });
    }
});

// =====================================================
// POST /verify-payment
// =====================================================
app.post('/verify-payment', async (req, res) => {
    try {
        const { session_id } = req.body;

        if (!session_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Session ID requerido.' 
            });
        }

        console.log(`🔍 Verificando: ${session_id}`);

        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ 
                success: false, 
                message: 'Pago no completado.' 
            });
        }

        // Obtener datos del usuario
        const pendingData = pendingPayments.get(session_id);
        const userData = {
            name: pendingData?.name || session.metadata?.userName || 'Usuario',
            email: (pendingData?.email || session.customer_email || session.metadata?.userEmail).toLowerCase(),
            whatsapp: pendingData?.whatsapp || session.metadata?.userWhatsapp || ''
        };

        // Verificar si ya existe
        let user = users.get(userData.email);
        let isNewUser = false;
        
        if (!user) {
            isNewUser = true;
            const accessCode = generateAccessCode();
            user = {
                id: crypto.randomUUID(),
                name: userData.name,
                email: userData.email,
                whatsapp: userData.whatsapp,
                accessCode,
                stripeSessionId: session_id,
                createdAt: new Date(),
                expiresAt: getExpirationDate(),
                isActive: true
            };
            users.set(userData.email, user);
            console.log(`👤 Usuario creado: ${userData.email} | Código: ${accessCode}`);
        }

        // Enviar notificaciones solo para usuarios nuevos
        if (isNewUser) {
            // Enviar correo
            await sendWelcomeEmail(user);
            
            // Enviar WhatsApp
            if (user.whatsapp) {
                await sendWhatsAppMessage(user);
            }
        }

        // Crear token de sesión
        const token = generateToken();
        sessions.set(token, { email: user.email, createdAt: new Date() });

        // Limpiar pago pendiente
        pendingPayments.delete(session_id);

        console.log(`✅ Verificación completa: ${user.email}`);

        res.json({
            success: true,
            message: isNewUser ? 'Cuenta creada exitosamente.' : 'Bienvenido de nuevo.',
            token,
            user: {
                name: user.name,
                email: user.email,
                accessCode: user.accessCode,
                expiresAt: user.expiresAt
            }
        });

    } catch (error) {
        console.error('❌ Error verify-payment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar pago.' 
        });
    }
});

// =====================================================
// POST /login
// =====================================================
app.post('/login', (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ 
                success: false, 
                message: 'Correo y código requeridos.' 
            });
        }

        const user = users.get(email.toLowerCase().trim());

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Usuario no encontrado.' 
            });
        }

        if (user.accessCode !== code.trim()) {
            return res.status(401).json({ 
                success: false, 
                message: 'Código incorrecto.' 
            });
        }

        if (!user.isActive) {
            return res.status(403).json({ 
                success: false, 
                message: 'Cuenta desactivada.' 
            });
        }

        if (new Date() > new Date(user.expiresAt)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Acceso expirado.' 
            });
        }

        const token = generateToken();
        sessions.set(token, { email: user.email, createdAt: new Date() });

        console.log(`✅ Login: ${email}`);

        res.json({
            success: true,
            token,
            user: { name: user.name, email: user.email, expiresAt: user.expiresAt }
        });

    } catch (error) {
        console.error('❌ Error login:', error);
        res.status(500).json({ success: false, message: 'Error en login.' });
    }
});

// =====================================================
// 404 Handler
// =====================================================
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: `Endpoint no encontrado: ${req.method} ${req.path}` 
    });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================
app.listen(PORT, () => {
    console.log('═'.repeat(50));
    console.log('🚀 EC0301 GlobalSkillsCert Backend v2.1');
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌐 Frontend: ${FRONTEND_URL}`);
    console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓' : '✗'}`);
    console.log(`📧 Postmark: ${process.env.POSTMARK_API_KEY ? '✓' : '✗'}`);
    console.log(`📱 WhatsApp: ${WHATSAPP_TOKEN ? '✓' : '✗'}`);
    console.log('═'.repeat(50));
});
