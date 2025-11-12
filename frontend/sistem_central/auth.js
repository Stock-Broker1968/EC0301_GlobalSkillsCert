/**
 * auth.js
 * Maneja la autenticación del usuario y el token de sesión.
 */
const auth = (function() {
    'use strict';

    const TOKEN_KEY = 'authToken';

    /**
     * Guarda el token de sesión en localStorage.
     * @param {string} token - El token recibido del backend.
     */
    function login(token) {
        try {
            localStorage.setItem(TOKEN_KEY, token);
            console.log('Auth: Sesión iniciada.');
        } catch (e) {
            console.error('Auth: Error al guardar el token.', e);
        }
    }

    /**
     * Limpia la sesión del usuario de localStorage.
     */
    function logout() {
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('userEmail');
            localStorage.removeItem('accessCode');
            // Limpia también el Data Manager
            if (typeof EC0301Manager !== 'undefined') {
                EC0301Manager.clearData();
            }
            console.log('Auth: Sesión cerrada.');
            window.location.href = 'index.html'; // Redirige a la página de login
        } catch (e) {
            console.error('Auth: Error al cerrar sesión.', e);
        }
    }

    /**
     * Verifica si hay un token de sesión válido.
     * @returns {boolean} - True si el usuario está logueado.
     */
    function isLoggedIn() {
        try {
            const token = localStorage.getItem(TOKEN_KEY);
            // Por ahora, solo revisamos si el token existe.
            // Una app más avanzada verificaría este token contra el backend.
            return !!token; 
        } catch (e) {
            console.error('Auth: Error al verificar token.', e);
            return false;
        }
    }

    /**
     * Obtiene el token de sesión actual.
     * @returns {string|null} - El token o null si no existe.
     */
    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch (e) {
            return null;
        }
    }

    // Exponer la API pública
    return {
        login,
        logout,
        isLoggedIn,
        getToken
    };

})();

// Exportar para uso global
window.auth = auth;
