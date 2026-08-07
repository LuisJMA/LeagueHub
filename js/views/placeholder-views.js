// js/views/placeholder-views.js
import { dbGetAll, dbPut, dbDelete, setActiveLeague, getActiveLeague, dbGetByIndex, finishMatchTransaction, undoMatchTransaction, generateLeagueFixtureTransaction, exportDatabase, importDatabase, deleteLeagueCascade, exportLeagueData, importLeagueData } from '../services/db.js';
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
          <button data-id="${l.id}" class="btn-export-league" style="background: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;">📥 Exportar</button>
          <button data-id="${l.id}" class="btn-edit-league" style="background: #ffc107; color: black; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;">✏️ Editar</button>
          <button data-id="${l.id}" class="btn-delete-league" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;">🗑️ Eliminar</button>
        </div>
      </div>
    `).join('');
  }

  app.innerHTML = `
    <h2>Gestión de Ligas</h2>

    <!-- Sección de Importar Liga individual -->
    <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
      <h3>📥 Importar Liga Individual (JSON)</h3>
      <input type="file" id="import-league-file" accept=".json" style="margin-top: 5px;">
    </div>

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

  // Listener para exportar liga individual
  app.querySelectorAll('.btn-export-league').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const leagueId = e.target.dataset.id;
      try {
        const exportData = await exportLeagueData(leagueId);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `liga_${exportData.league.name.toLowerCase().replace(/\s+/g, '_')}_backup.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      } catch (error) {
        alert('⚠️ Error al exportar la liga: ' + error.message);
      }
    });
  });

  // Listener para importar liga individual
  const fileInput = document.getElementById('import-league-file');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          await importLeagueData(jsonData);
          alert('✅ ¡Liga importada exitosamente!');
          renderLeagues();
        } catch (error) {
          alert('⚠️ El archivo no es válido o está corrupto: ' + error.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // Listener para editar liga
  app.querySelectorAll('.btn-edit-league').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number(e.target.dataset.id);
      const allLeagues = await dbGetAll('leagues');
      const league = allLeagues.find(l => l.id === id);
      if (!league) return;

      const newName = prompt('Nuevo nombre de la liga:', league.name);
      if (newName !== null && newName.trim() !== '') {
        league.name = newName.trim();
        await dbPut('leagues', league);
        renderLeagues();
      }
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
  const defaultLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'%3E%3C/path%3E%3C/svg%3E";

  let teamsListHTML = '';
  if (teams.length === 0) {
    teamsListHTML = '<p>No hay equipos registrados en esta liga aún.</p>';
  } else {
    teamsListHTML = teams.map(t => {
      const primaryColor = t.primaryColor || '#007bff';
      const secondaryColor = t.secondaryColor || '#6c757d';
      const logoUrl = t.logoUrl && t.logoUrl.trim() !== '' ? t.logoUrl : defaultLogo;

      return `
        <div style="border: 1px solid #ccc; border-left: 6px solid ${primaryColor}; padding: 12px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${logoUrl}" alt="Escudo de ${t.name}" style="width: 45px; height: 45px; object-fit: contain; border-radius: 50%; background: #f8f9fa; border: 1px solid #ddd;" onerror="this.onerror=null; this.src='${defaultLogo}';">
            <div>
              <h3 style="margin: 0 0 5px 0; color: ${primaryColor};">${t.name}</h3>
              <p style="margin: 0; font-size: 0.9em;"><strong>PJ:</strong> ${t.pj || 0} | <strong>PG:</strong> ${t.pg || 0} | <strong>PP:</strong> ${t.pp || 0} | <strong>Puntos:</strong> ${t.points || 0}</p>
              <div style="display: flex; gap: 6px; margin-top: 5px;">
                <span style="display: inline-block; width: 12px; height: 12px; background: ${primaryColor}; border-radius: 50%;" title="Color Principal"></span>
                <span style="display: inline-block; width: 12px; height: 12px; background: ${secondaryColor}; border-radius: 50%;" title="Color Secundario"></span>
              </div>
              <a href="#team/${t.id}" style="display: inline-block; margin-top: 5px;">Ver Detalle del Equipo</a>
            </div>
          </div>
          <div>
            <button class="btn-edit-team" data-id="${t.id}" style="background: #ffc107; color: black; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;">✏️ Editar</button>
            <button class="btn-delete-team" data-id="${t.id}" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;">
              🗑️ Eliminar
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  const isPlayoffs = activeLeague.format === 'playoffs';
  const maxAllowed = activeLeague.maxTeams || 16;
  const isLimitReached = isPlayoffs && teams.length >= maxAllowed;

  app.innerHTML = `
    <h2>Gestión de Equipos (${activeLeague.name})</h2>
    ${isPlayoffs ? `<p><strong>Límite de formato Playoffs:</strong> ${teams.length} / ${maxAllowed} equipos registrados.</p>` : ''}

    ${isLimitReached ? `
      <div style="background: #fff3cd; color: #856404; padding: 12px; border-radius: 5px; margin-bottom: 20px;">
        ⚠️ Se ha alcanzado el límite máximo de ${maxAllowed} equipos configurado para esta liga de eliminación directa.
      </div>
    ` : `
      <form id="form-create-team" style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3>Registrar Nuevo Equipo</h3>
        <div>
          <label>Nombre del Equipo:</label><br>
          <input type="text" id="team-name" required placeholder="Ej: Los Rayos FC" style="width: 100%; padding: 7px; margin-top: 4px;">
        </div>
        <div style="display: flex; gap: 15px; margin-top: 10px;">
          <div style="flex: 1;">
            <label>Color Principal:</label><br>
            <input type="color" id="team-primary-color" value="#007bff" style="width: 100%; height: 35px; border: 1px solid #ccc; padding: 2px; cursor: pointer; margin-top: 4px;">
          </div>
          <div style="flex: 1;">
            <label>Color Secundario:</label><br>
            <input type="color" id="team-secondary-color" value="#6c757d" style="width: 100%; height: 35px; border: 1px solid #ccc; padding: 2px; cursor: pointer; margin-top: 4px;">
          </div>
        </div>
        <div style="margin-top: 10px;">
          <label>URL del Escudo / Logo:</label><br>
          <input type="url" id="team-logo" placeholder="https://ejemplo.com/escudo.png" style="width: 100%; padding: 7px; margin-top: 4px;">
        </div>
        <button type="submit" style="margin-top: 15px;">Guardar Equipo</button>
      </form>
    `}

    <hr>
    <h3>Equipos de la Liga</h3>
    <div id="teams-container">${teamsListHTML}</div>
  `;

  const createForm = document.getElementById('form-create-team');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('team-name').value.trim();
      const primaryColor = document.getElementById('team-primary-color').value;
      const secondaryColor = document.getElementById('team-secondary-color').value;
      const logoUrl = document.getElementById('team-logo').value.trim();

      if (!nameInput) {
        alert('⚠️ El nombre del equipo no puede estar vacío.');
        return;
      }

      const existingTeams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);

      if (isPlayoffs && existingTeams.length >= maxAllowed) {
        alert(`⚠️ No puedes agregar más de ${maxAllowed} equipos en esta liga de Playoffs.`);
        return;
      }

      const isDuplicate = existingTeams.some(t => t.name.toLowerCase() === nameInput.toLowerCase());
      if (isDuplicate) {
        alert(`⚠️ Ya existe un equipo llamado "${nameInput}" en esta liga.`);
        return;
      }

      const newTeam = {
        leagueId: activeLeague.id,
        name: nameInput,
        primaryColor,
        secondaryColor,
        logoUrl,
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
  }

  app.querySelectorAll('.btn-edit-team').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const teamId = Number(e.target.dataset.id);
      const leagueTeams = await dbGetByIndex('teams', 'leagueId', activeLeague.id);
      const team = leagueTeams.find(t => t.id === teamId);
      if (!team) return;

      const newName = prompt('Nuevo nombre del equipo:', team.name);
      if (newName === null) return;

      const newLogo = prompt('Nueva URL del Escudo/Logo:', team.logoUrl || '');
      if (newLogo === null) return;

      if (newName.trim() !== '') {
        const isDuplicate = leagueTeams.some(t => t.id !== teamId && t.name.toLowerCase() === newName.trim().toLowerCase());
        if (isDuplicate) {
          alert(`⚠️ Ya existe un equipo llamado "${newName.trim()}" en esta liga.`);
          return;
        }
        team.name = newName.trim();
      }
      team.logoUrl = newLogo.trim();

      await dbPut('teams', team);
      renderTeams();
    });
  });

  app.querySelectorAll('.btn-delete-team').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const teamId = Number(e.target.dataset.id);
      const matches = await dbGetByIndex('matches', 'leagueId', activeLeague.id);
      const hasMatches = matches.some(m => Number(m.homeTeamId) === teamId || Number(m.awayTeamId) === teamId);

      if (hasMatches) {
        alert('⚠️ No se puede eliminar este equipo porque ya tiene partidos asignados en el calendario.');
        return;
      }

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
  const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";

  const teamIds = teams.map(t => t.id);
  const leaguePlayers = allPlayers.filter(p => teamIds.includes(Number(p.teamId)));

  let teamsOptionsHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  
  const renderPlayersList = (playersToRender) => {
    if (playersToRender.length === 0) {
      return '<p>No se encontraron jugadores con los filtros seleccionados.</p>';
    }
    return playersToRender.map(p => {
      const playerTeam = teams.find(t => t.id === Number(p.teamId));
      const avatarUrl = p.avatarUrl && p.avatarUrl.trim() !== '' ? p.avatarUrl : defaultAvatar;

      return `
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${avatarUrl}" alt="Avatar de ${p.name}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 50%; background: #f8f9fa; border: 1px solid #ddd;" onerror="this.onerror=null; this.src='${defaultAvatar}';">
            <div>
              <h3 style="margin: 0 0 3px 0;">${p.name} (#${p.dorsal})</h3>
              <p style="margin: 0; font-size: 0.9em;"><strong>Equipo:</strong> ${playerTeam ? playerTeam.name : 'Sin equipo'} | <strong>Posición:</strong> ${p.position}</p>
              <p style="margin: 0; font-size: 0.9em;"><strong>Anotaciones/Goles:</strong> ${p.goals || 0}</p>
              <a href="#player/${p.id}" style="display: inline-block; margin-top: 3px;">Ver Perfil del Jugador</a>
            </div>
          </div>
          <div>
            <button class="btn-edit-player" data-id="${p.id}" style="background: #ffc107; color: black; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;">✏️ Editar</button>
            <button class="btn-delete-player" data-id="${p.id}" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;">
              🗑️ Eliminar
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  app.innerHTML = `
    <h2>Gestión de Jugadores (${activeLeague.name})</h2>

    ${teams.length === 0 ? '<p style="color: orange;">⚠️ Debes crear al menos un equipo antes de registrar jugadores.</p>' : `
      <form id="form-create-player" style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3>Registrar Nuevo Jugador</h3>
        <div>
          <label>Nombre Completo:</label><br>
          <input type="text" id="player-name" required placeholder="Ej: Lionel Messi" style="width: 100%; padding: 7px; margin-top: 4px;">
        </div>
        <div style="margin-top: 10px;">
          <label>Dorsal / Número:</label><br>
          <input type="number" id="player-dorsal" required placeholder="10" min="0" max="99" style="width: 100%; padding: 7px; margin-top: 4px;">
        </div>
        <div style="margin-top: 10px;">
          <label>Posición:</label><br>
          <input type="text" id="player-position" placeholder="Ej: Delantero / Base / Rematador" style="width: 100%; padding: 7px; margin-top: 4px;">
        </div>
        <div style="margin-top: 10px;">
          <label>Equipo:</label><br>
          <select id="player-team" required style="width: 100%; padding: 7px; margin-top: 4px;">
            ${teamsOptionsHTML}
          </select>
        </div>
        <div style="margin-top: 10px;">
          <label>URL de Avatar / Foto:</label><br>
          <input type="url" id="player-avatar" placeholder="https://ejemplo.com/foto.png" style="width: 100%; padding: 7px; margin-top: 4px;">
        </div>
        <button type="submit" style="margin-top: 15px;">Guardar Jugador</button>
      </form>
    `}

    <hr>
    <h3>Filtros y Búsqueda</h3>
    <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
      <input type="text" id="search-player-input" placeholder="Buscar por nombre..." style="flex: 1; min-width: 200px; padding: 8px;">
      <select id="filter-team-select" style="padding: 8px;">
        <option value="">Todos los equipos</option>
        ${teamsOptionsHTML}
      </select>
    </div>

    <h3>Jugadores Registrados</h3>
    <div id="players-container">${renderPlayersList(leaguePlayers)}</div>
  `;

  const searchInput = document.getElementById('search-player-input');
  const filterTeamSelect = document.getElementById('filter-team-select');
  const container = document.getElementById('players-container');

  let debounceTimer;

  const applyFilters = () => {
    const query = searchInput.value.toLowerCase().trim();
    const selectedTeamId = filterTeamSelect.value;

    const filtered = leaguePlayers.filter(p => {
      const matchesName = p.name.toLowerCase().includes(query);
      const matchesTeam = selectedTeamId === '' || Number(p.teamId) === Number(selectedTeamId);
      return matchesName && matchesTeam;
    });

    container.innerHTML = renderPlayersList(filtered);
    attachPlayerEvents();
  };

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyFilters();
      }, 300);
    });
  }

  if (filterTeamSelect) {
    filterTeamSelect.addEventListener('change', applyFilters);
  }

  function attachPlayerEvents() {
    const form = document.getElementById('form-create-player');
    if (form && !form.dataset.listenerAttached) {
      form.dataset.listenerAttached = 'true';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('player-name').value.trim();
        const dorsal = Number(document.getElementById('player-dorsal').value);
        const position = document.getElementById('player-position').value.trim();
        const teamId = Number(document.getElementById('player-team').value);
        const avatarUrl = document.getElementById('player-avatar').value.trim();

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
          avatarUrl,
          goals: 0
        };

        await dbPut('players', newPlayer);
        renderPlayers();
      });
    }

    app.querySelectorAll('.btn-edit-player').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const playerId = Number(e.target.dataset.id);
        const freshPlayers = await dbGetAll('players');
        const player = freshPlayers.find(p => Number(p.id) === playerId);
        if (!player) return;

        const newName = prompt('Nuevo nombre del jugador:', player.name);
        if (newName === null) return;

        const newAvatar = prompt('Nueva URL de Avatar/Foto:', player.avatarUrl || '');
        if (newAvatar === null) return;

        if (newName.trim() !== '') player.name = newName.trim();
        player.avatarUrl = newAvatar.trim();

        await dbPut('players', player);
        renderPlayers();
      });
    });

    app.querySelectorAll('.btn-delete-player').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const playerId = Number(e.target.dataset.id);
        if (confirm('¿Seguro que deseas eliminar este jugador?')) {
          await dbDelete('players', playerId);
          renderPlayers();
        }
      });
    });
  }

  attachPlayerEvents();
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

  // Obtener jornadas o rondas únicas disponibles para el selector de jornada
  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  let roundsOptionsHTML = rounds.map(r => `<option value="${r}">Jornada / Fecha ${r}</option>`).join('');

  // Función auxiliar para renderizar la lista de partidos filtrados
  const renderMatchesList = (matchesToRender) => {
    if (matchesToRender.length === 0) {
      return '<p>No se encontraron partidos con los filtros seleccionados.</p>';
    }
    return matchesToRender.map(m => {
      const homeTeam = teams.find(t => t.id === Number(m.homeTeamId));
      const awayTeam = teams.find(t => t.id === Number(m.awayTeamId));
      const isFinished = m.status === 'finished';

      return `
        <div style="border: 1px solid #ccc; padding: 12px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="margin: 0 0 5px 0; font-size: 0.9em; color: #666;">
              <strong>Jornada:</strong> ${m.round} | <strong>Fecha:</strong> ${m.date || 'Sin definir'} | 
              <span style="color: ${isFinished ? 'green' : 'orange'}; font-weight: bold;">
                ${isFinished ? '🟢 Finalizado' : '⏳ Programado'}
              </span>
            </p>
            <h3 style="margin: 0;">
              ${homeTeam ? homeTeam.name : 'Desconocido'} 
              <span style="background: #eee; padding: 2px 8px; border-radius: 4px;">
                ${isFinished ? `${m.homeGoals} - ${m.awayGoals}` : 'vs'}
              </span> 
              ${awayTeam ? awayTeam.name : 'Desconocido'}
            </h3>
          </div>
          <div>
            <a href="#match/${m.id}" style="background: #007bff; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; display: inline-block;">
              ${isFinished ? 'Ver Detalles' : 'Gestionar / Jugar'}
            </a>
          </div>
        </div>
      `;
    }).join('');
  };

  app.innerHTML = `
    <h2>Gestión de Partidos (${activeLeague.name})</h2>

    ${matches.length === 0 ? `
      <div style="background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3 style="margin-top: 0; color: #856404;">⚠️ Calendario no generado</h3>
        <p style="margin-bottom: 10px; color: #856404;">Aún no hay partidos registrados para esta liga. Haz clic para crear el fixture automáticamente:</p>
        <button id="btn-generate-fixture" style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">
          ⚡ Generar Calendario de Partidos
        </button>
      </div>
    ` : ''}

    <!-- Controles de Filtros Avanzados -->
    <div style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
      <h3 style="margin-top: 0;">Filtros Avanzados</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
        
        <!-- Filtro por Jornada -->
        <div>
          <label>Jornada / Ronda:</label><br>
          <select id="filter-round" style="width: 100%; padding: 8px;">
            <option value="">Todas las jornadas</option>
            ${roundsOptionsHTML}
          </select>
        </div>

        <!-- Selector por Estado -->
        <div>
          <label>Estado:</label><br>
          <select id="filter-status" style="width: 100%; padding: 8px;">
            <option value="">Todos</option>
            <option value="scheduled">Programados</option>
            <option value="finished">Finalizados</option>
          </select>
        </div>

        <!-- Selector por Equipo -->
        <div>
          <label>Equipo:</label><br>
          <select id="filter-team" style="width: 100%; padding: 8px;">
            <option value="">Todos los equipos</option>
            ${teamsOptionsHTML}
          </select>
        </div>

        <!-- Inputs de Fecha -->
        <div>
          <label>Fecha Inicio:</label><br>
          <input type="date" id="filter-date-start" style="width: 100%; padding: 7px;">
        </div>
        <div>
          <label>Fecha Fin:</label><br>
          <input type="date" id="filter-date-end" style="width: 100%; padding: 7px;">
        </div>

      </div>
      <button id="btn-reset-filters" style="margin-top: 10px; background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Limpiar Filtros</button>
    </div>

    <h3>Calendario de Partidos</h3>
    <div id="matches-container">${renderMatchesList(matches)}</div>
  `;

  // Listener para el botón de generar fixture (si no hay partidos)
  const btnGenerateFixture = document.getElementById('btn-generate-fixture');
  if (btnGenerateFixture) {
    btnGenerateFixture.addEventListener('click', async () => {
      try {
        btnGenerateFixture.disabled = true;
        btnGenerateFixture.textContent = 'Generando...';
        
        await generateLeagueFixtureTransaction(activeLeague.id);
        
        alert('¡Calendario generado exitosamente!');
        renderMatches(); // Recarga la vista para mostrar los partidos recién creados
      } catch (err) {
        console.error(err);
        alert('Error al generar el fixture: ' + (err.message || err));
        btnGenerateFixture.disabled = false;
        btnGenerateFixture.textContent = '⚡ Generar Calendario de Partidos';
      }
    });
  }

  // Referencias a los elementos de control
  const selectRound = document.getElementById('filter-round');
  const selectStatus = document.getElementById('filter-status');
  const selectTeam = document.getElementById('filter-team');
  const inputDateStart = document.getElementById('filter-date-start');
  const inputDateEnd = document.getElementById('filter-date-end');
  const btnReset = document.getElementById('btn-reset-filters');
  const container = document.getElementById('matches-container');

  // Lógica de Filtrado Combinado en Cadena
  const applyFilters = () => {
    const roundVal = selectRound.value;
    const statusVal = selectStatus.value;
    const teamVal = selectTeam.value;
    const dateStartVal = inputDateStart.value;
    const dateEndVal = inputDateEnd.value;

    const filtered = matches.filter(m => {
      // 1. Filtro por Jornada
      const matchesRound = roundVal === '' || String(m.round) === String(roundVal);

      // 2. Filtro por Estado
      const matchesStatus = statusVal === '' || m.status === statusVal;

      // 3. Filtro por Equipo (local o visitante)
      const matchesTeam = teamVal === '' || 
        Number(m.homeTeamId) === Number(teamVal) || 
        Number(m.awayTeamId) === Number(teamVal);

      // 4. Filtro por Rango de Fechas
      let matchesDate = true;
      if (m.date) {
        if (dateStartVal && m.date < dateStartVal) matchesDate = false;
        if (dateEndVal && m.date > dateEndVal) matchesDate = false;
      } else if (dateStartVal || dateEndVal) {
        // Si el partido no tiene fecha asignada pero se busca por fecha, se excluye
        matchesDate = false;
      }

      return matchesRound && matchesStatus && matchesTeam && matchesDate;
    });

    container.innerHTML = renderMatchesList(filtered);
  };

  // Escuchar eventos de cambio en todos los filtros
  if (selectRound) selectRound.addEventListener('change', applyFilters);
  if (selectStatus) selectStatus.addEventListener('change', applyFilters);
  if (selectTeam) selectTeam.addEventListener('change', applyFilters);
  if (inputDateStart) inputDateStart.addEventListener('input', applyFilters);
  if (inputDateEnd) inputDateEnd.addEventListener('input', applyFilters);

  // Botón para restablecer filtros
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      selectRound.value = '';
      selectStatus.value = '';
      selectTeam.value = '';
      inputDateStart.value = '';
      inputDateEnd.value = '';
      container.innerHTML = renderMatchesList(matches);
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

  const isPlayoffs = activeLeague.format === 'playoffs';

  // Si es Playoffs, renderizar cuadro de llaves
  if (isPlayoffs) {
    app.innerHTML = `
      <h2>Cuadro de Playoffs (${activeLeague.name})</h2>
      ${matches.length === 0 ? '<p>No se ha generado el fixture de eliminatoria aún.</p>' : ''}
      <div style="display: flex; gap: 20px; overflow-x: auto; padding: 10px 0;">
        ${[1, 2, 3].map(round => {
          const roundMatches = matches.filter(m => m.round === round);
          if (roundMatches.length === 0) return '';
          const roundName = round === 1 ? 'Cuartos / Octavos' : round === 2 ? 'Semifinales' : 'Final';
          return `
            <div style="min-width: 220px; background: #f8f9fa; padding: 10px; border-radius: 5px;">
              <h4>${roundName}</h4>
              ${roundMatches.map(m => {
                const home = teams.find(t => t.id === Number(m.homeTeamId));
                const away = teams.find(t => t.id === Number(m.awayTeamId));
                return `
                  <div style="background: white; border: 1px solid #ddd; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                    <div style="font-weight: ${m.winnerId === m.homeTeamId ? 'bold' : 'normal'}">
                      ${home ? home.name : 'Por definir'} (${m.homeScore ?? 0})
                    </div>
                    <div style="font-weight: ${m.winnerId === m.awayTeamId ? 'bold' : 'normal'}">
                      ${away ? away.name : 'Por definir'} (${m.awayScore ?? 0})
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }).join('')}
      </div>
    `;
    return;
  }

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
    <h2>Configuración y Copia de Seguridad</h2>
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