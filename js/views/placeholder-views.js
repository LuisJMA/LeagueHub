// js/views/placeholder-views.js
import { dbGetAll, dbPut, dbDelete, setActiveLeague, getActiveLeague, dbGetByIndex, finishMatchTransaction, undoMatchTransaction, generateLeagueFixtureTransaction, exportDatabase, importDatabase, deleteLeagueCascade } from '../services/db.js';
import { getSportTerms } from '../services/sports-terms.js';
import { renderChart } from '../services/charts.js';


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
  const players = await dbGetAll('players');
  const terms = getSportTerms(activeLeague.sport);

  const completedMatches = matches.filter(m => m.status === 'completed');
  const pendingMatches = matches.filter(m => m.status !== 'completed');

  // Filtrar jugadores de la liga actual
  const teamIds = teams.map(t => t.id);
  const leaguePlayers = players
    .filter(p => teamIds.includes(Number(p.teamId)))
    .sort((a, b) => (b.goals || 0) - (a.goals || 0));

  // 1. Inserción del HTML con los canvas para los gráficos
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

    <!-- Sección de Gráficos del Dashboard -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3>Top 5 ${terms.ranking}</h3>
        <canvas id="chart-top-scorers"></canvas>
      </div>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3>Estado de Partidos</h3>
        <canvas id="chart-matches-status"></canvas>
      </div>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3>${terms.gf} por Equipo</h3>
        <canvas id="chart-teams-offense"></canvas>
      </div>
    </div>

    <br>
    <a href="#stats">Ver Tabla de Posiciones Completa 📊</a>
  `;

  // 2. Renderizado de gráficos
  renderChart('chart-top-scorers', 'bar', {
    labels: leaguePlayers.slice(0, 5).map(p => p.name),
    datasets: [{
      label: terms.events,
      data: leaguePlayers.slice(0, 5).map(p => p.goals || 0),
      backgroundColor: '#007bff'
    }]
  });

  renderChart('chart-matches-status', 'doughnut', {
    labels: ['Jugados', 'Pendientes'],
    datasets: [{
      data: [completedMatches.length, pendingMatches.length],
      backgroundColor: ['#28a745', '#ffc107']
    }]
  });

  renderChart('chart-teams-offense', 'bar', {
    labels: teams.map(t => t.name),
    datasets: [{
      label: terms.gf,
      data: teams.map(t => t.gf || 0),
      backgroundColor: '#17a2b8'
    }]
  });
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
      <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3>${l.name} ${l.isActive ? '🟢 (Activa)' : ''}</h3>
          <p>
            <strong>Deporte:</strong> ${l.sport} | 
            <strong>Formato:</strong> ${l.format === 'playoffs' ? 'Eliminación Directa' : 'Todos contra Todos'} 
            ${l.format === 'league' || l.format === 'round-robin' ? `(${l.rounds || 1} vuelta/s)` : `(Máx. ${l.maxTeams || '4, 8 o 16'} eq.)`}
          </p>
        </div>
        <div>
          ${!l.isActive ? `<button data-id="${l.id}" class="btn-activate">Establecer como Activa</button>` : ''}
          <button data-id="${l.id}" class="btn-delete-league" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;">🗑️ Eliminar</button>
        </div>
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
          <option value="round-robin">Todos contra Todos (Liga)</option>
          <option value="playoffs">Eliminación Directa (Playoffs)</option>
        </select>
      </div>

      <!-- Configuración Dinámica -->
      <div id="group-rounds" style="margin-top: 10px;">
        <label>Vueltas:</label><br>
        <select id="league-rounds">
          <option value="1">1 (Ida sola)</option>
          <option value="2">2 (Ida y Vuelta)</option>
        </select>
      </div>

      <div id="group-max-teams" style="margin-top: 10px; display: none;">
        <label>Cantidad de Equipos Permitidos:</label><br>
        <select id="league-max-teams">
          <option value="4">4 Equipos (Semifinales directas)</option>
          <option value="8">8 Equipos (Cuartos de final)</option>
          <option value="16">16 Equipos (Octavos de final)</option>
        </select>
      </div>

      <button type="submit" style="margin-top: 15px;">Guardar Liga</button>
    </form>

    <hr>
    <h3>Ligas Creadas</h3>
    <div id="leagues-container">${leaguesListHTML}</div>
  `;

  // Cambiar campos dinámicos según el formato
  const formatSelect = document.getElementById('league-format');
  const roundsGroup = document.getElementById('group-rounds');
  const maxTeamsGroup = document.getElementById('group-max-teams');

  formatSelect.addEventListener('change', (e) => {
    if (e.target.value === 'playoffs') {
      roundsGroup.style.display = 'none';
      maxTeamsGroup.style.display = 'block';
    } else {
      roundsGroup.style.display = 'block';
      maxTeamsGroup.style.display = 'none';
    }
  });

  // Listener para crear liga
  document.getElementById('form-create-league').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formatValue = document.getElementById('league-format').value;
    
    const newLeague = {
      name: document.getElementById('league-name').value,
      sport: document.getElementById('league-sport').value,
      format: formatValue,
      rounds: formatValue === 'playoffs' ? 1 : Number(document.getElementById('league-rounds').value),
      maxTeams: formatValue === 'playoffs' ? Number(document.getElementById('league-max-teams').value) : null,
      isActive: leagues.length === 0
    };

    const newId = await dbPut('leagues', newLeague);
    if (leagues.length === 0) {
      await setActiveLeague(newId);
    }
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

  // Listener para eliminar liga en cascada
  app.querySelectorAll('.btn-delete-league').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number(e.target.dataset.id);
      if (confirm('¿Seguro que deseas eliminar esta liga? Se borrarán en cascada todos sus equipos, jugadores, partidos y eventos de forma permanente.')) {
        const currentActive = await getActiveLeague();
        await deleteLeagueCascade(id);
        if (currentActive && currentActive.id === id) {
          localStorage.removeItem('activeLeagueId');
        }
        renderLeagues();
      }
    });
  });
}


