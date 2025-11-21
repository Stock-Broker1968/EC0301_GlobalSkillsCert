const auth = (function () {
  'use strict';

  const TOKEN_KEY = 'authToken';

  function login(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      console.log('Auth: Sesión iniciada.');
    } catch (e) {
      console.error('Auth: Error al guardar el token.', e);
    }
  }

  function logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('userEmail');
      console.log('Auth: Sesión cerrada.');
      window.location.href = 'index.html'; // Redirige a la página de inicio
    } catch (e) {
      console.error('Auth: Error al cerrar sesión.', e);
    }
  }

  function isLoggedIn() {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      return !!token;
    } catch (e) {
      console.error('Auth: Error al verificar token.', e);
      return false;
    }
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  return { login, logout, isLoggedIn, getToken };
})();

window.auth = auth;
