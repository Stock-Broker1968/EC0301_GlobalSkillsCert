// Interfaz/js/script.js
(function () {
  'use strict';

  // 1. Clave publicable de Stripe (usa la de prueba o la live según estés)
  const stripePublicKey = 'pk_test_51SJ0gXFupe2fTa5zdrZlQfwpB1Y3esGAdUBw1r4Hc9vIerMj90cm0w4t6tJUJmVV7bEqZ3v5d11cqvPrFps4P31600xqM9IUsj';

  // 2. URL pública del backend en Render (servicio Node)
  const backendUrl = 'https://ec0301-globalskillscert-backend.onrender.com';

  // 3. Inicializa Stripe.js (asegúrate de tener <script src="https://js.stripe.com/v3"></script> EN EL HTML)
  const stripe = Stripe(stripePublicKey);

  window.addEventListener('DOMContentLoaded', () => {
    // 4. Botón de pago
    const checkoutButton = document.getElementById('checkout-button');

    if (!checkoutButton) {
      console.error('No se encontró el botón con id="checkout-button"');
      return;
    }

    checkoutButton.addEventListener('click', async (event) => {
      event.preventDefault();

      // 5. Leer datos del formulario
      const email  = document.getElementById('pago-email')?.value.trim();
      const name   = document.getElementById('pago-nombre')?.value.trim();
      const phone  = document.getElementById('pago-telefono')?.value.trim();

      if (!email) {
        alert('Por favor escribe tu correo electrónico. Ahí te enviaremos tu acceso.');
        return;
      }

      // Deshabilitar botón mientras se procesa
      checkoutButton.disabled = true;
      const originalText = checkoutButton.textContent;
      checkoutButton.textContent = 'Procesando...';

      try {
        // 6. Llamar a tu backend para crear la sesión de pago
        console.log('Solicitando sesión de Checkout al backend...');
        const response = await fetch(`${backendUrl}/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, name, phone })
        });

        if (!response.ok) {
          let errorMsg = `Error del servidor (${response.status})`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMsg += `: ${errorData.error}`;
            }
          } catch (_) {
            // si no hay JSON, dejamos el mensaje base
          }
          console.error('Error del backend:', errorMsg);
          throw new Error(errorMsg);
        }

        const session = await response.json();
        console.log('Sesión de Checkout recibida:', session);

        // 7. Validar respuesta
        if (!session.id && !session.url) {
          console.error('Respuesta inesperada del backend. Falta id o url de sesión.');
          throw new Error('Respuesta inválida del servidor de pagos.');
        }

        // 8. Redirigir a Stripe Checkout
        console.log('Redirigiendo a Stripe Checkout...');
        if (session.id) {
          const result = await stripe.redirectToCheckout({
            sessionId: session.id
          });
          if (result.error) {
            console.error('Error al redirigir a Stripe:', result.error);
            throw new Error(result.error.message);
          }
        } else {
          window.location.href = session.url;
        }

        // Si la redirección funciona, el usuario se va de la página aquí mismo

      } catch (error) {
        console.error('Error en el proceso de pago:', error);
        alert(`Hubo un problema al iniciar el pago: ${error.message}`);
        checkoutButton.disabled = false;
        checkoutButton.textContent = originalText;
      }
    });

    console.log('Listener de pago añadido al botón #checkout-button.');
  });
})();
