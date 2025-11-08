/**
 * SkillsCert EC0301 - Sistema de Autenticación
 * Gestiona login, logout y sesiones de usuario (90 días)
 * @version 1.0
 */

const auth = (() => {
    const BACKEND_URL = 'https://ec0301-globalskillscert-backend.onrender.com';
    const SESSION_KEY = 'ec0301_session';
    const SESSION_DURATION = 90 * 24 * 60 * 60 * 1000; // 90 días en milisegundos

    /**
     * Verifica si el usuario está autenticado
     * @returns {Promise<boolean>}
     */
    async function isLoggedIn() {
        try {
            const session = getSession();
            
            if (!session) {
                return false;
            }

            // Verificar si la sesión ha expirado
            if (Date.now() > session.expiresAt) {
                console.log('Sesión expirada');
                await logout();
                return false;
            }

            // Verificar token con el backend
            const isValid = await validateTokenWithBackend(session.token);
            
            if (!isValid) {
                console.log('Token inválido en backend');
                await logout();
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            return false;
        }
    }

    /**
     * Obtiene la sesión actual del almacenamiento local
     * @returns {Object|null}
     */
    function getSession() {
        try {
            const sessionData = localStorage.getItem(SESSION_KEY);
            if (!sessionData) return null;

            const session = JSON.parse(sessionData);
            return session;
        } catch (error) {
            console.error('Error obteniendo sesión:', error);
            return null;
        }
    }

    /**
     * Guarda la sesión en localStorage
     * @param {Object} sessionData - Datos de la sesión
     */
    function saveSession(sessionData) {
        try {
            const session = {
                token: sessionData.token,
                user: sessionData.user,
                email: sessionData.email,
                accessCode: sessionData.accessCode,
                createdAt: Date.now(),
                expiresAt: Date.now() + SESSION_DURATION
            };

            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            console.log('✅ Sesión guardada exitosamente');
        } catch (error) {
            console.error('Error guardando sesión:', error);
            throw new Error('No se pudo guardar la sesión');
        }
    }

    /**
     * Valida el token con el backend
     * @param {string} token - JWT token
     * @returns {Promise<boolean>}
     */
    async function validateTokenWithBackend(token) {
        try {
            const response = await fetch(`${BACKEND_URL}/validate-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return data.valid === true;
        } catch (error) {
            console.error('Error validando token con backend:', error);
            return false;
        }
    }

    /**
     * Inicia sesión con código de acceso
     * @returns {Promise<boolean>}
     */
    async function login() {
        try {
            // Solicitar código al usuario
            const { value: accessCode } = await Swal.fire({
                title: 'Iniciar Sesión',
                html: `
                    <p style="margin-bottom: 1rem;">Ingresa el código de 6 dígitos que recibiste por WhatsApp y correo electrónico.</p>
                    <input id="accessCode" class="swal2-input" placeholder="Código de acceso" maxlength="6" pattern="[0-9]{6}" style="font-size: 1.5rem; text-align: center; letter-spacing: 0.5rem;">
                `,
                icon: 'info',
                confirmButtonText: 'Validar Código',
                confirmButtonColor: '#1E3A8A',
                showCancelButton: true,
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    const code = document.getElementById('accessCode').value;
                    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
                        Swal.showValidationMessage('El código debe tener exactamente 6 dígitos numéricos');
                        return false;
                    }
                    return code;
                }
            });

            if (!accessCode) {
                return false;
            }

            // Mostrar loading
            Swal.fire({
                title: 'Validando código...',
                html: 'Por favor espera',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Validar código con el backend
            const response = await fetch(`${BACKEND_URL}/validate-access-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accessCode })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Código inválido o expirado');
            }

            const data = await response.json();

            // Guardar sesión
            saveSession({
                token: data.token,
                user: data.user,
                email: data.email,
                accessCode: accessCode
            });

            // Mostrar éxito
            await Swal.fire({
                icon: 'success',
                title: '¡Bienvenido!',
                text: `Acceso concedido. Tu sesión es válida por 90 días.`,
                confirmButtonText: 'Continuar',
                confirmButtonColor: '#22C55E'
            });

            return true;
        } catch (error) {
            console.error('Error en login:', error);
            
            await Swal.fire({
                icon: 'error',
                title: 'Error de Autenticación',
                text: error.message || 'No se pudo validar el código. Verifica e intenta de nuevo.',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#EF4444'
            });

            return false;
        }
    }

    /**
     * Cierra la sesión del usuario
     * @returns {Promise<void>}
     */
    async function logout() {
        try {
            const session = getSession();
            
            // Notificar al backend (opcional)
            if (session && session.token) {
                try {
                    await fetch(`${BACKEND_URL}/logout`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.token}`
                        }
                    });
                } catch (error) {
                    console.warn('Error notificando logout al backend:', error);
                }
            }

            // Eliminar sesión local
            localStorage.removeItem(SESSION_KEY);
            console.log('✅ Sesión cerrada exitosamente');
        } catch (error) {
            console.error('Error en logout:', error);
        }
    }

    /**
     * Obtiene los datos del usuario actual
     * @returns {Promise<Object|null>}
     */
    async function getUser() {
        try {
            const session = getSession();
            
            if (!session) {
                return null;
            }

            return {
                email: session.email,
                user: session.user,
                accessCode: session.accessCode,
                expiresAt: new Date(session.expiresAt),
                createdAt: new Date(session.createdAt)
            };
        } catch (error) {
            console.error('Error obteniendo usuario:', error);
            return null;
        }
    }

    /**
     * Obtiene el token JWT actual
     * @returns {string|null}
     */
    function getToken() {
        const session = getSession();
        return session ? session.token : null;
    }

    /**
     * Refresca el token JWT
     * @returns {Promise<boolean>}
     */
    async function refreshToken() {
        try {
            const session = getSession();
            
            if (!session || !session.token) {
                return false;
            }

            const response = await fetch(`${BACKEND_URL}/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                }
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            
            // Actualizar token en la sesión
            session.token = data.token;
            session.expiresAt = Date.now() + SESSION_DURATION;
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));

            console.log('✅ Token refrescado exitosamente');
            return true;
        } catch (error) {
            console.error('Error refrescando token:', error);
            return false;
        }
    }

    // API pública
    return {
        isLoggedIn,
        login,
        logout,
        getUser,
        getToken,
        refreshToken,
        getSession
    };
})();

// Hacer disponible globalmente
window.auth = auth;

console.log('✅ Módulo auth.js cargado correctamente');