export async function renderTeams() {
  const app = document.getElementById('app');
  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    app.innerHTML = `
      <h2>Gestión de Equipos</h2>
      <p style="color: red; font-weight: bold;">⚠️ Debes activar o crear una liga primero en la sección de Ligas para poder gestionar equipos.</p>
      <a href="#leagues">Ir a Gestión de Ligas</a>
    `;
    return;
  }

  const teams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);

  let teamsListHTML = '';
  if (teams.length === 0) {
    teamsListHTML = '<p>No hay equipos registrados en esta liga aún.</p>';
  } else {
    teamsListHTML = teams.map(t => `
      <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3>${t.name}</h3>
          <p><strong>PJ:</strong> ${t.pj || 0} | <strong>PG:</strong> ${t.pg || 0} | <strong>PP:</strong> ${t.pp || 0} | <strong>Puntos:</strong> ${t.points || 0}</p>
          <a href="#team/${t.id}">Ver Detalle del Equipo</a>
        </div>
        <button class="btn-delete-team" data-id="${t.id}" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
          🗑️ Eliminar
        </button>
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

  // Listener para crear equipo con validación de nombre único
  document.getElementById('form-create-team').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('team-name').value.trim();

    if (!nameInput) {
      alert('⚠️ El nombre del equipo no puede estar vacío.');
      return;
    }

    const existingTeams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);
    const isDuplicate = existingTeams.some(t => t.name.toLowerCase() === nameInput.toLowerCase());

    if (isDuplicate) {
      alert(`⚠️ Ya existe un equipo llamado "${nameInput}" en esta liga.`);
      return;
    }

    const newTeam = {
      leagueId: activeLeague.id,
      name: nameInput,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      points: 0
    };

    await dbPut('teams', newTeam);
    renderTeams();
  });

  app.querySelectorAll('.btn-delete-team').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const teamId = e.target.dataset.id;
      if (confirm('¿Seguro que deseas eliminar este equipo?')) {
        await dbDelete('teams', teamId);
        renderTeams();
      }
    });
  });
}


export async function renderTeamDetail(id) {
  const app = document.getElementById('app');
  const teamId = Number(id);

  const teams = await dbGetAll('teams');
  const team = teams.find(t => t.id === teamId);

  if (!team) {
    app.innerHTML = '<h2>Equipo no encontrado</h2><a href="#teams">Volver a equipos</a>';
    return;
  }

  const activeLeague = await getActiveLeague();
  const terms = getSportTerms(activeLeague ? activeLeague.sport : 'futbol');

  // Obtener jugadores del equipo
  const allPlayers = await dbGetAll('players');
  const teamPlayers = allPlayers.filter(p => Number(p.teamId) === teamId);

  // Obtener partidos del equipo (como local o visitante)
  const matches = await dbGetByIndex('matches', 'leagueId', team.leagueId);
  const teamMatches = matches.filter(m => Number(m.homeTeamId) === teamId || Number(m.awayTeamId) === teamId);

  let playersListHTML = teamPlayers.map(p => `
    <li>
      <strong>${p.name}</strong> (#${p.dorsal}) - ${p.position || 'Sin posición'} | 
      <strong>${terms.events}:</strong> ${p.goals || 0}
    </li>
  `).join('');

  let matchesListHTML = teamMatches.map(m => {
    const isHome = Number(m.homeTeamId) === teamId;
    const opponentId = isHome ? m.awayTeamId : m.homeTeamId;
    const opponent = teams.find(t => t.id === Number(opponentId));
    const opponentName = opponent ? opponent.name : 'Rival Desconocido';

    const resultText = m.status === 'completed' 
      ? `${m.homeScore} - ${m.awayScore}` 
      : 'Pendiente';

    return `
      <li>
        ${isHome ? '<strong>(Local)</strong> vs' : '<strong>(Visitante)</strong> @'} ${opponentName} 
        | Marcador: <strong>${resultText}</strong> 
        | Estado: ${m.status === 'completed' ? 'Finalizado 🏁' : 'Programado ⏳'}
      </li>
    `;
  }).join('');

  const diff = (team.gf || 0) - (team.gc || 0);

  app.innerHTML = `
    <h2>Detalle del Equipo: ${team.name}</h2>
    
    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
      <h3>Estadísticas Generales</h3>
      <p><strong>Puntos:</strong> ${team.points || 0}</p>
      <p><strong>Partidos Jugados:</strong> ${team.pj || 0} (PG: ${team.pg || 0} | PE: ${team.pe || 0} | PP: ${team.pp || 0})</p>
      <p><strong>${terms.gf}:</strong> ${team.gf || 0} | <strong>${terms.gc}:</strong> ${team.gc || 0} | <strong>DIF:</strong> ${diff > 0 ? '+' + diff : diff}</p>
    </div>

    <h3>Plantilla de Jugadores</h3>
    <ul>${playersListHTML || '<p>No hay jugadores asignados a este equipo.</p>'}</ul>

    <hr>
    <h3>Historial de Partidos</h3>
    <ul>${matchesListHTML || '<p>No hay partidos registrados para este equipo.</p>'}</ul>

    <br>
    <a href="#teams">⬅ Volver a Equipos</a>
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

  const teams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);
  const allPlayers = await dbGetAll('players');

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
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3>${p.name} (#${p.dorsal})</h3>
            <p><strong>Equipo:</strong> ${playerTeam ? playerTeam.name : 'Sin equipo'} | <strong>Posición:</strong> ${p.position}</p>
            <p><strong>Anotaciones/Goles:</strong> ${p.goals || 0}</p>
            <a href="#player/${p.id}">Ver Perfil del Jugador</a>
          </div>
          <button class="btn-delete-player" data-id="${p.id}" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
            🗑️ Eliminar
          </button>
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
          <input type="number" id="player-dorsal" required placeholder="10" min="0" max="99">
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

  // Listener para crear jugador con validación de dorsal único
  const form = document.getElementById('form-create-player');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('player-name').value.trim();
      const dorsal = Number(document.getElementById('player-dorsal').value);
      const position = document.getElementById('player-position').value.trim();
      const teamId = Number(document.getElementById('player-team').value);

      if (!name) {
        alert('⚠️ El nombre del jugador no puede estar vacío.');
        return;
      }

      if (isNaN(dorsal) || dorsal < 0 || dorsal > 99) {
        alert('⚠️ Ingresa un número de dorsal válido (entre 0 y 99).');
        return;
      }

      const duplicateDorsal = allPlayers.some(p => Number(p.teamId) === teamId && Number(p.dorsal) === dorsal);
      if (duplicateDorsal) {
        alert(`⚠️ El dorsal #${dorsal} ya está asignado a otro jugador en este equipo.`);
        return;
      }

      const newPlayer = {
        name,
        dorsal,
        position: position || 'Sin posición',
        teamId,
        goals: 0
      };

      await dbPut('players', newPlayer);
      renderPlayers();
    });
  }

  app.querySelectorAll('.btn-delete-player').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const playerId = e.target.dataset.id;
      if (confirm('¿Seguro que deseas eliminar este jugador?')) {
        await dbDelete('players', playerId);
        renderPlayers();
      }
    });
  });
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

  const rounds = [...new Set(matches.map(m => m.round).filter(Boolean))].sort((a, b) => a - b);
  
  let teamsOptionsHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  let roundsOptionsHTML = rounds.map(r => `<option value="${r}">Jornada / Ronda ${r}</option>`).join('');

  const renderMatchesList = (selectedRound = 'all') => {
    const container = document.getElementById('matches-container');
    if (!container) return;

    const filteredMatches = selectedRound === 'all' 
      ? matches 
      : matches.filter(m => m.round === Number(selectedRound));

    if (filteredMatches.length === 0) {
      container.innerHTML = '<p>No hay partidos para mostrar en esta jornada.</p>';
      return;
    }

    container.innerHTML = filteredMatches.map(m => {
      const home = teams.find(t => t.id === Number(m.homeTeamId));
      const away = teams.find(t => t.id === Number(m.awayTeamId));
      return `
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
          <small><strong>Jornada:</strong> ${m.round || 'N/A'}</small>
          <h4>${home ? home.name : 'Equipo 1'} vs ${away ? away.name : 'Equipo 2'}</h4>
          <p><strong>Estado:</strong> ${m.status === 'completed' ? 'Finalizado 🏁' : 'Pendiente ⏳'}</p>
          <p><strong>Resultado:</strong> ${m.homeScore ?? 0} - ${m.awayScore ?? 0}</p>
          <a href="#match/${m.id}">Cargar Marcador / Eventos</a>
        </div>
      `;
    }).join('');
  };

  app.innerHTML = `
    <h2>Programación de Partidos (${activeLeague.name})</h2>

    <div style="background: #e2e3e5; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
      <h3>Generación Automática</h3>
      <p>Crea el calendario completo para los ${teams.length} equipos de esta liga.</p>
      <button id="btn-generate-fixture" style="background: #17a2b8; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">
        ⚡ Generar Fixture Automático
      </button>
    </div>

    ${teams.length < 2 ? '<p style="color: orange;">⚠️ Necesitas al menos 2 equipos para programar un partido.</p>' : `
      <form id="form-create-match" style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3>Programar Nuevo Partido Manual</h3>
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3>Calendario de Partidos</h3>
      ${rounds.length > 0 ? `
        <div>
          <label><strong>Filtrar por Jornada:</strong></label>
          <select id="filter-round" style="padding: 5px; margin-left: 5px;">
            <option value="all">Todas las jornadas</option>
            ${roundsOptionsHTML}
          </select>
        </div>
      ` : ''}
    </div>

    <div id="matches-container"></div>
  `;

  renderMatchesList();

  const filterSelect = document.getElementById('filter-round');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      renderMatchesList(e.target.value);
    });
  }

  // Listener para crear partido manual con validación de equipos distintos
  const form = document.getElementById('form-create-match');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const homeId = Number(document.getElementById('home-team').value);
      const awayId = Number(document.getElementById('away-team').value);

      if (homeId === awayId) {
        alert('⚠️ El equipo local y el visitante no pueden ser el mismo.');
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

  const genBtn = document.getElementById('btn-generate-fixture');
  if (genBtn) {
    genBtn.addEventListener('click', async () => {
      if (confirm('¿Generar el calendario automático? Si ya existen partidos se sumarán al listado.')) {
        try {
          await generateLeagueFixtureTransaction(activeLeague.id);
          renderMatches();
        } catch (err) {
          alert(err.message || err);
        }
      }
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

    ${match.status === 'completed' ? `
      <p style="color: green; font-weight: bold;">Este partido ya fue finalizado y sus puntos fueron sumados a la tabla.</p>
      <button id="btn-undo-match" style="background: #dc3545; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer;">
        ↩️ Revertir Partido (Volver a Pendiente)
      </button>
    ` : `
      <form id="form-add-event" style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3>Anotar Evento (${terms.event})</h3>
        <div>
          <label>Jugador de la anotación:</label><br>
          <select id="event-player" required>${playersOptionsHTML}</select>
        </div>
        <div style="margin-top: 10px;">
          <label>Minuto / Tiempo:</label><br>
          <input type="number" id="event-minute" required placeholder="Ej: 25" min="1">
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

  // Listener para agregar evento con validación del tiempo/minuto positivo
  const eventForm = document.getElementById('form-add-event');
  if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const playerId = Number(document.getElementById('event-player').value);
      const minute = Number(document.getElementById('event-minute').value);

      if (isNaN(minute) || minute < 1) {
        alert('⚠️ Por favor ingresa un minuto o tiempo válido mayor a 0.');
        return;
      }

      const player = allPlayers.find(p => p.id === playerId);
      if (!player) {
        alert('⚠️ Error al identificar el jugador.');
        return;
      }

      if (player.teamId === homeTeam.id) {
        match.homeScore += 1;
      } else {
        match.awayScore += 1;
      }

      await dbPut('matches', match);
      await dbPut('events', { matchId: match.id, playerId, minute, type: terms.event });

      player.goals = (player.goals || 0) + 1;
      await dbPut('players', player);

      renderMatchDetail(id);
    });
  }

  const finishBtn = document.getElementById('btn-finish-match');
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      try {
        await finishMatchTransaction(match.id, match.homeScore, match.awayScore);
        renderMatchDetail(id);
      } catch (err) {
        alert(err.message || 'Error al finalizar el partido');
      }
    });
  }

  const undoBtn = document.getElementById('btn-undo-match');
  if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
      if (confirm('¿Deseas revertir este partido? Se restarán los puntos y goles acumulados en la tabla.')) {
        try {
          await undoMatchTransaction(match.id);
          renderMatchDetail(id);
        } catch (err) {
          alert(err.message || 'Error al revertir el partido');
        }
      }
    });
  }
}


