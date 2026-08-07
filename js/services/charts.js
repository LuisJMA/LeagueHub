// js/services/charts.js

// Objeto global para almacenar las instancias de los gráficos activos
const activeCharts = {};

export function renderChart(canvasId, type, data, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destruir la instancia previa si existe
  if (activeCharts[canvasId]) {
    activeCharts[canvasId].destroy();
  }

  // Crear la nueva instancia obligando a mantener la proporción desactivada
  activeCharts[canvasId] = new Chart(canvas, {
    type: type,
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false, // OBLIGATORIO para detener el crecimiento infinito
      ...options
    }
  });
}