// === CÓDIGO PARA TU FRONTEND (ej: en un archivo script.js o dentro de <script> en tu HTML) ===

// 1. Reemplaza esto con tu Clave Publicable real de Stripe (modo prueba primero)
const stripePublicKey = 'pk_test_51SJ0gXFupe2fTa5zdrZlQfwpB1Y3esGAdUBw1r4Hc9vIerMj90cm0w4t6tJUJmVV7bEqZ3v5d11cqvPrFps4P31600xqM9IUsj'; // ¡Pega tu clave publicable aquí!
const backendUrl = 'https://generando-ec0301.onrender.com'; // URL de tu backend

// 2. Inicializa Stripe.js
const stripe = Stripe(stripePublicKey);

// 3. Busca el botón de pago en tu HTML
//    (Asegúrate de que tu botón tenga el id="checkout-button")
const checkoutButton = document.getElementById('checkout-button');

// 4. Añade el Event Listener (solo si el botón existe)
if (checkoutButton) {
  checkoutButton.addEventListener('click', async () => {
    // Deshabilitar botón para evitar clics múltiples
    checkoutButton.disabled = true;
    const originalButtonText = checkoutButton.textContent;
    checkoutButton.textContent = 'Procesando...';

    try {
      // 5. Llama a tu backend para crear la sesión de Checkout
      console.log('Solicitando sesión de Checkout al backend...');
      const response = await fetch(`${backendUrl}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Puedes añadir otros encabezados si tu backend los requiere (ej: autenticación)
        },
        // Si necesitas enviar datos (ej: ID de usuario o curso) al backend:
        // body: JSON.stringify({ userId: 'USER123', cursoId: 'EC0217' })
      });

      // 6. Verifica si la respuesta del backend fue exitosa
      if (!response.ok) {
        let errorMsg = 'No se pudo iniciar el proceso de pago.';
        try {
            // Intenta obtener un mensaje de error más específico del backend
            const errorData = await response.json();
            errorMsg = `Error del servidor (${response.status}): ${errorData.error || response.statusText}`;
        } catch (parseError) {
             // Si el backend no envió JSON, usa el estado HTTP
             errorMsg = `Error del servidor (${response.status}): ${response.statusText}`;
        }
        console.error('Error del backend:', errorMsg);
        throw new Error(errorMsg);
      }

      // 7. Obtiene la sesión (esperando { url: '...' } o { id: '...' })
      const session = await response.json();
      console.log('Sesión de Checkout recibida:', session);

      // 8. Verifica si se recibió el ID de la sesión (preferido) o la URL
      if (!session.id && !session.url) {
        console.error('Respuesta inesperada del backend. Falta id o url de sesión.');
        throw new Error('Respuesta inválida del servidor de pagos.');
      }

      // 9. Redirige al usuario a la página de pago de Stripe
      console.log('Redirigiendo a Stripe Checkout...');
      if (session.id) {
          // Método preferido usando Session ID
          const result = await stripe.redirectToCheckout({
            sessionId: session.id
          });

          // Si redirectToCheckout falla por un error del navegador/red (raro)
          if (result.error) {
            console.error('Error al redirigir a Stripe:', result.error);
            throw new Error(result.error.message);
          }
      } else {
          // Fallback si el backend solo devolvió la URL completa
          window.location.href = session.url;
      }


    } catch (error) {
      // 10. Manejo de errores (fetch, backend, Stripe)
      console.error('Error en el proceso de pago:', error);
      alert(`Hubo un problema al iniciar el pago: ${error.message}\nRevisa la consola para más detalles.`);
      // Volver a habilitar el botón si hubo un error
      checkoutButton.disabled = false;
      checkoutButton.textContent = originalButtonText; // Restaura texto original
    }
    // Nota: No se vuelve a habilitar el botón aquí si la redirección es exitosa,
    // porque el usuario ya habrá navegado fuera de la página.
  });

  console.log('Listener de pago añadido al botón #checkout-button.');

} else {
  console.error('¡Error! No se encontró el botón con id="checkout-button" en la página.');
  alert('Error de configuración: El botón de pago no está presente.');
}
