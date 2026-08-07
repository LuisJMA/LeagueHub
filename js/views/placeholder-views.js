// js/views/placeholder-views.js
import { dbGetAll, dbPut, setActiveLeague, getActiveLeague, dbGetByIndex } from '../services/db.js';

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



// Reemplaza la función renderTeams en js/views/placeholder-views.js
export async function renderTeams() {
  const app = document.getElementById('app');
  const activeLeague = await getActiveLeague();

  // Validación: Si no hay liga activa, no se pueden crear equipos
  if (!activeLeague) {
    app.innerHTML = `
      <h2>Gestión de Equipos</h2>
      <p style="color: red; font-weight: bold;">⚠️ Debes activar o crear una liga primero en la sección de Ligas para poder gestionar equipos.</p>
      <a href="#leagues">Ir a Gestión de Ligas</a>
    `;
    return;
  }

  // Obtener solo los equipos pertenecientes a la liga activa
  const teams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);

  let teamsListHTML = '';
  if (teams.length === 0) {
    teamsListHTML = '<p>No hay equipos registrados en esta liga aún.</p>';
  } else {
    teamsListHTML = teams.map(t => `
      <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
        <h3>${t.name}</h3>
        <p><strong>PJ:</strong> ${t.pj || 0} | <strong>PG:</strong> ${t.pg || 0} | <strong>PP:</strong> ${t.pp || 0} | <strong>Puntos:</strong> ${t.points || 0}</p>
        <a href="#team/${t.id}">Ver Detalle del Equipo</a>
      </div>
    `).join('');
  }

  app.innerHTML = `
    <h2>Gestión de Equipos (${activeLeague.name})</h2>
    <form id="form-create-team" style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
      <h3>Registrar Nuevo Equipo</h3>
      <div>
        <label>Nombre del Equipo:</label><br>
        <input type="text" id="team-name" required placeholder="Ej: Los Rayos FC">
      </div>
      <button type="submit" style="margin-top: 15px;">Guardar Equipo</button>
    </form>

    <hr>
    <h3>Equipos de la Liga</h3>
    <div id="teams-container">${teamsListHTML}</div>
  `;

  // Listener para crear equipo
  document.getElementById('form-create-team').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newTeam = {
      leagueId: activeLeague.id,
      name: document.getElementById('team-name').value,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      points: 0
    };

    await dbPut('teams', newTeam);
    renderTeams(); // Recargar vista
  });
}

export function renderTeamDetail(id) {
  document.getElementById('app').innerHTML = `
    <h2>Detalle del Equipo</h2>
    <p>Mostrando información para el equipo ID: <strong>${id}</strong></p>
  `;
}




export async function renderPlayers() {
  const app = document.getElementById('app');
  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    app.innerHTML = `
      <h2>Gestión de Jugadores</h2>
      <p style="color: red; font-weight: bold;">⚠️ Debes activar o crear una liga primero para gestionar jugadores.</p>
      <a href="#leagues">Ir a Gestión de Ligas</a>
    `;
    return;
  }

  // Traemos los equipos de la liga activa para el select del formulario
  const teams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);
  const allPlayers = await dbGetAll('players');

  // Filtramos los jugadores que pertenecen a los equipos de la liga activa
  const teamIds = teams.map(t => t.id);
  const leaguePlayers = allPlayers.filter(p => teamIds.includes(Number(p.teamId)));

  let teamsOptionsHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  
  let playersListHTML = '';
  if (leaguePlayers.length === 0) {
    playersListHTML = '<p>No hay jugadores registrados en los equipos de esta liga.</p>';
  } else {
    playersListHTML = leaguePlayers.map(p => {
      const playerTeam = teams.find(t => t.id === Number(p.teamId));
      return `
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
          <h3>${p.name} (#${p.dorsal})</h3>
          <p><strong>Equipo:</strong> ${playerTeam ? playerTeam.name : 'Sin equipo'} | <strong>Posición:</strong> ${p.position}</p>
          <p><strong>Anotaciones/Goles:</strong> ${p.goals || 0}</p>
          <a href="#player/${p.id}">Ver Perfil del Jugador</a>
        </div>
      `;
    }).join('');
  }

  app.innerHTML = `
    <h2>Gestión de Jugadores (${activeLeague.name})</h2>

    ${teams.length === 0 ? '<p style="color: orange;">⚠️ Debes crear al menos un equipo antes de registrar jugadores.</p>' : `
      <form id="form-create-player" style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3>Registrar Nuevo Jugador</h3>
        <div>
          <label>Nombre Completo:</label><br>
          <input type="text" id="player-name" required placeholder="Ej: Lionel Messi">
        </div>
        <div style="margin-top: 10px;">
          <label>Dorsal / Número:</label><br>
          <input type="number" id="player-dorsal" required placeholder="10">
        </div>
        <div style="margin-top: 10px;">
          <label>Posición:</label><br>
          <input type="text" id="player-position" placeholder="Ej: Delantero / Base / Rematador">
        </div>
        <div style="margin-top: 10px;">
          <label>Equipo:</label><br>
          <select id="player-team" required>
            ${teamsOptionsHTML}
          </select>
        </div>
        <button type="submit" style="margin-top: 15px;">Guardar Jugador</button>
      </form>
    `}

    <hr>
    <h3>Jugadores Registrados</h3>
    <div id="players-container">${playersListHTML}</div>
  `;

  const form = document.getElementById('form-create-player');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPlayer = {
        name: document.getElementById('player-name').value,
        dorsal: Number(document.getElementById('player-dorsal').value),
        position: document.getElementById('player-position').value,
        teamId: Number(document.getElementById('player-team').value),
        goals: 0
      };

      await dbPut('players', newPlayer);
      renderPlayers(); // Recargar vista
    });
  }
}

