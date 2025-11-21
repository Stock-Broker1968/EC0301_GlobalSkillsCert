// sistema_central/ec0301-data-manager.js
// Gestor de datos maestro del proyecto EC0301

const EC0301Manager = (function () {
    'use strict';
  
    const DATA_KEY = 'EC0301_ProyectoData';
    let projectData = {};
  
    // --- Inicialización ---
    function loadDataFromStorage() {
      try {
        const stored = localStorage.getItem(DATA_KEY);
        projectData = stored ? JSON.parse(stored) : {};
        if (typeof projectData !== 'object' || projectData === null) {
          projectData = {};
        }
        // console.log('[DataManager] Datos cargados correctamente.');
      } catch (e) {
        console.error('[DataManager] Error al cargar datos:', e);
        projectData = {};
      }
    }
  
    function saveDataToStorage() {
      try {
        localStorage.setItem(DATA_KEY, JSON.stringify(projectData));
      } catch (e) {
        console.error('[DataManager] Error al guardar en LocalStorage:', e);
      }
    }
  
    // --- Métodos Públicos ---
  
    // 1. Obtener todos los datos de la Carta Descriptiva
    function getData() {
      return JSON.parse(JSON.stringify(projectData));
    }
  
    // 2. Guardar datos de la Carta Descriptiva (Sobreescribe raíz)
    function saveData(data) {
      try {
        projectData = { ...projectData, ...data }; // Mantiene propiedades previas si no se sobreescriben
        saveDataToStorage();
        return true;
      } catch (e) {
        console.error('[DataManager] Error en saveData:', e);
        return false;
      }
    }
  
    // 3. Guardar Productos Específicos (Evaluaciones, Manuales, etc.)
    function saveProduct(productName, data) {
      try {
        if (!projectData.productos) projectData.productos = {};
        projectData.productos[productName] = data;
        saveDataToStorage();
        return true;
      } catch (e) {
        console.error('[DataManager] Error al guardar producto:', e);
        return false;
      }
    }
  
    function loadProduct(productName) {
      try {
        if (!projectData.productos) return null;
        const prod = projectData.productos[productName];
        return prod ? JSON.parse(JSON.stringify(prod)) : null;
      } catch (e) {
        console.error('[DataManager] Error al cargar producto:', e);
        return null;
      }
    }
  
    // 4. Control de Avance y Candados (Módulos)
    function markModuleProgress(moduleKey, percentage) {
      try {
        if (!projectData.modulos) projectData.modulos = {};
        
        projectData.modulos[moduleKey] = {
          progress: percentage,
          completed: percentage >= 100, // O el umbral que definas (ej. 80)
          lastUpdate: new Date().toISOString()
        };
        
        saveDataToStorage();
        return true;
      } catch (e) {
        console.error('[DataManager] Error al marcar progreso:', e);
        return false;
      }
    }
  
    function getModuleProgress(moduleKey) {
      try {
        if (!projectData.modulos || !projectData.modulos[moduleKey]) return 0;
        return projectData.modulos[moduleKey].progress || 0;
      } catch (e) {
        return 0;
      }
    }
  
    function clearData() {
      projectData = {};
      localStorage.removeItem(DATA_KEY);
      console.log('[DataManager] Datos borrados.');
    }
  
    // Cargar datos al iniciar
    loadDataFromStorage();
  
    return {
      getData,
      saveData,
      saveProduct,
      loadProduct,
      markModuleProgress, // Vital para el dashboard
      getModuleProgress,
      clearData
    };
  })();
  
  // Exponer globalmente
  window.EC0301Manager = EC0301Manager;
