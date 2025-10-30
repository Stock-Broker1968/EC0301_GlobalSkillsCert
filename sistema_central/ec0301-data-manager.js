// =====================================================================
// MÓDULO DE GESTIÓN CENTRALIZADA DE DATOS EC0301
// Sistema de autorelleno y validación cruzada mejorado
// =====================================================================

class EC0301DataManager {
    constructor() {
        this.STORAGE_KEY = 'EC0301_CARTA_PRO';
        this.VERSION_KEY = 'EC0301_VERSIONS';
        this.AUDIT_LOG_KEY = 'EC0301_AUDIT_LOG';
        this.observers = new Map();
        this.validationRules = this.initializeValidationRules();
        
        // (NUEVO) Definir los módulos y sus pesos para el cálculo de cumplimiento
        this.MODULE_WEIGHTS = {
            'carta': 40,
            'logistica': 15,
            'evaluaciones': 20,
            'manuales': 15,
            'resultados': 5,
            'auditoria': 5
        };
    }

    // =====================================================================
    // SISTEMA DE OBSERVADORES PARA AUTORELLENO
    // =====================================================================
    
    subscribe(module, callback) {
        if (!this.observers.has(module)) {
            this.observers.set(module, []);
        }
        this.observers.get(module).push(callback);
    }

    notify(changedFields) {
        this.observers.forEach((callbacks, module) => {
            callbacks.forEach(callback => {
                try {
                    callback(changedFields, this.getData());
                } catch (error) {
                    this.logError(`Error notificando a módulo ${module}:`, error);
                }
            });
        });
    }

    // =====================================================================
    // GESTIÓN DE DATOS CENTRALIZADA
    // =====================================================================
    
