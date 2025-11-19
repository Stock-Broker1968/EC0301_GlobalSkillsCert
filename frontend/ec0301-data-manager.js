// ec0301-data-manager.js
// EC0301 Data Manager - v2.0
const EC0301Manager = (function() {
  'use strict';

  const DATA_KEY = 'EC0301_ProyectoData';
  let projectData = {};

  function loadDataFromStorage() {
    try {
      const storedData = localStorage.getItem(DATA_KEY);
      projectData = storedData ? JSON.parse(storedData) : {};
      console.log('[DataManager] Datos cargados.');
    } catch (e) {
      console.error('[DataManager] Error al cargar datos:', e);
      projectData = {};
    }
  }

  function saveDataToStorage() {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(projectData));
    } catch (e) {
      console.error('[DataManager] Error al guardar datos:', e);
    }
  }

  function getData() {
    // Devolver copia para evitar mutaciones externas
    return JSON.parse(JSON.stringify(projectData));
  }

  function saveData(data) {
    try {
      projectData = data || {};
      saveDataToStorage();
      return true;
    } catch (e) {
      console.error('[DataManager] Error en saveData:', e);
      return false;
    }
  }

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

  function clearData() {
    projectData = {};
    localStorage.removeItem(DATA_KEY);
    console.log('[DataManager] Datos borrados.');
  }

  // Carga inicial al importar el módulo
  loadDataFromStorage();

  return {
    getData,
    saveData,
    loadProduct,
    saveProduct,
    clearData
  };

})();

window.EC0301Manager = EC0301Manager;
