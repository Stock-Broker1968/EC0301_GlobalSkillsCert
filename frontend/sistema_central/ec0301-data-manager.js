// sistema_central/ec0301-data-manager.js

const EC0301Manager = {
    // Claves de almacenamiento
    KEYS: {
        CARTA: 'ec0301_carta_data',
        EVALUACIONES: 'ec0301_evaluaciones',
        MANUALES: 'ec0301_manuales',
        PROGRESS: 'ec0301_progress'
    },

    // Guardar datos generales (Carta Descriptiva)
    saveData: (data) => {
        localStorage.setItem('ec0301_carta_data', JSON.stringify(data));
        console.log('Datos guardados localmente');
    },

    // Obtener datos generales
    getData: () => {
        const data = localStorage.getItem('ec0301_carta_data');
        return data ? JSON.parse(data) : {};
    },

    // Guardar un producto específico (ej: evaluacion-sumativa)
    saveProduct: (key, data) => {
        localStorage.setItem(`ec0301_prod_${key}`, JSON.stringify(data));
    },

    // Cargar un producto específico
    loadProduct: (key) => {
        const data = localStorage.getItem(`ec0301_prod_${key}`);
        return data ? JSON.parse(data) : null;
    },

    // Marcar progreso de un módulo (para los candados)
    markModuleProgress: (moduleName, percentage) => {
        let progress = JSON.parse(localStorage.getItem('ec0301_progress') || '{}');
        progress[moduleName] = percentage;
        localStorage.setItem('ec0301_progress', JSON.stringify(progress));
    },

    // Obtener progreso
    getProgress: () => {
        return JSON.parse(localStorage.getItem('ec0301_progress') || '{}');
    }
};

// Exponer globalmente
window.EC0301Manager = EC0301Manager;