    saveData(newData, source = 'carta_descriptiva') {
        const currentData = this.getData();
        // (AJUSTE) Usar deep merge para no sobrescribir objetos anidados
        const mergedData = this.deepMerge(currentData, newData);
        
        // Validar integridad
        const validation = this.validateData(mergedData);
        if (!validation.isValid) {
            // No lanzar error, solo loguear. Permite guardar borradores incompletos.
            this.logError(`Datos guardados con errores de validación: ${validation.errors.join(', ')}`);
        }

        // Generar checksum para integridad
        mergedData._checksum = this.generateChecksum(mergedData);
        mergedData._lastUpdate = new Date().toISOString();
        mergedData._source = source;

        // (NUEVO) Guardar estado de módulos completados
        mergedData._completedModules = this.getCompletedModules(mergedData);

        // Guardar versión anterior para auditoría
        this.saveVersion(currentData, source);
        
        // Guardar datos principales
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mergedData));
        
        // Registrar cambios en log de auditoría
        this.logChange(source, this.getChangedFields(currentData, mergedData));
        
        // Notificar a módulos suscritos
        this.notify(this.getChangedFields(currentData, mergedData));
        
        return mergedData;
    }

    getData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (!data) return this.getDefaultStructure();
            
            const parsedData = JSON.parse(data);
            
            // Verificar integridad
            if (!this.verifyIntegrity(parsedData)) {
                this.logError('Integridad de datos comprometida, restaurando última versión válida');
                return this.restoreFromVersion();
            }
            
            // Asegurar que la estructura por defecto esté presente si faltan campos
            return this.deepMerge(this.getDefaultStructure(), parsedData);
        } catch (error) {
            this.logError('Error cargando datos:', error);
            return this.getDefaultStructure();
        }
    }

    // (NUEVO) Limpia todos los datos del proyecto
    clearProject() {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.VERSION_KEY);
        localStorage.removeItem(this.AUDIT_LOG_KEY);
        this.logError('Proyecto limpiado por el usuario.');
    }

    // =====================================================================
    // AUTORELLENO INTELIGENTE POR MÓDULO (Tus funciones)
    // =====================================================================
    
    // Para módulo de requerimientos/logística
    getRequerimientosData() {
        const data = this.getData();
        return {
            curso: data.nombre || '',
            facilitador: data.facilitador || data.diseñador || '',
            lugar: data.lugar || '',
            duracion: data.duracion || '',
            participantes: data.num || '',
            // (AJUSTE) Corregido para EC0301 (online) vs EC0217 (presencial)
            instalaciones: data.rq?.plataforma || data.rq?.inst || '',
            equipo: data.rq?.hardware || data.rq?.equipo || '',
            materiales: data.rq?.recursos || data.rq?.mats || '',
            fechas: data.fechas || ''
        };
    }

    // Para módulo de evaluaciones
    getEvaluacionesData() {
        const data = this.getData();
        return {
            nombre: data.nombre || '',
            facilitador: data.facilitador || data.diseñador || '',
            lugar: data.lugar || '',
            fechas: data.fechas || '',
            evaluacion: {
                diagnostica: {
                    porcentaje: data.ev?.diag?.pct || '0',
                    instrumento: data.ev?.diag?.ins || 'Cuestionario'
                },
                formativa: {
                    porcentaje: data.ev?.form?.pct || '40',
                    instrumento: data.ev?.form?.ins || 'Guía de Observación'
                },
                sumativa: {
                    // (AJUSTE) Limpiar el '%' del valor
                    porcentaje: (data.ev?.sum?.pct || '60').replace('%', ''), 
                    instrumento: data.ev?.sum?.inst || 'Examen Final'
                },
                minima: data.ev?.min || '80'
            },
            objetivos: this.extractObjetivosForEvaluacion(data)
        };
    }

    // Para módulo de manuales
    getManualesData() {
        const data = this.getData();
        return {
            nombre: data.nombre || '',
            diseñador: data.diseñador || '',
            facilitador: data.facilitador || '',
            perfil: data.psico || '',
            objetivo_general: this.buildObjetivoCompleto(data.og),
            objetivos_particulares: data.objetivos || [],
            temas: data.temas || [],
            requerimientos: data.rq || {},
            evaluacion: data.ev || {},
            duracion: data.duracion || '',
            participantes: data.num || ''
        };
    }

    // Para módulo de resultados
    getResultadosData() {
        const data = this.getData();
        return {
            nombre: data.nombre || '',
            facilitador: data.facilitador || data.diseñador || '',
            lugar: data.lugar || '',
            fechas: data.fechas || '',
            participantes: parseInt(data.num) || 10,
            evaluacion: {
                formativa_porcentaje: parseFloat(data.ev?.form?.pct) || 40,
                sumativa_porcentaje: parseFloat(data.ev?.sum?.pct?.replace('%', '')) || 60,
                calificacion_minima: parseFloat(data.ev?.min) || 80
            }
        };
    }

    // Para módulo de auditoría
    getAuditoriaData() {
        const data = this.getData();
        return {
            ...data,
            completitud: this.calculateCompleteness(data), // Usando tu función
            validaciones: this.runValidations(data),
            recomendaciones: this.getRecommendations(data)
        };
    }

    // =====================================================================
    // VALIDACIONES CRUZADAS
    // =====================================================================
    
    initializeValidationRules() {
        // (AJUSTE) Actualizados a campos EC0301 (online)
        // 'rq.inst' -> 'rq.plataforma', 'rq.mats' -> 'rq.recursos'
        return {
            required_fields: [
                'nombre', 'facilitador', 'og.accion', 'og.cond', 'og.criterio',
                'rq.plataforma', 'rq.recursos', 'rq.evaluacion', 'ev.min'
            ],
            business_rules: [
                {
                    name: 'porcentajes_evaluacion',
                    validate: (data) => {
                        const formPct = parseFloat(data.ev?.form?.pct) || 0;
                        const sumPct = parseFloat(data.ev?.sum?.pct?.replace('%', '')) || 0;
                        // Permitir suma 0 si aún no se ha llenado
                        if (formPct === 0 && sumPct === 0) return true; 
                        return Math.abs((formPct + sumPct) - 100) < 0.1;
                    },
                    message: 'Los porcentajes de evaluación formativa y sumativa deben sumar 100%'
                },
                {
                    name: 'calificacion_minima_valida',
                    validate: (data) => {
                        const min = parseFloat(data.ev?.min) || 0;
                        return min >= 60 && min <= 100;
                    },
                    message: 'La calificación mínima debe ser un valor válido (ej: 60-100)'
                },
                {
                    name: 'temas_coherentes',
                    validate: (data) => {
                        return data.temas && data.temas.length >= 1;
                    },
                    message: 'Debe incluir al menos un tema de desarrollo'
                },
                {
                    name: 'objetivos_completos',
                    validate: (data) => {
                        return data.objetivos && data.objetivos.length >= 1;
                    },
                    message: 'Debe incluir al menos un objetivo particular'
                }
            ]
        };
    }

    validateData(data) {
        const errors = [];
        
        // Validar campos requeridos
        this.validationRules.required_fields.forEach(field => {
            if (!this.getNestedValue(data, field)) {
                errors.push(`Campo requerido faltante: ${field}`);
            }
        });

        // Validar reglas de negocio
        this.validationRules.business_rules.forEach(rule => {
            if (!rule.validate(data)) {
                errors.push(rule.message);
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    // (NUEVO) Función que falta en tu archivo, llamada por index.html
    /**
     * Calcula el % de cumplimiento total basado en el peso de los módulos.
     */
    calculateCompliance(data) {
        let totalCompliance = 0;
        const completedModules = this.getCompletedModules(data);
        
        completedModules.forEach(moduleId => {
            totalCompliance += (this.MODULE_WEIGHTS[moduleId] || 0);
        });
        
        return totalCompliance;
    }

    // (NUEVO) Función que falta en tu archivo, llamada por index.html
    /**
     * Determina qué módulos se consideran "completos"
     * Esta es una lógica de negocio simple, ajústala según tus criterios
     */
    getCompletedModules(data) {
        if (!data || !data.nombre) {
            return []; // No hay data, ningún módulo completo
        }

        const completed = [];
        const validation = this.validateData(data);
        
        // 1. CARTA DESCRIPTIVA
        // Se considera "completa" si tiene nombre y es válida
        if (data.nombre && validation.isValid) {
            completed.push('carta');
        }

        // 2. LOGÍSTICA
        // Se considera "completa" si la carta está completa
        if (completed.includes('carta')) {
             completed.push('logistica');
        }

        // 3. EVALUACIONES
        // Se considera "completa" si la carta está completa
        if (completed.includes('carta')) {
             completed.push('evaluaciones');
        }

        // 4. MANUALES
        // Se considera "completa" si carta y evaluaciones están completas
        if (completed.includes('carta') && completed.includes('evaluaciones')) {
             completed.push('manuales');
        }
        
        // 5. RESULTADOS
        // Se considera "completa" si los manuales están completos (implica el resto)
        if (completed.includes('manuales')) {
             completed.push('resultados');
        }

        // 6. AUDITORÍA
        // Se considera "completa" si los resultados están completos
        if (completed.includes('resultados')) {
             completed.push('auditoria');
        }

        return completed;
    }

    // =====================================================================
    // MÉTODOS DE UTILIDAD
    // =====================================================================
    
    generateChecksum(data) {
        // (AJUSTE) Simplificado para evitar errores en stringify
        const dataString = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32bit integer
        }
        return hash.toString(16); // Convertir a hexadecimal
    }

    verifyIntegrity(data) {
        if (!data._checksum) return true; // Datos legacy
        const storedChecksum = data._checksum;
        // Crear una copia de data sin el checksum para recalcular
        const dataToVerify = { ...data };
        delete dataToVerify._checksum;
        const currentChecksum = this.generateChecksum(dataToVerify);
        return storedChecksum === currentChecksum;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((acc, key) => {
            if (acc[key] === undefined || acc[key] === null) acc[key] = {};
            return acc[key];
        }, obj);
        target[lastKey] = value;
    }
    
    // (NUEVO) Función para merge profundo de objetos
    deepMerge(target, source) {
        const isObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj);

        if (!isObject(target) || !isObject(source)) {
            return source;
        }

        const output = Object.assign({}, target);

        Object.keys(source).forEach(key => {
            const targetValue = output[key];
            const sourceValue = source[key];

            if (isObject(targetValue) && isObject(sourceValue)) {
                output[key] = this.deepMerge(targetValue, sourceValue);
            } else if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                // (AJUSTE) Reemplazar arrays, no fusionarlos, es más simple para este caso
                output[key] = sourceValue;
            } else {
                output[key] = sourceValue;
            }
        });

        return output;
    }

    getChangedFields(oldData, newData) {
        const changes = [];
        const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

        allKeys.forEach(key => {
            if (key.startsWith('_')) return; // Ignorar campos privados
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                changes.push(key);
            }
        });
        return changes;
    }

    buildObjetivoCompleto(og) {
        if (!og) return '';
        return `Al finalizar el curso, el participante ${og.accion || ''}, ${og.cond || ''}, ${og.criterio || ''}`.trim();
    }

    extractObjetivosForEvaluacion(data) {
        const objetivos = [];
        if (data.og && data.og.accion) {
            objetivos.push({
                tipo: 'General',
                descripcion: this.buildObjetivoCompleto(data.og)
            });
        }
        if (data.objetivos) {
            data.objetivos.forEach((obj, index) => {
                if (obj.accion) {
                    objetivos.push({
                        tipo: `Particular ${index + 1}`,
                        descripcion: `${obj.accion} ${obj.cond || ''}`.trim()
                    });
                }
            });
        }
        return objetivos;
    }

    // (AJUSTE) Renombrada tu función. La usa index.html
    calculateCompleteness(data) {
        const required = this.validationRules.required_fields;
        const completed = required.filter(field => this.getNestedValue(data, field));
        return Math.round((completed.length / required.length) * 100);
    }

    runValidations(data) {
        return this.validateData(data);
    }

    getRecommendations(data) {
        const recommendations = [];
        const validation = this.validateData(data);
        
        if (!validation.isValid) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Compliance',
                message: 'Completar campos requeridos para cumplimiento total'
            });
        }

        if (this.calculateCompleteness(data) < 80) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Calidad',
                message: 'Mejorar completitud de información para mayor calidad'
            });
        }

        return recommendations;
    }

    // =====================================================================
    // AUDITORÍA Y LOGGING
    // =====================================================================
    
    saveVersion(data, source) {
        if (!data || !data.nombre) return; // No guardar versiones vacías
        const versions = JSON.parse(localStorage.getItem(this.VERSION_KEY) || '[]');
        versions.push({
            timestamp: new Date().toISOString(),
            source: source,
            data: data,
            checksum: data._checksum // Usar el checksum ya generado
        });
        
        // Mantener solo últimas 10 versiones
        if (versions.length > 10) versions.shift();
        
        localStorage.setItem(this.VERSION_KEY, JSON.stringify(versions));
    }

    logChange(source, changedFields) {
        if (changedFields.length === 0) return;
        const log = JSON.parse(localStorage.getItem(this.AUDIT_LOG_KEY) || '[]');
        log.push({
            timestamp: new Date().toISOString(),
            source: source,
            changes: changedFields,
            user: sessionStorage.getItem('current_user') || 'unknown'
        });
        
        // Mantener solo últimos 50 cambios
        if (log.length > 50) log.shift();
        
        localStorage.setItem(this.AUDIT_LOG_KEY, JSON.stringify(log));
    }

    logError(message, error) {
        console.error(`[EC0301DataManager] ${message}`, error);
    }

    restoreFromVersion() {
        const versions = JSON.parse(localStorage.getItem(this.VERSION_KEY) || '[]');
        if (versions.length > 0) {
            return versions[versions.length - 1].data;
        }
        return this.getDefaultStructure();
    }

    getDefaultStructure() {
        return {
            nombre: '',
            facilitador: '',
            diseñador: '',
            lugar: '',
            duracion: '',
            num: '',
            fechas: '',
            psico: '',
            modalidad: 'asincrono',
            og: { accion: '', cond: '', criterio: '' },
            objetivos: [],
            temas: [],
            // (AJUSTE) Campos por defecto para EC0301 (online)
            rq: { plataforma: '', recursos: '', evaluacion: '', hardware: '', admin: '', rh: '' },
            ev: {
                diag: { pct: '0', inst: 'Cuestionario en plataforma' },
                form: { pct: '40', inst: 'Foros, tareas' },
                sum: { pct: '60%', inst: 'Proyecto final' },
                min: '80'
            },
            _version: '1.1', // Versión actualizada
            _created: new Date().toISOString(),
            _completedModules: []
        };
    }

    // =====================================================================
    // MÉTODOS PÚBLICOS PARA MÓDULOS (Dashboard y otros)
    // =====================================================================
    
    // (NUEVO) Función que falta en tu archivo, llamada por index.html
    getSystemInfo() {
        const data = this.getData();
        const completedModules = this.getCompletedModules(data);
        const dataString = localStorage.getItem(this.STORAGE_KEY) || '';
        
        return {
            version: '1.1.0', // Versión de la app
            projectId: data._checksum || 'N/A',
            created: data._created,
            modified: data._lastUpdate,
            dataSize: dataString.length,
            compliance: this.calculateCompliance(data),
            modules: completedModules.length
        };
    }

    // Método para que cada módulo obtenga sus datos específicos
    getModuleData(moduleName) {
        const methods = {
            'requerimientos': () => this.getRequerimientosData(), // Usado por Logística
            'evaluaciones': () => this.getEvaluacionesData(),
            'manuales': () => this.getManualesData(),
            'resultados': () => this.getResultadosData(),
            'auditoria': () => this.getAuditoriaData(),
            'logistica': () => this.getRequerimientosData() 
        };

        const method = methods[moduleName];
        if (!method) {
            this.logError(`Módulo desconocido: ${moduleName}`);
            throw new Error(`Módulo desconocido: ${moduleName}`);
        }

        return method();
    }

    // Método para suscribirse a cambios desde cualquier módulo
    onDataChange(moduleName, callback) {
        this.subscribe(moduleName, callback);
    }

    // Método para validar datos específicos de un módulo
    validateModuleData(moduleName, data) {
        // TODO: Implementar validaciones específicas por módulo
        return { isValid: true, errors: [] };
    }

    // =====================================================================
    // (NUEVO) IMPORTAR / EXPORTAR
    // =====================================================================

    exportProject() {
        const data = this.getData();
        if (!data.nombre) {
            throw new Error('No hay datos de proyecto para exportar.');
        }
        const fileName = `SkillsCert_EC0301_${data.nombre.replace(/ /g, '_')}.json`;
        const dataStr = JSON.stringify(data, null, 4); // null, 4 para formateo bonito
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        // Usar FileSaver.js (si está disponible) o un link 'a'
        if (typeof saveAs !== 'undefined') {
            saveAs(dataBlob, fileName);
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(dataBlob);
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(a.href);
        }
    }

    importProject(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.type !== 'application/json') {
                return reject(new Error('Archivo inválido. Debe ser un .json'));
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    // Validar que sea un proyecto válido (simple check)
                    if (jsonData.nombre && jsonData.og && jsonData.rq) {
                        // Limpiar versiones y logs antes de importar
                        localStorage.removeItem(this.VERSION_KEY);
                        localStorage.removeItem(this.AUDIT_LOG_KEY);
                        
                        // Guardar los nuevos datos
                        this.saveData(jsonData, 'import');
                        resolve();
                    } else {
                        reject(new Error('El archivo JSON no parece ser un proyecto de SkillsCert válido.'));
                    }
                } catch (error) {
                    reject(new Error(`Error al procesar el archivo: ${error.message}`));
                }
            };
            reader.onerror = () => {
                reject(new Error('No se pudo leer el archivo.'));
            };
            reader.readAsText(file);
        });
    }
}

// =====================================================================
// INICIALIZACIÓN GLOBAL
// =====================================================================

// Crear instancia global del gestor de datos
window.EC0301Manager = new EC0301DataManager();

// Función helper para compatibilidad con código antiguo (si existe)
function getCartaData() {
    return window.EC0301Manager.getData();
}

function saveCartaData(data, source = 'manual') {
    return window.EC0301Manager.saveData(data, source);
}

// Export para uso en módulos (si se usa bundler)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EC0301DataManager;
}
