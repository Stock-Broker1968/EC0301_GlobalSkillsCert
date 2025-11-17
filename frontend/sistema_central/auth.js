// Interfaz/sistema_central/auth.js
// Módulo simple de autenticación basado en localStorage

const auth = (function () {
  'use strict';

  const TOKEN_KEY = 'authToken';

  function login(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      console.log('[AUTH] Sesión iniciada, token guardado.');
    } catch (e) {
      console.error('[AUTH] Error al guardar el token.', e);
    }
  }

  function logout() {
    try {
      // Borrar datos de sesión
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('userEmail');
      localStorage.removeItem('accessCode');

      // Limpiar datos del proyecto (si está disponible el manager)
      if (typeof EC0301Manager !== 'undefined') {
        EC0301Manager.clearData();
      }

      console.log('[AUTH] Sesión cerrada.');
      window.location.href = 'index.html';
    } catch (e) {
      console.error('[AUTH] Error al cerrar sesión.', e);
    }
  }

  function isLoggedIn() {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      return !!token;
    } catch (e) {
      console.error('[AUTH] Error al verificar token.', e);
      return false;
    }
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      console.error('[AUTH] Error al obtener token.', e);
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

window.auth = auth;
