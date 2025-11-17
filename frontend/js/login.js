// Interfaz/js/login.js
(function () {
  'use strict';

  const STRIPE_PUBLIC_KEY = 'pk_test_51SJ0gXFupe2fTa5zdrZlQfwpB1Y3esGAdUBw1r4Hc9vIerMj90cm0w4t6tJUJmVV7bEqZ3v5d11cqvPrFps4P31600xqM9IUsj';
  const BACKEND_URL = 'https://ec0301-globalskillscert-backend.onrender.com';

  let stripe = null;

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[INDEX] DOMContentLoaded');

    // Inicializar Stripe si está disponible
    if (typeof Stripe !== 'undefined') {
      stripe = Stripe(STRIPE_PUBLIC_KEY);
      console.log('[INDEX] Stripe inicializado');
    } else {
      console.error('[INDEX] Stripe.js no está disponible');
    }

    // Verificar si venimos de Stripe con session_id en la URL
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (sessionId) {
      console.log('[INDEX] session_id detectado en la URL, verificando pago...');
      verifyPayment(sessionId);
    }
  });

  // --------------------------
  // Cambio de pestañas
  // --------------------------
  function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab');
    const forms = document.querySelectorAll('.form-content');

    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));

    if (tab === 'login') {
      if (tabs[0]) tabs[0].classList.add('active');
      const loginForm = document.getElementById('loginForm');
      if (loginForm) loginForm.classList.add('active');
    } else {
      if (tabs[1]) tabs[1].classList.add('active');
      const registerForm = document.getElementById('registerForm');
      if (registerForm) registerForm.classList.add('active');
    }
  }

  // --------------------------
  // LOGIN
  // --------------------------
  async function handleLogin(event) {
    if (event) event.preventDefault();

    const emailInput = document.getElementById('loginEmail');
    const codeInput = document.getElementById('loginCode');

    if (!emailInput || !codeInput) {
      console.error('[LOGIN] No se encontraron inputs de login');
      return;
    }

    const email = emailInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();

    if (!email || !code) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Ingresa tu correo y tu código de acceso.'
      });
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessCode: code })
      });

      const data = await response.json();
      console.log('[LOGIN] Respuesta:', data);

      if (data.success) {
        // Guardar sesión usando auth.js
        if (typeof auth !== 'undefined') {
          auth.login(data.token);
          localStorage.setItem('userEmail', email);
        } else {
          // Fallback en caso de que algo pasara con auth.js
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('userEmail', email);
        }

        await Swal.fire({
          icon: 'success',
          title: '¡Bienvenido!',
          text: 'Acceso concedido. Redirigiendo a la plataforma...',
          timer: 1800,
          showConfirmButton: false
        });

        window.location.href = 'acceso.html';
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error de acceso',
          text: data.error || 'Credenciales inválidas'
        });
      }
    } catch (error) {
      console.error('[LOGIN] Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo conectar con el servidor. Intenta nuevamente.'
      });
    }
  }

  // --------------------------
  // PAGO CON STRIPE
  // --------------------------
  async function handlePayment(event) {
    if (event) event.preventDefault();

    const button = document.getElementById('payButton');
    if (!button) {
      console.error('[PAGO] No se encontró el botón de pago');
      return;
    }

    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    button.disabled = true;

    const name = (document.getElementById('registerName') || {}).value || '';
    const email = (document.getElementById('registerEmail') || {}).value || '';
    const phone = (document.getElementById('registerPhone') || {}).value || '';

    if (!email) {
      Swal.fire({
        icon: 'warning',
        title: 'Correo requerido',
        text: 'Ingresa tu correo electrónico para continuar.'
      });
      button.innerHTML = originalText;
      button.disabled = false;
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone })
      });

      if (!response.ok) {
        let msg = 'Error al crear sesión de pago';
        try {
          const err = await response.json();
          msg = err.error || msg;
        } catch (e) {
          // ignorar
        }
        throw new Error(msg);
      }

      const session = await response.json();
      console.log('[PAGO] Sesión creada:', session);

      if (!stripe) {
        throw new Error('Stripe no está inicializado en el navegador.');
      }

      if (session.id) {
        const result = await stripe.redirectToCheckout({ sessionId: session.id });
        if (result.error) {
          throw new Error(result.error.message);
        }
      } else if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error('Respuesta inválida del servidor de pagos.');
      }

    } catch (error) {
      console.error('[PAGO] Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error de pago',
        text: error.message || 'No se pudo iniciar el pago. Intenta nuevamente.'
      });
      button.innerHTML = originalText;
      button.disabled = false;
    }
  }

  // --------------------------
  // VERIFICAR PAGO STRIPE
  // --------------------------
  async function verifyPayment(sessionId) {
    try {
      const response = await fetch(`${BACKEND_URL}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      console.log('[VERIFY PAYMENT] Respuesta:', data);

      if (data.success) {
        // Mostrar modal con el código
        const codeBox = document.getElementById('displayCode');
        const modal = document.getElementById('successModal');

        if (codeBox && modal) {
          codeBox.textContent = data.accessCode;
          modal.classList.add('active');
        }

        // Prellenar formulario de login
        const emailInput = document.getElementById('loginEmail');
        const codeInput = document.getElementById('loginCode');
        if (emailInput) emailInput.value = data.email || '';
        if (codeInput) codeInput.value = data.accessCode || '';
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al verificar pago',
          text: data.error || 'No se pudo verificar el pago.'
        });
      }
    } catch (error) {
      console.error('[VERIFY PAYMENT] Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo verificar el pago. Si el cargo se realizó, contacta a soporte.'
      });
    }
  }

  // --------------------------
  // Pago con transferencia
  // --------------------------
  async function payWithTransfer() {
    await Swal.fire({
      title: 'Pago por Transferencia',
      html: `
        <div style="text-align: left;">
          <h3>Datos Bancarios:</h3>
          <p><strong>Banco:</strong> BBVA</p>
          <p><strong>Cuenta:</strong> 0123456789</p>
          <p><strong>CLABE:</strong> 012180001234567890</p>
          <p><strong>Beneficiario:</strong> SkillsCert EC0301</p>
          <hr>
          <p style="margin-top: 1rem;">Envía tu comprobante a:</p>
          <p><strong>WhatsApp:</strong> +52 55 3882 2334</p>
          <p><strong>Email:</strong> info@skillscert.com</p>
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#6366f1'
    });
  }

  // --------------------------
  // Modal: ir a login
  // --------------------------
  function closeModalAndLogin() {
    const modal = document.getElementById('successModal');
    if (modal) modal.classList.remove('active');
    switchTab('login');
  }

  // Exponer funciones globales para uso en el HTML (onsubmit / onclick)
  window.switchTab = switchTab;
  window.handleLogin = handleLogin;
  window.handlePayment = handlePayment;
  window.payWithTransfer = payWithTransfer;
  window.closeModalAndLogin = closeModalAndLogin;
})();
