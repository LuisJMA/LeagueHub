// js/views/placeholder-views.js
import { dbGetAll, dbPut, setActiveLeague, getActiveLeague, dbGetByIndex } from '../services/db.js';
import { getSportTerms } from '../services/sports-terms.js';

export async function renderDashboard() {
  const app = document.getElementById('app');
  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    app.innerHTML = `
      <h2>Dashboard</h2>
      <p>Bienvenido a LeagueHub. Crea o selecciona una liga activa para ver el resumen del torneo.</p>
      <a href="#leagues">Ir a Gestión de Ligas</a>
    `;
    return;
  }

  const teams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);
  const matches = await dbGetByIndex('matches', 'leagueId', activeLeague.id);
  const terms = getSportTerms(activeLeague.sport);

  const completedMatches = matches.filter(m => m.status === 'completed');
  const pendingMatches = matches.filter(m => m.status !== 'completed');

  app.innerHTML = `
    <h2>Dashboard - ${activeLeague.name} (${terms.name})</h2>
    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
      <div style="background: #007bff; color: white; padding: 15px; border-radius: 5px; flex: 1;">
        <h3>Equipos</h3>
        <h2>${teams.length}</h2>
      </div>
      <div style="background: #28a745; color: white; padding: 15px; border-radius: 5px; flex: 1;">
        <h3>Partidos Jugados</h3>
        <h2>${completedMatches.length}</h2>
      </div>
      <div style="background: #ffc107; color: black; padding: 15px; border-radius: 5px; flex: 1;">
        <h3>Partidos Pendientes</h3>
        <h2>${pendingMatches.length}</h2>
      </div>
    </div>
    <a href="#stats">Ver Tabla de Posiciones Completa 📊</a>
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



export async function renderMatchDetail(id) {
  const app = document.getElementById('app');
  const activeLeague = await getActiveLeague();
  const terms = getSportTerms(activeLeague ? activeLeague.sport : 'futbol');

  const matches = await dbGetAll('matches');
  const match = matches.find(m => m.id === Number(id));

  if (!match) {
    app.innerHTML = '<h2>Partido no encontrado</h2><a href="#matches">Volver a partidos</a>';
    return;
  }

  const teams = await dbGetAll('teams');
  const homeTeam = teams.find(t => t.id === Number(match.homeTeamId));
  const awayTeam = teams.find(t => t.id === Number(match.awayTeamId));

  const allPlayers = await dbGetAll('players');
  const matchPlayers = allPlayers.filter(p => p.teamId === homeTeam.id || p.teamId === awayTeam.id);

  const events = await dbGetByIndex('events', 'matchId', match.id);

  let playersOptionsHTML = matchPlayers.map(p => `<option value="${p.id}">${p.name} (${p.teamId === homeTeam.id ? homeTeam.name : awayTeam.name})</option>`).join('');

  let eventsListHTML = events.map(e => {
    const player = allPlayers.find(p => p.id === Number(e.playerId));
    return `<li>${terms.icon} ${terms.event} de <strong>${player ? player.name : 'Jugador'}</strong> (Minuto ${e.minute}')</li>`;
  }).join('');

  app.innerHTML = `
    <h2>Registro de Partido ${terms.icon}</h2>
    <div style="background: #e9ecef; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
      <h3>${homeTeam ? homeTeam.name : 'Local'} vs ${awayTeam ? awayTeam.name : 'Visitante'}</h3>
      <h1 style="font-size: 3rem; margin: 10px 0;">${match.homeScore} - ${match.awayScore}</h1>
      <p><strong>Estado:</strong> ${match.status === 'completed' ? 'Finalizado 🏁' : 'En Curso / Pendiente ⏳'}</p>
    </div>

    ${match.status === 'completed' ? '<p style="color: green; font-weight: bold;">Este partido ya fue finalizado y sus puntos fueron sumados a la tabla.</p>' : `
      <form id="form-add-event" style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3>Anotar Evento (${terms.event})</h3>
        <div>
          <label>Jugador de la anotación:</label><br>
          <select id="event-player" required>${playersOptionsHTML}</select>
        </div>
        <div style="margin-top: 10px;">
          <label>Minuto / Tiempo:</label><br>
          <input type="number" id="event-minute" required placeholder="Ej: 25">
        </div>
        <button type="submit" style="margin-top: 15px;">Registrar ${terms.event}</button>
      </form>

      <button id="btn-finish-match" style="background: green; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer;">Finalizar Partido</button>
    `}

    <hr>
    <h3>Historial de ${terms.events}</h3>
    <ul>${eventsListHTML || '<p>No hay eventos registrados aún.</p>'}</ul>
    <br>
    <a href="#matches">⬅ Volver a Partidos</a>
  `;

  // Listener para agregar evento / gol / punto
  const eventForm = document.getElementById('form-add-event');
  if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const playerId = Number(document.getElementById('event-player').value);
      const minute = Number(document.getElementById('event-minute').value);
      const player = allPlayers.find(p => p.id === playerId);

      // Sumar marcador al equipo
      if (player.teamId === homeTeam.id) {
        match.homeScore += 1;
      } else {
        match.awayScore += 1;
      }

      // Guardar partido actualizado
      await dbPut('matches', match);

      // Registrar evento
      await dbPut('events', { matchId: match.id, playerId, minute, type: terms.event });

      // Sumar gol al jugador
      player.goals = (player.goals || 0) + 1;
      await dbPut('players', player);

      renderMatchDetail(id);
    });
  }

  // Listener para finalizar partido y actualizar estadísticas de equipos
  const finishBtn = document.getElementById('btn-finish-match');
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      match.status = 'completed';
      await dbPut('matches', match);

      // Actualizar tabla del Local
      homeTeam.pj = (homeTeam.pj || 0) + 1;
      homeTeam.gf = (homeTeam.gf || 0) + match.homeScore;
      homeTeam.gc = (homeTeam.gc || 0) + match.awayScore;

      // Actualizar tabla del Visitante
      awayTeam.pj = (awayTeam.pj || 0) + 1;
      awayTeam.gf = (awayTeam.gf || 0) + match.awayScore;
      awayTeam.gc = (awayTeam.gc || 0) + match.homeScore;

      // Puntos
      if (match.homeScore > match.awayScore) {
        homeTeam.pg = (homeTeam.pg || 0) + 1;
        homeTeam.points = (homeTeam.points || 0) + 3;
        awayTeam.pp = (awayTeam.pp || 0) + 1;
      } else if (match.homeScore < match.awayScore) {
        awayTeam.pg = (awayTeam.pg || 0) + 1;
        awayTeam.points = (awayTeam.points || 0) + 3;
        homeTeam.pp = (homeTeam.pp || 0) + 1;
      } else {
        homeTeam.pe = (homeTeam.pe || 0) + 1;
        awayTeam.pe = (awayTeam.pe || 0) + 1;
        homeTeam.points = (homeTeam.points || 0) + 1;
        awayTeam.points = (awayTeam.points || 0) + 1;
      }

      await dbPut('teams', homeTeam);
      await dbPut('teams', awayTeam);

      renderMatchDetail(id);
    });
  }
}

export function renderStats() {
  document.getElementById('app').innerHTML = `
    <h2>Tabla de Posiciones y Estadísticas</h2>
    <p>Clasificación actual y rankings de desempeño.</p>
  `;
}