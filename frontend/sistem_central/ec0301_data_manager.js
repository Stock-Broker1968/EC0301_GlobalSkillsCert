/**
 * EC0301 Data Manager - Sistema de Gestión de Datos del Proyecto
 * Maneja persistencia, validación y operaciones CRUD para proyectos EC0301
 * @version 2.0.0
 */

const EC0301Manager = (function() {
    'use strict';

    // ==================== CONFIGURACIÓN ====================
    const CONFIG = {
        STORAGE_KEY: 'ec0301_project_data',
        VERSION: '2.0.0',
        MAX_STORAGE_SIZE: 5 * 1024 * 1024, // 5MB
        AUTO_SAVE_INTERVAL: 30000, // 30 segundos
        BACKUP_KEY: 'ec0301_project_backup'
    };

    // ==================== ESQUEMA DE VALIDACIÓN ====================
    const PROJECT_SCHEMA = {
        nombre: { type: 'string', required: true, minLength: 3, maxLength: 200 },
        duracion: { type: 'number', required: true, min: 1, max: 1000 },
        modalidad: { type: 'string', required: true, enum: ['teleformacion', 'presencial', 'mixta'] },
        objetivo: { type: 'string', required: true, minLength: 10 },
        version: { type: 'string', required: true },
        created: { type: 'number', required: true },
        modified: { type: 'number', required: true }
    };

    // ==================== ESTADO INTERNO ====================
    let projectData = {};
    let isDirty = false;
    let autoSaveTimer = null;

    // ==================== INICIALIZACIÓN ====================
    function init() {
        console.log('[EC0301Manager] Inicializando sistema de gestión de datos...');
        loadFromStorage();
        setupAutoSave();
        setupBeforeUnload();
        console.log('[EC0301Manager] Sistema inicializado correctamente');
    }

    // ==================== ALMACENAMIENTO ====================
    function loadFromStorage() {
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (validateProjectStructure(parsed)) {
                    projectData = parsed;
                    console.log('[EC0301Manager] Datos cargados desde localStorage');
                    return true;
                } else {
                    console.warn('[EC0301Manager] Datos corruptos detectados');
                    createBackup();
                }
            }
            projectData = createEmptyProject();
            return false;
        } catch (error) {
            console.error('[EC0301Manager] Error cargando datos:', error);
            projectData = createEmptyProject();
            return false;
        }
    }

    function saveToStorage() {
        try {
            projectData.modified = Date.now();
            const jsonData = JSON.stringify(projectData);
            
            // Validar tamaño
            if (jsonData.length > CONFIG.MAX_STORAGE_SIZE) {
                throw new Error('Proyecto excede el límite de almacenamiento (5MB)');
            }

            localStorage.setItem(CONFIG.STORAGE_KEY, jsonData);
            isDirty = false;
            console.log('[EC0301Manager] Datos guardados exitosamente');
            return true;
        } catch (error) {
            console.error('[EC0301Manager] Error guardando datos:', error);
            if (error.name === 'QuotaExceededError') {
                alert('Error: Almacenamiento lleno. Por favor exporta tu proyecto.');
            }
            return false;
        }
    }

    // ==================== OPERACIONES CRUD ====================
    function getData() {
        return JSON.parse(JSON.stringify(projectData)); // Deep clone
    }

    function setData(section, data) {
        if (!section || typeof section !== 'string') {
            throw new Error('Sección inválida');
        }
        
        projectData[section] = data;
        projectData.modified = Date.now();
        isDirty = true;
        saveToStorage();
        
        console.log(`[EC0301Manager] Sección '${section}' actualizada`);
        return true;
    }

    function updateField(section, field, value) {
        if (!projectData[section]) {
            projectData[section] = {};
        }
        
        projectData[section][field] = value;
        projectData.modified = Date.now();
        isDirty = true;
        saveToStorage();
        
        return true;
    }

    function deleteSection(section) {
        if (projectData[section]) {
            delete projectData[section];
            projectData.modified = Date.now();
            isDirty = true;
            saveToStorage();
            console.log(`[EC0301Manager] Sección '${section}' eliminada`);
            return true;
        }
        return false;
    }

    // ==================== VALIDACIÓN ====================
    function validateProjectStructure(data) {
        if (!data || typeof data !== 'object') return false;
        
        // Validar campos requeridos del esquema
        for (const [field, rules] of Object.entries(PROJECT_SCHEMA)) {
            if (rules.required && !data[field]) {
                console.warn(`[EC0301Manager] Campo requerido faltante: ${field}`);
                return false;
            }
            
            if (data[field]) {
                // Validar tipo
                if (rules.type === 'string' && typeof data[field] !== 'string') return false;
                if (rules.type === 'number' && typeof data[field] !== 'number') return false;
                
                // Validar longitud para strings
                if (rules.type === 'string' && rules.minLength && data[field].length < rules.minLength) return false;
                if (rules.type === 'string' && rules.maxLength && data[field].length > rules.maxLength) return false;
                
                // Validar rangos para numbers
                if (rules.type === 'number' && rules.min !== undefined && data[field] < rules.min) return false;
                if (rules.type === 'number' && rules.max !== undefined && data[field] > rules.max) return false;
                
                // Validar enum
                if (rules.enum && !rules.enum.includes(data[field])) return false;
            }
        }
        
        return true;
    }

    function validateField(field, value, rules) {
        if (rules.required && !value) {
            return { valid: false, error: `${field} es requerido` };
        }
        
        if (rules.type === 'string' && typeof value !== 'string') {
            return { valid: false, error: `${field} debe ser texto` };
        }
        
        if (rules.type === 'number' && typeof value !== 'number') {
            return { valid: false, error: `${field} debe ser un número` };
        }
        
        if (rules.minLength && value.length < rules.minLength) {
            return { valid: false, error: `${field} debe tener al menos ${rules.minLength} caracteres` };
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
            return { valid: false, error: `${field} no puede exceder ${rules.maxLength} caracteres` };
        }
        
        if (rules.min !== undefined && value < rules.min) {
            return { valid: false, error: `${field} debe ser al menos ${rules.min}` };
        }
        
        if (rules.max !== undefined && value > rules.max) {
            return { valid: false, error: `${field} no puede exceder ${rules.max}` };
        }
        
        if (rules.enum && !rules.enum.includes(value)) {
            return { valid: false, error: `${field} debe ser uno de: ${rules.enum.join(', ')}` };
        }
        
        return { valid: true };
    }

    // ==================== PROYECTO ====================
    function createEmptyProject() {
        return {
            nombre: '',
            duracion: 0,
            modalidad: '',
            objetivo: '',
            version: CONFIG.VERSION,
            created: Date.now(),
            modified: Date.now(),
            projectId: generateProjectId(),
            carta: {},
            logistica: {},
            evaluaciones: {},
            manuales: {},
            resultados: {},
            auditoria: {}
        };
    }

    function generateProjectId() {
        return `EC0301-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    function clearProject() {
        createBackup();
        projectData = createEmptyProject();
        saveToStorage();
        console.log('[EC0301Manager] Proyecto limpiado');
    }

    // ==================== MÓDULOS ====================
    function getCompletedModules(data = projectData) {
        const completed = [];
        
        // Carta Descriptiva (40%)
        if (data.nombre && data.duracion && data.objetivo && data.modalidad) {
            if (data.carta && Object.keys(data.carta).length > 5) {
                completed.push('carta');
            }
        }
        
        // Logística (15%)
        if (data.logistica && Object.keys(data.logistica).length > 0) {
            completed.push('logistica');
        }
        
        // Evaluaciones (20%)
        if (data.evaluaciones && Object.keys(data.evaluaciones).length > 0) {
            completed.push('evaluaciones');
        }
        
        // Manuales (15%)
        if (data.manuales && Object.keys(data.manuales).length > 0) {
            completed.push('manuales');
        }
        
        // Resultados (5%)
        if (data.resultados && Object.keys(data.resultados).length > 0) {
            completed.push('resultados');
        }
        
        // Auditoría (5%)
        if (data.auditoria && data.auditoria.completed) {
            completed.push('auditoria');
        }
        
        return completed;
    }

    function calculateCompliance() {
        const weights = {
            carta: 40,
            logistica: 15,
            evaluaciones: 20,
            manuales: 15,
            resultados: 5,
            auditoria: 5
        };
        
        const completed = getCompletedModules();
        let totalWeight = 0;
        
        completed.forEach(module => {
            totalWeight += weights[module] || 0;
        });
        
        return Math.round(totalWeight);
    }

    // ==================== EXPORTACIÓN/IMPORTACIÓN ====================
    function exportProject() {
        try {
            const exportData = {
                ...projectData,
                exportDate: new Date().toISOString(),
                version: CONFIG.VERSION
            };
            
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `EC0301_${projectData.nombre || 'Proyecto'}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('[EC0301Manager] Proyecto exportado exitosamente');
            return true;
        } catch (error) {
            console.error('[EC0301Manager] Error exportando proyecto:', error);
            throw error;
        }
    }

    async function importProject(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.type !== 'application/json') {
                reject(new Error('Archivo inválido. Debe ser un archivo JSON.'));
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    
                    if (!validateProjectStructure(imported)) {
                        reject(new Error('Estructura de proyecto inválida'));
                        return;
                    }
                    
                    createBackup();
                    projectData = imported;
                    projectData.modified = Date.now();
                    saveToStorage();
                    
                    console.log('[EC0301Manager] Proyecto importado exitosamente');
                    resolve(projectData);
                } catch (error) {
                    console.error('[EC0301Manager] Error parseando archivo:', error);
                    reject(new Error('Error al leer el archivo. Formato inválido.'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Error al leer el archivo'));
            };
            
            reader.readAsText(file);
        });
    }

    // ==================== BACKUP ====================
    function createBackup() {
        try {
            const backupData = {
                data: projectData,
                timestamp: Date.now(),
                version: CONFIG.VERSION
            };
            localStorage.setItem(CONFIG.BACKUP_KEY, JSON.stringify(backupData));
            console.log('[EC0301Manager] Backup creado');
        } catch (error) {
            console.error('[EC0301Manager] Error creando backup:', error);
        }
    }

    function restoreBackup() {
        try {
            const backup = localStorage.getItem(CONFIG.BACKUP_KEY);
            if (backup) {
                const parsed = JSON.parse(backup);
                if (parsed.data && validateProjectStructure(parsed.data)) {
                    projectData = parsed.data;
                    saveToStorage();
                    console.log('[EC0301Manager] Backup restaurado');
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('[EC0301Manager] Error restaurando backup:', error);
            return false;
        }
    }

    // ==================== AUTO-GUARDADO ====================
    function setupAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
        }
        
        autoSaveTimer = setInterval(() => {
            if (isDirty) {
                saveToStorage();
                console.log('[EC0301Manager] Auto-guardado ejecutado');
            }
        }, CONFIG.AUTO_SAVE_INTERVAL);
    }

    function setupBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (isDirty) {
                saveToStorage();
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    // ==================== INFORMACIÓN DEL SISTEMA ====================
    function getSystemInfo() {
        const dataSize = new Blob([JSON.stringify(projectData)]).size;
        const compliance = calculateCompliance();
        const completedModules = getCompletedModules();
        
        return {
            version: CONFIG.VERSION,
            projectId: projectData.projectId,
            created: projectData.created,
            modified: projectData.modified,
            dataSize: dataSize,
            compliance: `${compliance}%`,
            modules: completedModules.length,
            isDirty: isDirty
        };
    }

    // ==================== API PÚBLICA ====================
    const publicAPI = {
        init,
        getData,
        setData,
        updateField,
        deleteSection,
        clearProject,
        exportProject,
        importProject,
        getCompletedModules,
        calculateCompliance,
        getSystemInfo,
        validateField,
        createBackup,
        restoreBackup,
        saveToStorage,
        get version() { return CONFIG.VERSION; }
    };

    // Auto-inicialización
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return publicAPI;
})();

// Exportar para uso global
window.EC0301Manager = EC0301Manager;
