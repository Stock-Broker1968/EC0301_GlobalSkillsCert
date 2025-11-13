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
            // Simplemente revisamos si el token existe.
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
            console.error('Auth: Error al obtener token.', e);
            return null;
        }
    }
    
    /**
     * Guarda el email del usuario en localStorage.
     * @param {string} email - El email del usuario.
     */
    function saveUserEmail(email) {
        try {
            localStorage.setItem('userEmail', email);
        } catch (e) {
            console.error('Auth: Error al guardar email.', e);
        }
    }
    
    /**
     * Obtiene el email del usuario guardado.
     * @returns {string|null} - El email o null si no existe.
     */
    function getUserEmail() {
        try {
            return localStorage.getItem('userEmail');
        } catch (e) {
            console.error('Auth: Error al obtener email.', e);
            return null;
        }
    }
    
    /**
     * Verifica si el token ha expirado (opcional).
     * @param {string} token - El token JWT a verificar.
     * @returns {boolean} - True si el token está expirado.
     */
    function isTokenExpired(token) {
        try {
            if (!token) return true;
            
            // Decodificar el payload del JWT (formato: header.payload.signature)
            const payload = JSON.parse(atob(token.split('.')[1]));
            
            // Verificar si tiene fecha de expiración
            if (!payload.exp) return false;
            
            // Comparar con el tiempo actual (en segundos)
            const currentTime = Math.floor(Date.now() / 1000);
            return payload.exp < currentTime;
        } catch (e) {
            console.error('Auth: Error al verificar expiración del token.', e);
            return true;
        }
    }
    
    /**
     * Valida la sesión actual y redirige si es necesario.
     * @param {string} redirectUrl - URL a la que redirigir si no está autenticado.
     */
    function validateSession(redirectUrl = 'index.html') {
        const token = getToken();
        
        if (!token || isTokenExpired(token)) {
            console.warn('Auth: Sesión inválida o expirada.');
            logout();
            window.location.href = redirectUrl;
            return false;
        }
        
        return true;
    }
    
    // Exponer la API pública
    return {
        login,
        logout,
        isLoggedIn,
        getToken,
        saveUserEmail,
        getUserEmail,
        isTokenExpired,
        validateSession
    };
})();

// Exportar para uso global
window.auth = auth;
