// js/views/placeholder-views.js
import { dbGetAll, dbPut, setActiveLeague, getActiveLeague } from '../services/db.js';

export function renderDashboard() {
  document.getElementById('app').innerHTML = `
    <h2>Dashboard</h2>
    <p>Resumen de la liga activa e indicadores generales.</p>
  `;
}

export async function renderLeagues() {
  const app = document.getElementById('app');
  const leagues = await dbGetAll('leagues');
  const activeLeague = await getActiveLeague();

  // Actualizar el badge en la barra de navegación
  const badge = document.getElementById('active-league-badge');
  if (badge) {
    badge.textContent = activeLeague ? `Liga: ${activeLeague.name}` : 'Sin liga activa';
  }

  let leaguesListHTML = '';
  if (leagues.length === 0) {
    leaguesListHTML = '<p>No hay ligas registradas aún.</p>';
  } else {
    leaguesListHTML = leagues.map(l => `
      <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
        <h3>${l.name} ${l.isActive ? '🟢 (Activa)' : ''}</h3>
        <p><strong>Deporte:</strong> ${l.sport} | <strong>Formato:</strong> ${l.format}</p>
        ${!l.isActive ? `<button data-id="${l.id}" class="btn-activate">Establecer como Activa</button>` : ''}
      </div>
    `).join('');
  }

  app.innerHTML = `
    <h2>Gestión de Ligas</h2>
    <form id="form-create-league" style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
      <h3>Crear Nueva Liga</h3>
      <div>
        <label>Nombre:</label><br>
        <input type="text" id="league-name" required placeholder="Ej: Torneo Apertura">
      </div>
      <div style="margin-top: 10px;">
        <label>Deporte:</label><br>
        <select id="league-sport">
          <option value="futbol">Fútbol</option>
          <option value="basquet">Básquetbol</option>
          <option value="voley">Vóley</option>
        </select>
      </div>
      <div style="margin-top: 10px;">
        <label>Formato:</label><br>
        <select id="league-format">
          <option value="round-robin">Todos contra Todos</option>
          <option value="playoffs">Eliminación Directa</option>
        </select>
      </div>
      <button type="submit" style="margin-top: 15px;">Guardar Liga</button>
    </form>

    <hr>
    <h3>Ligas Creadas</h3>
    <div id="leagues-container">${leaguesListHTML}</div>
  `;

  // Listener para crear liga
  document.getElementById('form-create-league').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newLeague = {
      name: document.getElementById('league-name').value,
      sport: document.getElementById('league-sport').value,
      format: document.getElementById('league-format').value,
      isActive: leagues.length === 0 // Si es la primera, queda activa automáticamente
    };

    await dbPut('leagues', newLeague);
    renderLeagues();
  });

  // Listener para activar liga
  app.querySelectorAll('.btn-activate').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number(e.target.dataset.id);
      await setActiveLeague(id);
      renderLeagues();
    });
  });
}

export function renderTeams() {
  document.getElementById('app').innerHTML = `
    <h2>Equipos</h2>
    <p>Listado de equipos pertenecientes a la liga activa.</p>
  `;
}

export function renderTeamDetail(id) {
  document.getElementById('app').innerHTML = `
    <h2>Detalle del Equipo</h2>
    <p>Mostrando información para el equipo ID: <strong>${id}</strong></p>
  `;
}

export function renderPlayers() {
  document.getElementById('app').innerHTML = `
    <h2>Jugadores</h2>
    <p>Catálogo global de jugadores registrados.</p>
  `;
}

export function renderPlayerDetail(id) {
  document.getElementById('app').innerHTML = `
    <h2>Detalle del Jugador</h2>
    <p>Mostrando perfil individual para el jugador ID: <strong>${id}</strong></p>
  `;
}

export function renderMatches() {
  document.getElementById('app').innerHTML = `
    <h2>Partidos</h2>
    <p>Calendario y programación de la liga activa.</p>
  `;
}

export function renderMatchDetail(id) {
  document.getElementById('app').innerHTML = `
    <h2>Registro de Partido</h2>
    <p>Marcador y eventos para el partido ID: <strong>${id}</strong></p>
  `;
}

export function renderStats() {
  document.getElementById('app').innerHTML = `
    <h2>Tabla de Posiciones y Estadísticas</h2>
    <p>Clasificación actual y rankings de desempeño.</p>
  `;
}