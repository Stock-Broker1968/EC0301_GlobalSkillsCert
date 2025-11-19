// Interfaz/auth.js
// Módulo simple de autenticación basado en localStorage

(function () {
  'use strict';

  const TOKEN_KEY = 'authToken';
  const USER_EMAIL_KEY = 'userEmail';
  const ACCESS_CODE_KEY = 'accessCode';

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('[AUTH] Error leyendo localStorage', e);
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('[AUTH] Error escribiendo localStorage', e);
    }
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('[AUTH] Error borrando localStorage', e);
    }
  }

  function parseToken(token) {
    if (!token) return null;
    try {
      const json = atob(token);
      return JSON.parse(json);
    } catch (e) {
      console.warn('[AUTH] Token inválido', e);
      return null;
    }
  }

  function login(token, email, accessCode) {
    if (token) safeSet(TOKEN_KEY, token);
    if (email) safeSet(USER_EMAIL_KEY, email);
    if (accessCode) safeSet(ACCESS_CODE_KEY, accessCode);
    console.log('[AUTH] Sesión iniciada.');
  }

  function logout() {
    safeRemove(TOKEN_KEY);
    safeRemove(USER_EMAIL_KEY);
    safeRemove(ACCESS_CODE_KEY);

    // Borrar datos del proyecto si existe el manager
    if (typeof EC0301Manager !== 'undefined') {
      try {
        EC0301Manager.clearData();
      } catch (e) {
        console.error('[AUTH] Error al limpiar datos del proyecto', e);
      }
    }

    console.log('[AUTH] Sesión cerrada.');
    // Regresar a la pantalla de inicio
    window.location.href = 'index.html';
  }

  function isLoggedIn() {
    const token = safeGet(TOKEN_KEY);
    if (!token) return false;

    const payload = parseToken(token);
    if (!payload) return false;

    if (payload.exp && Date.now() > payload.exp) {
      console.warn('[AUTH] Sesión expirada.');
      return false;
    }

    return true;
  }

  function getToken() {
    return safeGet(TOKEN_KEY);
  }

  function getSession() {
    const token = safeGet(TOKEN_KEY);
    return parseToken(token);
  }

  function getUserEmail() {
    return safeGet(USER_EMAIL_KEY);
  }

  function getAccessCode() {
    return safeGet(ACCESS_CODE_KEY);
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      console.warn('[AUTH] Usuario no autenticado, redirigiendo a index.html');
      window.location.href = 'index.html';
    }
  }

  // Modal súper simple para errores críticos
  function showCriticalError(message) {
    const msg =
      message ||
      'Ocurrió un error crítico en la plataforma. Actualiza la página o intenta más tarde.';
    console.error('[EC0301][CRITICAL]', msg);
    alert('Error crítico del sistema:\n\n' + msg);
  }

  window.auth = {
    login,
    logout,
    isLoggedIn,
    getToken,
    getSession,
    getUserEmail,
    getAccessCode,
    requireAuth
  };

  window.showCriticalError = showCriticalError;
})();
