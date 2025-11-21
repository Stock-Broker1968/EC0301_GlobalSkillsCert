// sistema_central/payment.js
// Gestión de pagos (Frontend) - Conectado correctamente a index.html y Backend

const PAYMENT_API_URL = 'https://ec0301-globalskillscert-backend.onrender.com';

const payment = {
    // Función principal llamada desde index.html
    startCheckout: async (email, nombre, telefono) => {
        try {
            // 1. Feedback visual inmediato
            Swal.fire({
                title: 'Conectando con Stripe...',
                text: 'Estamos preparando tu pago seguro.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            console.log("Iniciando pago para:", email);

            // 2. Petición al Backend
            const response = await fetch(`${PAYMENT_API_URL}/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: email,
                    nombre: nombre,
                    telefono: telefono,
                    courseName: 'Certificación EC0301' // Nombre del producto
                })
            });

            const data = await response.json();
            console.log("Respuesta del servidor:", data);

            // 3. Validación flexible (Funciona con tu backend actual)
            // Tu backend devuelve { url: '...', ... }
            if (data.url) {
                window.location.href = data.url; // Redirigir a Stripe
            } else {
                console.error('Error: El servidor no devolvió una URL.', data);
                throw new Error(data.error || 'No se recibió el enlace de pago');
            }

        } catch (error) {
            console.error('Error crítico en pago:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de conexión',
                text: 'No se pudo conectar con el servidor de pagos. Revisa tu internet e intenta de nuevo.'
            });
        }
    }
};

// Exponer globalmente
window.payment = payment;
