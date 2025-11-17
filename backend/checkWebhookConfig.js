// checkWebhookConfig.js - Verificar configuración de webhooks de Stripe

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function checkWebhookConfig() {
    try {
        console.log('🔍 Verificando configuración de webhooks...');

        const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });

        if (endpoints.data.length === 0) {
            console.log('❌ No hay webhooks configurados');
            return;
        }

        console.log(`📋 Se encontraron ${endpoints.data.length} webhook(s):`);

        endpoints.data.forEach((endpoint, index) => {
            console.log(`\n${index + 1}. ${endpoint.description || 'Sin descripción'}`);
            console.log('   ID:', endpoint.id);
            console.log('   URL:', endpoint.url);
            console.log('   Status:', endpoint.status);
            console.log('   Eventos:', endpoint.enabled_events.length);
            console.log('   Creado:', new Date(endpoint.created * 1000).toLocaleString());
        });

    } catch (error) {
        console.error('❌ Error verificando webhooks:', error.message);
    }
}

// Ejecutar verificación
checkWebhookConfig();
