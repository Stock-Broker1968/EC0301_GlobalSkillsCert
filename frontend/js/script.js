// Interfaz/js/script.js
// Lógica general de los módulos (Carta descriptiva, etc.)

(function () {
  'use strict';

  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  whenReady(function () {
    if (typeof auth === 'undefined' || typeof EC0301Manager === 'undefined') {
      if (typeof showCriticalError === 'function') {
        showCriticalError(
          'No se pudieron cargar los módulos de sistema auth.js o ec0301-data-manager.js.'
        );
      }
      return;
    }

    const path = window.location.pathname;
    const file = path.split('/').pop();

    // Proteger módulos (no aplica para index ni acceso)
    if (file !== 'index.html' && file !== '' && file !== 'acceso.html') {
      auth.requireAuth();
    }

    if (file === 'carta_descriptiva.html') {
      initCartaDescriptiva();
    }
    // Aquí podrías agregar inicializadores para otros módulos:
    // if (file === 'evaluaciones.html') { initEvaluaciones(); }
  });

  // ============================
  //  CARTA DESCRIPTIVA
  // ============================

  function initCartaDescriptiva() {
    const moduleKey = 'carta_descriptiva';

    const form = document.getElementById('form-carta');
    if (!form) {
      console.warn('[Carta] No se encontró el formulario principal.');
      return;
    }

    const sujetoInput = document.getElementById('og-sujeto');
    const accionInput = document.getElementById('og-accion');
    const condicionInput = document.getElementById('og-condicion');
    const criterioInput = document.getElementById('og-criterio');
    const preview = document.getElementById('preview-objetivo-general');

    const pDiag = document.getElementById('porc-diagnostica');
    const pFor = document.getElementById('porc-formativa');
    const pSum = document.getElementById('porc-sumativa');
    const pSat = document.getElementById('porc-satisfaccion');
    const pTotal = document.getElementById('total-porcentaje');

    const badgeEstado = document.getElementById('estado-guardado');

    const objetivosContainer = document.getElementById(
      'lista-objetivos-particulares'
    );
    const btnAgregarObjetivo = document.getElementById('btn-agregar-objetivo');

    const tbodyDesarrollo = document.getElementById('tabla-desarrollo-body');
    const btnAgregarTema = document.getElementById('btn-agregar-tema');

    const btnGuardar = document.getElementById('btn-guardar-carta');
    const btnCompletar = document.getElementById('btn-completar-carta');
    const btnValidar = document.getElementById('btn-validar-carta');
    const btnAyuda = document.getElementById('btn-ayuda-carta');

    // Cargar datos previos
    const stored = EC0301Manager.getModuleData(moduleKey) || {};
    const formData = stored.formData || {};
    let objetivosParticulares = stored.objetivosParticulares || [];
    let desarrolloFilas = stored.desarrollo || [];

    // Rellenar formulario con los datos guardados
    const elements = form.querySelectorAll('input, textarea, select');
    elements.forEach((el) => {
      if (!el.name) return;
      if (Object.prototype.hasOwnProperty.call(formData, el.name)) {
        if (el.type === 'checkbox') {
          el.checked = !!formData[el.name];
        } else {
          el.value = formData[el.name];
        }
      }
    });

    // Render de objetivos particulares
    function renderObjetivos() {
      if (!objetivosContainer) return;
      objetivosContainer.innerHTML = '';

      if (objetivosParticulares.length === 0) {
        const empty = document.createElement('p');
        empty.style.fontSize = '13px';
        empty.style.color = '#6b7280';
        empty.textContent =
          'Agrega al menos un objetivo particular para tu curso.';
        objetivosContainer.appendChild(empty);
        return;
      }

      objetivosParticulares.forEach((texto, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'op-item';
        wrapper.style.marginBottom = '12px';

        const label = document.createElement('label');
        label.style.fontSize = '13px';
        label.style.fontWeight = '500';
        label.textContent = `Objetivo particular ${index + 1}`;
        label.htmlFor = `op_${index}`;

        const textarea = document.createElement('textarea');
        textarea.id = `op_${index}`;
        textarea.name = `op_${index}`;
        textarea.rows = 2;
        textarea.style.width = '100%';
        textarea.value = texto || '';
        textarea.dataset.index = String(index);

        textarea.addEventListener('input', function () {
          const i = Number(this.dataset.index || '0');
          objetivosParticulares[i] = this.value;
          autoSave();
        });

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.style.marginTop = '4px';
        btnEliminar.style.fontSize = '12px';

        btnEliminar.addEventListener('click', function () {
          objetivosParticulares.splice(index, 1);
          renderObjetivos();
          autoSave();
        });

        wrapper.appendChild(label);
        wrapper.appendChild(textarea);
        wrapper.appendChild(btnEliminar);
        objetivosContainer.appendChild(wrapper);
      });
    }

    renderObjetivos();

    if (btnAgregarObjetivo) {
      btnAgregarObjetivo.addEventListener('click', function (e) {
        e.preventDefault();
        objetivosParticulares.push('');
        renderObjetivos();
        autoSave();
      });
    }

    // Render de tabla de desarrollo
    function renderDesarrollo() {
      if (!tbodyDesarrollo) return;
      tbodyDesarrollo.innerHTML = '';

      if (desarrolloFilas.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.style.fontSize = '13px';
        td.style.color = '#6b7280';
        td.textContent =
          'Agrega los temas y actividades que se desarrollarán durante el curso.';
        tr.appendChild(td);
        tbodyDesarrollo.appendChild(tr);
        return;
      }

      desarrolloFilas.forEach((fila, index) => {
        const tr = document.createElement('tr');

        function makeInput(campo, type) {
          const td = document.createElement('td');
          let input;
          if (campo === 'actividades' || campo === 'tecnicas') {
            input = document.createElement('textarea');
            input.rows = 2;
          } else {
            input = document.createElement('input');
            input.type = type || 'text';
          }
          input.name = `des_${campo}_${index}`;
          input.value = fila[campo] || '';
          input.dataset.index = String(index);
          input.dataset.field = campo;
          input.style.width = '100%';

          input.addEventListener('input', function () {
            const i = Number(this.dataset.index || '0');
            const f = this.dataset.field || '';
            if (!desarrolloFilas[i]) return;
            desarrolloFilas[i][f] = this.value;
            autoSave();
          });

          td.appendChild(input);
          return td;
        }

        tr.appendChild(makeInput('tema', 'text'));
        tr.appendChild(makeInput('actividades', 'text'));
        tr.appendChild(makeInput('duracion', 'number'));
        tr.appendChild(makeInput('tecnicas', 'text'));

        const tdAcc = document.createElement('td');
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.textContent = '✕';
        btnDel.addEventListener('click', function () {
          desarrolloFilas.splice(index, 1);
          renderDesarrollo();
          autoSave();
        });
        tdAcc.appendChild(btnDel);
        tr.appendChild(tdAcc);

        tbodyDesarrollo.appendChild(tr);
      });
    }

    renderDesarrollo();

    if (btnAgregarTema) {
      btnAgregarTema.addEventListener('click', function (e) {
        e.preventDefault();
        desarrolloFilas.push({
          tema: '',
          actividades: '',
          duracion: '',
          tecnicas: ''
        });
        renderDesarrollo();
        autoSave();
      });
    }

    // Vista previa del objetivo general
    function updatePreview() {
      if (!preview) return;
      const sujeto = (sujetoInput?.value || '').trim();
      const accion = (accionInput?.value || '').trim();
      const condicion = (condicionInput?.value || '').trim();
      const criterio = (criterioInput?.value || '').trim();

      if (!accion) {
        preview.textContent =
          'Complete los campos anteriores para visualizar el objetivo general…';
        return;
      }

      let text = sujeto || 'Al finalizar el curso, el participante';
      text += ' ' + accion;
      if (condicion) text += ' ' + condicion;
      if (criterio) text += ' ' + criterio;

      preview.textContent = text;
    }

    updatePreview();

    // Suma de porcentajes de evaluación
    function updatePorcentajes() {
      if (!pDiag || !pFor || !pSum || !pSat || !pTotal) return;
      const total =
        (Number(pDiag.value) || 0) +
        (Number(pFor.value) || 0) +
        (Number(pSum.value) || 0) +
        (Number(pSat.value) || 0);
      pTotal.value = String(total);

      pTotal.classList.remove('is-valid', 'is-invalid');
      if (total === 100) {
        pTotal.classList.add('is-valid');
      } else {
        pTotal.classList.add('is-invalid');
      }
    }

    updatePorcentajes();

    // Auto-guardado
    function collectFormData() {
      const data = {};
      const all = form.querySelectorAll('input, textarea, select');
      all.forEach((el) => {
        if (!el.name) return;
        if (el.type === 'checkbox') {
          data[el.name] = el.checked;
        } else {
          data[el.name] = el.value;
        }
      });
      return data;
    }

    function calcularAvance(data, objetivos, desarrollo) {
      let totalCampos = 0;
      let llenos = 0;

      const clavesRelevantes = [
        'og-accion',
        'og-condicion',
        'og-criterio',
        'porc-diagnostica',
        'porc-formativa',
        'porc-sumativa',
        'porc-satisfaccion'
      ];

      clavesRelevantes.forEach((k) => {
        totalCampos++;
        if (data[k] && String(data[k]).trim() !== '') llenos++;
      });

      if (objetivos && objetivos.length > 0) {
        totalCampos++;
        llenos++;
      }

      if (desarrollo && desarrollo.length > 0) {
        totalCampos++;
        llenos++;
      }

      if (totalCampos === 0) return 0;
      return Math.round((llenos / totalCampos) * 100);
    }

    function autoSave() {
      const data = collectFormData();
      const avance = calcularAvance(data, objetivosParticulares, desarrolloFilas);

      EC0301Manager.setModuleData(moduleKey, {
        formData: data,
        objetivosParticulares,
        desarrollo: desarrolloFilas,
        avance
      });

      if (badgeEstado) {
        badgeEstado.textContent = 'Cambios guardados.';
      }
    }

    // Listeners generales del formulario
    form.addEventListener('input', function () {
      updatePreview();
      updatePorcentajes();
      if (badgeEstado) badgeEstado.textContent = 'Guardando…';
      // pequeño delay para no saturar
      clearTimeout(autoSave._t);
      autoSave._t = setTimeout(autoSave, 400);
    });

    form.addEventListener('change', function () {
      updatePreview();
      updatePorcentajes();
      autoSave();
    });

    // Botones
    if (btnGuardar) {
      btnGuardar.addEventListener('click', function (e) {
        e.preventDefault();
        autoSave();
        alert('La carta descriptiva se ha guardado correctamente.');
      });
    }

    if (btnCompletar) {
      btnCompletar.addEventListener('click', function (e) {
        e.preventDefault();
        autoSave();

        // Marcamos el módulo como completado
        EC0301Manager.setModuleData(moduleKey, {
          completado: true
        });

        alert(
          'Módulo marcado como completado.\n\nAhora el siguiente módulo se desbloqueará en el dashboard.'
        );
        if (window.refreshDashboard) {
          window.refreshDashboard();
        }
      });
    }

    if (btnValidar) {
      btnValidar.addEventListener('click', function (e) {
        e.preventDefault();
        const errores = [];

        const data = collectFormData();
        const total =
          (Number(pDiag?.value) || 0) +
          (Number(pFor?.value) || 0) +
          (Number(pSum?.value) || 0) +
          (Number(pSat?.value) || 0);

        if (!data['og-accion'] || !String(data['og-accion']).trim()) {
          errores.push('Debes definir la acción/comportamiento observable.');
        }
        if (total !== 100) {
          errores.push(
            'La suma de los porcentajes de evaluación debe ser exactamente 100%.'
          );
        }
        if (!objetivosParticulares || objetivosParticulares.length === 0) {
          errores.push('Agrega al menos un objetivo particular.');
        }

        if (errores.length > 0) {
          alert(
            'Revisa los siguientes puntos antes de completar:\n\n- ' +
              errores.join('\n- ')
          );
        } else {
          alert(
            'Validación correcta.\n\nPuedes marcar el módulo como completado cuando lo consideres.'
          );
        }
      });
    }

    if (btnAyuda) {
      btnAyuda.addEventListener('click', function (e) {
        e.preventDefault();
        alert(
          'En este módulo defines el objetivo general, los objetivos particulares y el desarrollo del curso.\n\n• Completa el objetivo general.\n• Agrega objetivos particulares.\n• Define las evaluaciones y su porcentaje.\n• Agrega los temas y actividades del desarrollo.\n\nUsa "Guardar" con frecuencia. Cuando todo esté listo, pulsa "Completar módulo" para desbloquear el siguiente.'
        );
      });
    }
  }
})();