export async function renderPlayerDetail(id) {
  const app = document.getElementById('app');
  const players = await dbGetAll('players');
  const player = players.find(p => p.id === Number(id));

  if (!player) {
    app.innerHTML = '<h2>Jugador no encontrado</h2><a href="#players">Volver</a>';
    return;
  }

  const teams = await dbGetAll('teams');
  const team = teams.find(t => t.id === Number(player.teamId));

  app.innerHTML = `
    <h2>Perfil de Jugador</h2>
    <div style="border: 1px solid #ccc; padding: 20px; border-radius: 5px;">
      <h3>${player.name}</h3>
      <p><strong>Dorsal:</strong> #${player.dorsal}</p>
      <p><strong>Posición:</strong> ${player.position}</p>
      <p><strong>Equipo actual:</strong> ${team ? team.name : 'Desconocido'}</p>
      <p><strong>Goles / Puntos anotados:</strong> ${player.goals || 0}</p>
    </div>
    <br>
    <a href="#players">⬅ Volver a Jugadores</a>
  `;
}




export async function renderMatches() {
  const app = document.getElementById('app');
  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    app.innerHTML = `
      <h2>Gestión de Partidos</h2>
      <p style="color: red; font-weight: bold;">⚠️ Debes activar o crear una liga primero para gestionar partidos.</p>
      <a href="#leagues">Ir a Gestión de Ligas</a>
    `;
    return;
  }

  const teams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);
  const matches = await dbGetByIndex('matches', 'leagueId', activeLeague.id);

  let teamsOptionsHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  let matchesListHTML = '';
  if (matches.length === 0) {
    matchesListHTML = '<p>No hay partidos programados en esta liga.</p>';
  } else {
    matchesListHTML = matches.map(m => {
      const home = teams.find(t => t.id === Number(m.homeTeamId));
      const away = teams.find(t => t.id === Number(m.awayTeamId));
      return `
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
          <h4>${home ? home.name : 'Equipo 1'} vs ${away ? away.name : 'Equipo 2'}</h4>
          <p><strong>Estado:</strong> ${m.status === 'completed' ? 'Finalizado 🏁' : 'Pendiente ⏳'}</p>
          <p><strong>Resultado:</strong> ${m.homeScore ?? 0} - ${m.awayScore ?? 0}</p>
          <a href="#match/${m.id}">Cargar Marcador / Eventos</a>
        </div>
      `;
    }).join('');
  }

  app.innerHTML = `
    <h2>Programación de Partidos (${activeLeague.name})</h2>

    ${teams.length < 2 ? '<p style="color: orange;">⚠️ Necesitas al menos 2 equipos para programar un partido.</p>' : `
      <form id="form-create-match" style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3>Programar Nuevo Partido</h3>
        <div>
          <label>Equipo Local:</label><br>
          <select id="home-team" required>${teamsOptionsHTML}</select>
        </div>
        <div style="margin-top: 10px;">
          <label>Equipo Visitante:</label><br>
          <select id="away-team" required>${teamsOptionsHTML}</select>
        </div>
        <button type="submit" style="margin-top: 15px;">Crear Partido</button>
      </form>
    `}

    <hr>
    <h3>Calendario de Partidos</h3>
    <div id="matches-container">${matchesListHTML}</div>
  `;

  const form = document.getElementById('form-create-match');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const homeId = Number(document.getElementById('home-team').value);
      const awayId = Number(document.getElementById('away-team').value);

      if (homeId === awayId) {
        alert('El equipo local y el visitante no pueden ser el mismo.');
        return;
      }

      const newMatch = {
        leagueId: activeLeague.id,
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeScore: 0,
        awayScore: 0,
        status: 'scheduled'
      };

      await dbPut('matches', newMatch);
      renderMatches();
    });
  }
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