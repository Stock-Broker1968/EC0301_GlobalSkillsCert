// Interfaz/sistema_central/auth.js
// Módulo simple de autenticación basado en localStorage

const auth = (function () {
  'use strict';

  const TOKEN_KEY = 'authToken';

  // Decodifica el token base64 que genera el backend
  function decodeToken(token) {
    if (!token) return null;
    try {
      const json = atob(token);           // token → JSON
      const payload = JSON.parse(json);   // JSON → objeto
      return payload;
    } catch (e) {
      console.error('[AUTH] Error al decodificar token.', e);
      return null;
    }
  }

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
      if (typeof EC0301Manager !== 'undefined' && EC0301Manager) {
        EC0301Manager.clearData();
      }

      console.log('[AUTH] Sesión cerrada.');
      window.location.href = 'index.html';
    } catch (e) {
      console.error('[AUTH] Error al cerrar sesión.', e);
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

  // Devuelve { userId, email, exp } o null
  function getUser() {
    const token = getToken();
    const payload = decodeToken(token);
    if (!payload) return null;

    if (payload.exp && payload.exp < Date.now()) {
      console.warn('[AUTH] Token expirado.');
      return null;
    }
    return payload;
  }

  function isLoggedIn() {
    return !!getUser();
  }

  return {
    login,
    logout,
    isLoggedIn,
    getToken,
    getUser
  };
})();

window.auth = auth;