export async function renderStats() {
  const app = document.getElementById('app');
  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    app.innerHTML = `
      <h2>Tabla de Posiciones y Estadísticas</h2>
      <p style="color: red; font-weight: bold;">⚠️ Selecciona una liga activa primero.</p>
      <a href="#leagues">Ir a Ligas</a>
    `;
    return;
  }

  const terms = getSportTerms(activeLeague.sport);
  const teams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);
  const matches = await dbGetByIndex('matches', 'leagueId', activeLeague.id);
  const allPlayers = await dbGetAll('players');

  // Ordenar equipos por Puntos y luego por Diferencia de Goles/Puntos
  teams.sort((a, b) => {
    const diffA = (a.gf || 0) - (a.gc || 0);
    const diffB = (b.gf || 0) - (b.gc || 0);
    if ((b.points || 0) !== (a.points || 0)) {
      return (b.points || 0) - (a.points || 0);
    }
    return diffB - diffA;
  });

  // Filtrar y ordenar goleadores/anotadores
  const teamIds = teams.map(t => t.id);
  const leaguePlayers = allPlayers
    .filter(p => teamIds.includes(Number(p.teamId)))
    .sort((a, b) => (b.goals || 0) - (a.goals || 0));

  let standingsRows = teams.map((t, index) => {
    const diff = (t.gf || 0) - (t.gc || 0);
    return `
      <tr>
        <td><strong>${index + 1}</strong></td>
        <td>${t.name}</td>
        <td>${t.pj || 0}</td>
        <td>${t.pg || 0}</td>
        <td>${t.pe || 0}</td>
        <td>${t.pp || 0}</td>
        <td>${t.gf || 0}</td>
        <td>${t.gc || 0}</td>
        <td>${diff > 0 ? '+' + diff : diff}</td>
        <td><strong>${t.points || 0}</strong></td>
      </tr>
    `;
  }).join('');

  let topScorersRows = leaguePlayers.slice(0, 5).map((p, index) => {
    const playerTeam = teams.find(t => t.id === Number(p.teamId));
    return `
      <tr>
        <td><strong>${index + 1}</strong></td>
        <td>${p.name}</td>
        <td>${playerTeam ? playerTeam.name : 'N/A'}</td>
        <td><strong>${p.goals || 0}</strong></td>
      </tr>
    `;
  }).join('');

  // 1. Inserción del HTML con la tabla + los canvas
  app.innerHTML = `
    <h2>Tabla de Posiciones (${activeLeague.name})</h2>
    <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 30px;">
      <thead>
        <tr style="background: #f4f4f4;">
          <th>#</th>
          <th>Equipo</th>
          <th>PJ</th>
          <th>PG</th>
          <th>PE</th>
          <th>PP</th>
          <th>${terms.gf}</th>
          <th>${terms.gc}</th>
          <th>DIF</th>
          <th>PTS</th>
        </tr>
      </thead>
      <tbody>
        ${standingsRows || '<tr><td colspan="10">No hay equipos registrados</td></tr>'}
      </tbody>
    </table>

    <h3>Top 5 ${terms.ranking} 🏆</h3>
    <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 30px;">
      <thead>
        <tr style="background: #f4f4f4;">
          <th>#</th>
          <th>Jugador</th>
          <th>Equipo</th>
          <th>${terms.events}</th>
        </tr>
      </thead>
      <tbody>
        ${topScorersRows || '<tr><td colspan="4">No hay datos registrados</td></tr>'}
      </tbody>
    </table>

    <!-- Sección de Gráficos de Estadísticas -->
    <h3>Análisis Gráfico</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3>Promedio de ${terms.gf} por Partido</h3>
        <canvas id="chart-team-avg"></canvas>
      </div>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3>Distribución de Resultados</h3>
        <canvas id="chart-results-distribution"></canvas>
      </div>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3>Tabla de Puntos Acumulados</h3>
        <canvas id="chart-points-leaderboard"></canvas>
      </div>
    </div>
  `;

  // Datos para gráfico de resultados
  const completed = matches.filter(m => m.status === 'completed');
  const homeWins = completed.filter(m => m.homeScore > m.awayScore).length;
  const awayWins = completed.filter(m => m.awayScore > m.homeScore).length;
  const draws = completed.filter(m => m.homeScore === m.awayScore).length;

  // 2. Renderizado de gráficos de estadísticas
  renderChart('chart-team-avg', 'bar', {
    labels: teams.map(t => t.name),
    datasets: [{
      label: 'Promedio',
      data: teams.map(t => t.pj ? (t.gf / t.pj).toFixed(2) : 0),
      backgroundColor: '#e83e8c'
    }]
  }, { indexAxis: 'y' });

  renderChart('chart-results-distribution', 'pie', {
    labels: ['Victorias Local', 'Empates', 'Victorias Visitante'],
    datasets: [{
      data: [homeWins, draws, awayWins],
      backgroundColor: ['#007bff', '#6c757d', '#dc3545']
    }]
  });

  renderChart('chart-points-leaderboard', 'line', {
    labels: teams.map(t => t.name),
    datasets: [{
      label: 'Puntos Totales',
      data: teams.map(t => t.points || 0),
      borderColor: '#28a745',
      backgroundColor: 'rgba(40, 167, 69, 0.2)',
      fill: true
    }]
  });
}


