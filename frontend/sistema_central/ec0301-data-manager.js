const EC0301Manager = (function() {
    const KEY = 'EC0301_Data';
    let data = JSON.parse(localStorage.getItem(KEY) || '{}');

    const save = () => localStorage.setItem(KEY, JSON.stringify(data));

    return {
        getData: () => JSON.parse(JSON.stringify(data)),
        saveData: (newData) => { data = { ...data, ...newData }; save(); },
        
        saveProduct: (name, content) => {
            if (!data.productos) data.productos = {};
            data.productos[name] = content;
            save();
        },
        loadProduct: (name) => data.productos ? data.productos[name] : null,

        markModuleProgress: (mod, pct) => {
            if (!data.modulos) data.modulos = {};
            data.modulos[mod] = { progress: pct, completed: pct >= 100 };
            save();
        },
        getModuleStatus: (mod) => data.modulos ? data.modulos[mod] : null
    };
})();
window.EC0301Manager = EC0301Manager;
