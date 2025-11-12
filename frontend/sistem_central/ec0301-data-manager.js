/**
 * EC0301 Data Manager - v2.0
 * Maneja el guardado y carga de datos del proyecto EC0301
 * en el LocalStorage del navegador.
 */
const EC0301Manager = (function() {
    'use strict';

    const DATA_KEY = 'EC0301_ProyectoData';
    let projectData = {};

    /**
     * Carga los datos del proyecto desde LocalStorage a la memoria.
     */
    function loadDataFromStorage() {
        try {
            const storedData = localStorage.getItem(DATA_KEY);
            if (storedData) {
                projectData = JSON.parse(storedData);
                console.log('[DataManager] Datos cargados.');
            } else {
                projectData = {};
                console.log('[DataManager] Proyecto vacío.');
            }
        } catch (e) {
            console.error('[DataManager] Error al cargar datos:', e);
            projectData = {};
        }
    }

    /**
     * Guarda los datos de la memoria en LocalStorage.
     */
    function saveDataToStorage() {
        try {
            localStorage.setItem(DATA_KEY, JSON.stringify(projectData));
        } catch (e) {
            console.error('[DataManager] Error al guardar datos:', e);
        }
    }

    /**
     * Obtiene una copia de todos los datos del proyecto (la Carta Descriptiva principal).
     * @returns {object}
     */
    function getData() {
        return JSON.parse(JSON.stringify(projectData));
    }

    /**
     * Guarda los datos de la Carta Descriptiva (el objeto principal).
     * @param {object} data - El objeto completo de la carta descriptiva.
     */
    function saveData(data) {
        try {
            projectData = data;
            saveDataToStorage();
            return true;
        } catch (e) { return false; }
    }

    /**
     * Guarda un "producto" específico (evaluaciones, manuales, etc.).
     * @param {string} productName - El nombre clave del producto (ej: 'evaluacion-sumativa').
     * @param {any} data - Los datos a guardar.
     */
    function saveProduct(productName, data) {
        try {
            if (!projectData.productos) {
                projectData.productos = {};
            }
            projectData.productos[productName] = data;
            saveDataToStorage();
            console.log(`[DataManager] Producto "${productName}" guardado.`);
            return true;
        } catch (e) { return false; }
    }

    /**
     * Carga un "producto" específico.
     * @param {string} productName - El nombre clave del producto.
     * @returns {any|null}
     */
    function loadProduct(productName) {
        try {
            if (projectData.productos && projectData.productos[productName]) {
                console.log(`[DataManager] Producto "${productName}" cargado.`);
                return projectData.productos[productName];
            }
            return null;
        } catch (e) { return null; }
    }

    /**
     * Limpia todos los datos del proyecto (usado en logout).
     */
    function clearData() {
        projectData = {};
        localStorage.removeItem(DATA_KEY);
        console.log('[DataManager] Datos borrados.');
    }

    // Carga inicial al momento de que el script es leído
    loadDataFromStorage();

    // Exponer la API pública
    return {
        getData,
        saveData,
        loadProduct,
        saveProduct,
        clearData
    };

})();

// Exportar para uso global
window.EC0301Manager = EC0301Manager;