export async function renderSettings() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <h2>Configuración y Copia de Seguridad </h2>
    <p>Administra los datos guardados en la aplicación.</p>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
      <h3>📦 Exportar Datos</h3>
      <p>Descarga un archivo '.json' con todas las ligas, equipos, partidos y estadísticas actualizadas.</p>
      <button id="btn-export-db" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer;">
        ⬇️ Descargar Copia de Seguridad
      </button>
    </div>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
      <h3>📥 Importar Datos</h3>
      <p>Carga un archivo de respaldo '.json' previamente generado.</p>
      <input type="file" id="input-import-db" accept=".json" style="margin-bottom: 10px;"><br>
      <button id="btn-import-db" style="background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer;">
        ⬆️ Restaurar Copia de Seguridad
      </button>
    </div>
  `;

  // Listener Exportar
  document.getElementById('btn-export-db').addEventListener('click', async () => {
    try {
      const jsonStr = await exportDatabase();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leaguehub_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al exportar los datos: ' + err.message);
    }
  });

  // Listener Importar
  document.getElementById('btn-import-db').addEventListener('click', async () => {
    const fileInput = document.getElementById('input-import-db');
    const file = fileInput.files[0];

    if (!file) {
      alert('Por favor selecciona un archivo JSON primero.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await importDatabase(e.target.result);
        alert('¡Datos importados con éxito!');
        location.reload();
      } catch (err) {
        alert('Error al importar el archivo JSON. Verifica el formato.');
      }
    };
    reader.readAsText(file);
  });
}