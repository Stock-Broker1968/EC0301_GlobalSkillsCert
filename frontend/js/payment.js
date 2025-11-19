// ============================================================
// payment.js - Gestión de Pagos con Stripe
// ============================================================
// Este módulo maneja:
// ✅ Creación de sesiones de Stripe
// ✅ Validación robusta de JSON
// ✅ Generación de códigos de acceso
// ✅ Notificación por Email + WhatsApp
// ============================================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bcrypt = require('bcryptjs');
const { dbPool, sendEmailWithPostmark, sendWhatsAppMessage } = require('./helpers');

// ============================================================
// FUNCIÓN: Crear sesión de pago Stripe
// ============================================================
async function createCheckoutSession(req, res) {
  try {
    // 🔍 Validar que el email esté presente
    const { email, courseName, amount } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        error: 'Email inválido o no proporcionado.',
        code: 'INVALID_EMAIL'
      });
    }

    // Valores por defecto
    const courseTitle = courseName || 'Acceso Plataforma Generando EC0301';
    const priceInCents = (amount || 500) * 100; // Convertir a centavos

    // ✅ Crear sesión de Stripe con manejo robusto
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'oxxo'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: courseTitle,
              description: 'Acceso completo por 30 días a materiales, evaluaciones y certificación',
              images: ['https://ec0301-globalskillscert.onrender.com/logo.png'] // Cambia a tu URL
            },
            unit_amount: priceInCents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      billing_address_collection: 'required',
      customer_creation: 'always',
      customer_email: email,
      phone_number_collection: { enabled: true },
      success_url: `${process.env.FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/index.html`,
      payment_method_options: {
        oxxo: { expires_after_days: 3 },
        card: { installments: { enabled: true } }
      },
      metadata: {
        email: email,
        course: courseName
      }
    });

    console.log(`✅ Sesión de Checkout creada: ${session.id}`);

    // ✅ Enviar respuesta JSON correctamente formateada
    return res.status(200).json({
      id: session.id,
      url: session.url,
      status: 'success'
    });

  } catch (error) {
    console.error('❌ Error creando sesión de Stripe:', error.message);
    
    // Enviar respuesta de error JSON estructurada
    return res.status(500).json({
      error: 'No se pudo iniciar el proceso de pago.',
      details: error.message,
      code: 'STRIPE_ERROR'
    });
  }
}

// ============================================================
// FUNCIÓN: Webhook de Stripe (Pago completado)
// ============================================================
async function handleStripeWebhook(event) {
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log(`🛒 Pago completado para sesión: ${session.id}`);

      // 📧 Datos del cliente
      const customerDetails = session.customer_details || {};
      const email = customerDetails.email;
      const phone = customerDetails.phone;
      const customerName = customerDetails.name || 'Usuario';

      if (!email) {
        throw new Error('No se proporcionó email en el pago.');
      }

      // 🔐 Generar código de acceso de 6 dígitos
      const accessCode = Math.random().toString().substring(2, 8);
      const hashedCode = await bcrypt.hash(accessCode, 10);

      // 💾 Guardar en base de datos
      const [dbResult] = await dbPool.execute(
        `INSERT INTO access_codes (code_hash, email, phone, stripe_session_id, expires_at, created_at, is_used) 
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), 0)`,
        [hashedCode, email, phone || null, session.id]
      );

      console.log(`✅ Código guardado en BD con ID: ${dbResult.insertId}`);

      // 📧 Enviar EMAIL
      const emailSubject = '🎉 Tu código de acceso a SkillsCert EC0301';
      const emailBody = `Hola ${customerName},

¡Gracias por tu pago!

Tu código de acceso a la plataforma Generando EC0301 es:

${accessCode}

Este código es válido por 30 días. Cada código puede usarse una sola vez.

Ingresa en: ${process.env.FRONTEND_URL}

¿Necesitas ayuda? Responde a este email o contáctanos por WhatsApp.

¡Éxito en tu certificación! 🚀

Equipo SkillsCert`;

      await sendEmailWithPostmark(email, emailSubject, emailBody);

      // 📱 Enviar WHATSAPP (si hay teléfono)
      if (phone) {
        const whatsappMessage = `¡Hola ${customerName}! 🎉

Gracias por tu pago. Tu código de acceso a la plataforma Generando EC0301 es:

*${accessCode}*

Válido por 30 días.
Ingresa en: ${process.env.FRONTEND_URL}

¡Éxito! 🚀`;

        await sendWhatsAppMessage(phone, whatsappMessage);
      }

      console.log(`✅ Notificaciones enviadas exitosamente a ${email}`);

      return { success: true, message: 'Pago procesado correctamente' };
    }

  } catch (error) {
    console.error(`❌ Error en webhook:`, error.message);
    
    // Notificar al admin por email
    try {
      await sendEmailWithPostmark(
        process.env.POSTMARK_ALERT_EMAIL,
        '⚠️ Error en webhook de pago',
        `Error procesando pago:\n\n${error.message}\n\nStack:\n${error.stack}`
      );
    } catch (alertError) {
      console.error('❌ No se pudo enviar alerta al admin:', alertError.message);
    }

    throw error;
  }
}

// ============================================================
// FUNCIÓN: Obtener estado de sesión de pago
// ============================================================
async function getCheckoutSessionStatus(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        error: 'ID de sesión no proporcionado',
        code: 'MISSING_SESSION_ID'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return res.status(200).json({
      id: session.id,
      status: session.payment_status, // "paid", "unpaid", "no_payment_required"
      email: session.customer_email,
      paymentMethod: session.payment_method_types[0],
      totalAmount: session.amount_total / 100, // Convertir de centavos
      currency: session.currency.toUpperCase(),
      createdAt: new Date(session.created * 1000)
    });

  } catch (error) {
    console.error('❌ Error obteniendo estado de sesión:', error.message);
    return res.status(500).json({
      error: 'No se pudo obtener el estado de la sesión',
      code: 'SESSION_FETCH_ERROR'
    });
  }
}

// ============================================================
// EXPORTAR FUNCIONES
// ============================================================
module.exports = {
  createCheckoutSession,
  handleStripeWebhook,
  getCheckoutSessionStatus
};
