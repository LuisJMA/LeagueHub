// js/views/placeholder-views.js

export function renderDashboard() {
  document.getElementById('app').innerHTML = `
    <h2> Dashboard</h2>
    <p>Resumen de la liga activa e indicadores generales.</p>
  `;
}

export function renderLeagues() {
  document.getElementById('app').innerHTML = `
    <h2> Gestión de Ligas</h2>
    <p>Listado de ligas creadas y opción para crear nueva liga.</p>
  `;
}

export function renderTeams() {
  document.getElementById('app').innerHTML = `
    <h2> Equipos</h2>
    <p>Listado de equipos pertenecientes a la liga activa.</p>
  `;
}

export function renderTeamDetail(id) {
  document.getElementById('app').innerHTML = `
    <h2> Detalle del Equipo</h2>
    <p>Mostrando información para el equipo ID: <strong>${id}</strong></p>
  `;
}

export function renderPlayers() {
  document.getElementById('app').innerHTML = `
    <h2> Jugadores</h2>
    <p>Catálogo global de jugadores registados.</p>
  `;
}

export function renderPlayerDetail(id) {
  document.getElementById('app').innerHTML = `
    <h2> Detalle del Jugador</h2>
    <p>Mostrando perfil individual para el jugador ID: <strong>${id}</strong></p>
  `;
}

export function renderMatches() {
  document.getElementById('app').innerHTML = `
    <h2> Partidos</h2>
    <p>Calendario y programación de la liga activa.</p>
  `;
}

export function renderMatchDetail(id) {
  document.getElementById('app').innerHTML = `
    <h2> Registro de Partido</h2>
    <p>Marcador y eventos para el partido ID: <strong>${id}</strong></p>
  `;
}

export function renderStats() {
  document.getElementById('app').innerHTML = `
    <h2> Tabla de Posiciones y Estadísticas</h2>
    <p>Clasificación actual y rankings de desempeño.</p>
  `;
}