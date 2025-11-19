// Interfaz/sistema_central/ec0301-data-manager.js
/**
 * EC0301 Data Manager - v2.1
 * - Guarda datos del proyecto en localStorage
 * - Controla avance de módulos EC0301 y candados
 */

const EC0301Manager = (function () {
  'use strict';

  const DATA_KEY = 'EC0301_ProyectoData';

  // Orden de módulos del portafolio
  const MODULES_ORDER = [
    'carta',        // Carta Descriptiva
    'logistica',    // Logística y formatos
    'evaluaciones', // Instrumentos de Evaluación
    'manuales',     // Manuales del curso
    'respuestas',   // Hoja de respuestas
    'auditoria'     // Auditoría EC0301
  ];

  let projectData = {};

  // Asegura que exista la estructura básica de módulos
  function ensureModulesStructure() {
    if (!projectData.modulos) {
      projectData.modulos = {};
    }

    MODULES_ORDER.forEach((mod, index) => {
      if (!projectData.modulos[mod]) {
        projectData.modulos[mod] = {
          desbloqueado: index === 0, // Solo la carta está abierta al inicio
          completado: false,
          porcentaje: 0,
          fecha: null
        };
      }
    });
  }

  function loadDataFromStorage() {
    try {
      const storedData = localStorage.getItem(DATA_KEY);
      projectData = storedData ? JSON.parse(storedData) : {};
      ensureModulesStructure();
      console.log('[DataManager] Datos cargados.');
    } catch (e) {
      console.error('[DataManager] Error al cargar datos:', e);
      projectData = {};
      ensureModulesStructure();
    }
  }

  function saveDataToStorage() {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(projectData));
    } catch (e) {
      console.error('[DataManager] Error al guardar datos:', e);
    }
  }

  // --------- Datos generales del proyecto ---------
  function getData() {
    return JSON.parse(JSON.stringify(projectData));
  }

  function saveData(data) {
    try {
      projectData = data || {};
      ensureModulesStructure();
      saveDataToStorage();
      return true;
    } catch (e) {
      console.error('[DataManager] Error en saveData:', e);
      return false;
    }
  }

  // --------- Productos individuales (si los usas) ---------
  function saveProduct(productName, data) {
    try {
      if (!projectData.productos) {
        projectData.productos = {};
      }
      projectData.productos[productName] = data;
      saveDataToStorage();
      return true;
    } catch (e) {
      console.error('[DataManager] Error en saveProduct:', e);
      return false;
    }
  }

  function loadProduct(productName) {
    try {
      if (projectData.productos && projectData.productos[productName]) {
        return JSON.parse(JSON.stringify(projectData.productos[productName]));
      }
      return null;
    } catch (e) {
      console.error('[DataManager] Error en loadProduct:', e);
      return null;
    }
  }

  // --------- Progreso de módulos / Candados ---------

  // Devuelve copia del estado de todos los módulos
  function getModulesStatus() {
    ensureModulesStructure();
    return JSON.parse(JSON.stringify(projectData.modulos));
  }

  // ¿El módulo está desbloqueado para entrar?
  function isModuleUnlocked(modulo) {
    ensureModulesStructure();
    const m = projectData.modulos[modulo];
    return !!(m && m.desbloqueado);
  }

  /**
   * Marca avance de un módulo (0-100).
   * Si >= 80:
   *   - marca el módulo como completado
   *   - desbloquea el siguiente módulo según MODULES_ORDER
   */
  function markModuleProgress(modulo, porcentaje) {
    ensureModulesStructure();

    if (!MODULES_ORDER.includes(modulo)) {
      console.warn('[DataManager] Módulo desconocido:', modulo);
      return;
    }

    const m = projectData.modulos[modulo];
    const pct = Math.max(0, Math.min(100, Number(porcentaje) || 0));

    m.porcentaje = pct;
    m.completado = pct >= 80;
    m.fecha = new Date().toISOString();

    // Si se completó, desbloquear el siguiente en la cadena
    if (m.completado) {
      const idx = MODULES_ORDER.indexOf(modulo);
      const siguiente = MODULES_ORDER[idx + 1];
      if (siguiente) {
        if (!projectData.modulos[siguiente]) {
          projectData.modulos[siguiente] = {
            desbloqueado: true,
            completado: false,
            porcentaje: 0,
            fecha: null
          };
        } else {
          projectData.modulos[siguiente].desbloqueado = true;
        }
      }
    }

    saveDataToStorage();
    console.log(
      `[DataManager] Progreso módulo "${modulo}": ${pct}% (completado=${m.completado})`
    );
  }

  // Atajo: marcar módulo como completado al 100%
  function markModuleComplete(modulo) {
    markModuleProgress(modulo, 100);
  }

  function clearData() {
    projectData = {};
    localStorage.removeItem(DATA_KEY);
    console.log('[DataManager] Datos borrados.');
    ensureModulesStructure();
    saveDataToStorage();
  }

  // Carga inicial
  loadDataFromStorage();

  return {
    // Datos generales
    getData,
    saveData,
    loadProduct,
    saveProduct,
    clearData,
    // Módulos / candados
    getModulesStatus,
    isModuleUnlocked,
    markModuleProgress,
    markModuleComplete,
    MODULES_ORDER
  };
})();

window.EC0301Manager = EC0301Manager;
