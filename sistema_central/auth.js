/**
 * Sistema de Autenticación para SkillsCert EC0301
 * Maneja login, sesiones y verificación de usuarios
 * @version 2.0.0
 */

const auth = (function() {
    'use strict';

    // ==================== CONFIGURACIÓN ====================
    const CONFIG = {
        STORAGE_KEY: 'ec0301_auth_token',
        USER_KEY: 'ec0301_user_data',
        SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 horas
        BACKEND_URL: 'https://ec0301-globalskillscert-backend.onrender.com',
        CODE_LENGTH: 6,
        MAX_LOGIN_ATTEMPTS: 5,
        LOCKOUT_DURATION: 15 * 60 * 1000 // 15 minutos
    };

    // ==================== ESTADO INTERNO ====================
    let currentUser = null;
    let authToken = null;
    let sessionTimer = null;
    let loginAttempts = 0;
    let lockoutUntil = null;

    // ==================== INICIALIZACIÓN ====================
    function init() {
        console.log('[Auth] Inicializando sistema de autenticación...');
        loadSession();
        setupSessionMonitoring();
        console.log('[Auth] Sistema de autenticación inicializado');
    }

    // ==================== GESTIÓN DE SESIÓN ====================
    function loadSession() {
        try {
            const token = localStorage.getItem(CONFIG.STORAGE_KEY);
            const userData = localStorage.getItem(CONFIG.USER_KEY);
            
            if (token && userData) {
                const user = JSON.parse(userData);
                
                // Verificar expiración
                if (user.expiresAt && user.expiresAt > Date.now()) {
                    authToken = token;
                    currentUser = user;
                    console.log('[Auth] Sesión restaurada para:', user.email);
                    return true;
                } else {
                    console.log('[Auth] Sesión expirada');
                    clearSession();
                }
            }
            return false;
        } catch (error) {
            console.error('[Auth] Error cargando sesión:', error);
            clearSession();
            return false;
        }
    }

    function saveSession(token, user) {
        try {
            const sessionData = {
                ...user,
                loginTime: Date.now(),
                expiresAt: Date.now() + CONFIG.SESSION_DURATION
            };
            
            localStorage.setItem(CONFIG.STORAGE_KEY, token);
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(sessionData));
            
            authToken = token;
            currentUser = sessionData;
            
            console.log('[Auth] Sesión guardada exitosamente');
            return true;
        } catch (error) {
            console.error('[Auth] Error guardando sesión:', error);
            return false;
        }
    }

    function clearSession() {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        authToken = null;
        currentUser = null;
        
        if (sessionTimer) {
            clearInterval(sessionTimer);
            sessionTimer = null;
        }
        
        console.log('[Auth] Sesión limpiada');
    }

    function setupSessionMonitoring() {
        // Verificar sesión cada 5 minutos
        sessionTimer = setInterval(() => {
            if (currentUser && currentUser.expiresAt) {
                if (currentUser.expiresAt < Date.now()) {
                    console.log('[Auth] Sesión expirada automáticamente');
                    logout();
                    window.location.reload();
                }
            }
        }, 5 * 60 * 1000);
    }

    // ==================== AUTENTICACIÓN ====================
    async function login() {
        try {
            // Verificar lockout
            if (isLockedOut()) {
                const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 60000);
                throw new Error(`Demasiados intentos fallidos. Intenta nuevamente en ${remainingTime} minutos.`);
            }

            // Solicitar código de acceso
            const result = await Swal.fire({
                title: 'Iniciar Sesión',
                html: `
                    <div style="text-align: left;">
                        <p style="margin-bottom: 1rem;">Ingresa el código de acceso que recibiste por WhatsApp:</p>
                        <input id="loginCode" type="text" class="swal2-input" 
                               placeholder="Código de 6 dígitos" 
                               maxlength="6" 
                               style="font-size: 1.5rem; text-align: center; letter-spacing: 0.5rem;"
                               autocomplete="off">
                        <p style="font-size: 0.9rem; color: #6B7280; margin-top: 1rem;">
                            <i class="fa-solid fa-info-circle"></i> Si no tienes un código, debes realizar el pago primero.
                        </p>
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Iniciar Sesión',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#1E3A8A',
                preConfirm: () => {
                    const code = document.getElementById('loginCode').value.trim();
                    
                    if (!code) {
                        Swal.showValidationMessage('Por favor ingresa el código');
                        return false;
                    }
                    
                    if (code.length !== CONFIG.CODE_LENGTH) {
                        Swal.showValidationMessage(`El código debe tener ${CONFIG.CODE_LENGTH} dígitos`);
                        return false;
                    }
                    
                    if (!/^\d+$/.test(code)) {
                        Swal.showValidationMessage('El código solo debe contener números');
                        return false;
                    }
                    
                    return code;
                },
                allowOutsideClick: false
            });

            if (result.isConfirmed && result.value) {
                const code = result.value;
                
                // Mostrar indicador de carga
                Swal.fire({
                    title: 'Verificando...',
                    text: 'Por favor espera',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                // Verificar código con el backend
                const loginResult = await verifyLoginCode(code);
                
                if (loginResult.success) {
                    // Guardar sesión
                    saveSession(loginResult.token, loginResult.user);
                    
                    // Resetear intentos fallidos
                    loginAttempts = 0;
                    lockoutUntil = null;
                    
                    await Swal.fire({
                        icon: 'success',
                        title: '¡Bienvenido!',
                        text: `Sesión iniciada como ${loginResult.user.email}`,
                        timer: 2000,
                        showConfirmButton: false
                    });
                    
                    console.log('[Auth] Login exitoso');
                    return true;
                } else {
                    throw new Error(loginResult.message || 'Código inválido');
                }
            }
            
            return false;
        } catch (error) {
            console.error('[Auth] Error en login:', error);
            
            // Incrementar intentos fallidos
            loginAttempts++;
            
            if (loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                lockoutUntil = Date.now() + CONFIG.LOCKOUT_DURATION;
            }
            
            await Swal.fire({
                icon: 'error',
                title: 'Error de Autenticación',
                text: error.message || 'No se pudo iniciar sesión',
                confirmButtonColor: '#EF4444'
            });
            
            return false;
        }
    }

    async function verifyLoginCode(code) {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/auth/verify-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ code })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.token || !data.user) {
                throw new Error('Respuesta inválida del servidor');
            }

            return {
                success: true,
                token: data.token,
                user: {
                    email: data.user.email,
                    name: data.user.name || data.user.email,
                    userId: data.user.id,
                    hasAccess: true
                }
            };
        } catch (error) {
            console.error('[Auth] Error verificando código:', error);
            
            // Modo demo/fallback para desarrollo (REMOVER EN PRODUCCIÓN)
            if (code === '123456') {
                console.warn('[Auth] Usando modo DEMO - REMOVER EN PRODUCCIÓN');
                return {
                    success: true,
                    token: 'demo_token_' + Date.now(),
                    user: {
                        email: 'demo@skillscert.com',
                        name: 'Usuario Demo',
                        userId: 'demo-' + Date.now(),
                        hasAccess: true,
                        isDemoMode: true
                    }
                };
            }
            
            return {
                success: false,
                message: error.message || 'Código inválido o expirado'
            };
        }
    }

    async function logout() {
        try {
            // Intentar notificar al backend
            if (authToken) {
                try {
                    await fetch(`${CONFIG.BACKEND_URL}/api/auth/logout`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                } catch (error) {
                    console.warn('[Auth] No se pudo notificar logout al backend:', error);
                }
            }

            clearSession();
            console.log('[Auth] Logout exitoso');
            return true;
        } catch (error) {
            console.error('[Auth] Error en logout:', error);
            clearSession(); // Limpiar sesión de todas formas
            return false;
        }
    }

    // ==================== VERIFICACIÓN ====================
    async function isLoggedIn() {
        if (!authToken || !currentUser) {
            return false;
        }

        // Verificar expiración local
        if (currentUser.expiresAt && currentUser.expiresAt < Date.now()) {
            console.log('[Auth] Sesión expirada');
            clearSession();
            return false;
        }

        return true;
    }

    async function getUser() {
        if (await isLoggedIn()) {
            return { ...currentUser };
        }
        return null;
    }

    function getToken() {
        return authToken;
    }

    function isLockedOut() {
        if (lockoutUntil && lockoutUntil > Date.now()) {
            return true;
        }
        if (lockoutUntil && lockoutUntil <= Date.now()) {
            // Limpiar lockout si ya expiró
            lockoutUntil = null;
            loginAttempts = 0;
        }
        return false;
    }

    // ==================== UTILIDADES ====================
    function requireAuth(callback) {
        return async function(...args) {
            if (await isLoggedIn()) {
                return callback.apply(this, args);
            } else {
                console.warn('[Auth] Acción requiere autenticación');
                const loginSuccess = await login();
                if (loginSuccess) {
                    return callback.apply(this, args);
                }
                throw new Error('Autenticación requerida');
            }
        };
    }

    async function refreshToken() {
        try {
            if (!authToken) {
                throw new Error('No hay sesión activa');
            }

            const response = await fetch(`${CONFIG.BACKEND_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('No se pudo renovar la sesión');
            }

            const data = await response.json();
            
            if (data.token) {
                saveSession(data.token, currentUser);
                console.log('[Auth] Token renovado exitosamente');
                return true;
            }

            return false;
        } catch (error) {
            console.error('[Auth] Error renovando token:', error);
            return false;
        }
    }

    // ==================== INTERCEPTOR FETCH ====================
    function setupAuthInterceptor() {
        const originalFetch = window.fetch;
        
        window.fetch = async function(...args) {
            const [url, options = {}] = args;
            
            // Agregar token automáticamente a requests del backend
            if (typeof url === 'string' && url.includes(CONFIG.BACKEND_URL)) {
                if (authToken) {
                    options.headers = {
                        ...options.headers,
                        'Authorization': `Bearer ${authToken}`
                    };
                }
            }
            
            try {
                const response = await originalFetch(url, options);
                
                // Manejar 401 Unauthorized
                if (response.status === 401) {
                    console.warn('[Auth] Token inválido o expirado');
                    clearSession();
                    
                    // Opcional: redirigir o mostrar mensaje
                    if (!window.location.pathname.includes('index.html')) {
                        window.location.href = '/index.html';
                    }
                }
                
                return response;
            } catch (error) {
                console.error('[Auth] Error en request:', error);
                throw error;
            }
        };
        
        console.log('[Auth] Interceptor de autenticación configurado');
    }

    // ==================== API PÚBLICA ====================
    const publicAPI = {
        init,
        login,
        logout,
        isLoggedIn,
        getUser,
        getToken,
        requireAuth,
        refreshToken,
        get isAuthenticated() {
            return !!authToken && !!currentUser;
        }
    };

    // Auto-inicialización
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            setupAuthInterceptor();
        });
    } else {
        init();
        setupAuthInterceptor();
    }

    return publicAPI;
})();

// Exportar para uso global
window.auth = auth;
