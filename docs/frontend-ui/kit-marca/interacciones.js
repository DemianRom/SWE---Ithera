const feedback = document.querySelector('#button-feedback');
const save = document.querySelector('#demo-save');
const label = save.querySelector('span');
let pendingSave;
save.addEventListener('click', () => {
  save.disabled = true;
  label.textContent = 'Guardando…';
  feedback.textContent = 'Simulando el registro del gasto…';
  pendingSave = window.setTimeout(() => {
    label.textContent = 'Guardar gasto';
    save.disabled = false;
    feedback.textContent = 'Ejemplo completado: el gasto se guardaría en el viaje.';
  }, 800);
});
document.querySelector('#demo-details').addEventListener('click', () => {
  feedback.textContent = 'Ejemplo: aquí se abriría el detalle del gasto.';
});
document.querySelector('#demo-cancel').addEventListener('click', () => {
  window.clearTimeout(pendingSave);
  label.textContent = 'Guardar gasto';
  save.disabled = false;
  feedback.textContent = 'Ejemplo: se cancelaría la operación sin guardar cambios.';
});
