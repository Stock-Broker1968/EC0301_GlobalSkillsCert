/**
 * auth.js
 * Maneja la autenticación del usuario y el token de sesión.
 */
const auth = (function() {
    'use strict';

    const TOKEN_KEY = 'authToken';
    const EXPIRATION_KEY = 'authTokenExpiration'; // Añadimos un control de expiración

    function login(token, expirationTime) {
        try {
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(EXPIRATION_KEY, expirationTime); // Guardamos la fecha de expiración
            console.log('Auth: Sesión iniciada.');
        } catch (e) {
            console.error('Auth: Error al guardar el token.', e);
        }
    }

    function logout() {
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(EXPIRATION_KEY);
            console.log('Auth: Sesión cerrada.');
            window.location.href = 'index.html';
        } catch (e) {
            console.error('Auth: Error al cerrar sesión.', e);
        }
    }

    function isLoggedIn() {
        try {
            const token = localStorage.getItem(TOKEN_KEY);
            const expirationTime = localStorage.getItem(EXPIRATION_KEY);
            const currentTime = Date.now();
            if (token && expirationTime && currentTime < expirationTime) {
                return true; // Si el token existe y no ha expirado
            }
            logout(); // Si el token ha expirado, cerramos sesión
            return false;
        } catch (e) {
            console.error('Auth: Error al verificar token.', e);
            return false;
        }
    }

    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch (e) {
            return null;
        }
    }

    return {
        login,
        logout,
        isLoggedIn,
        getToken
    };

})();
