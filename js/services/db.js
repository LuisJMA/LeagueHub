// js/services/db.js

import { calculateMatchPoints } from '../utils/sports-rules.js';
import { generateRoundRobin, generatePlayoffs } from '../utils/fixture-generator.js';

const DB_NAME = 'leaguehub-db';
const DB_VERSION = 1;

/**
 * Inicializa y abre la conexión con IndexedDB
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event.target.error);
      const statusEl = document.getElementById('db-status');
      if (statusEl) statusEl.textContent = 'Estado DB: Error 🔴';
      reject('Error al abrir la base de datos');
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const statusEl = document.getElementById('db-status');
      if (statusEl) statusEl.textContent = 'Estado DB: Conectado 🟢';
      resolve(db);
    };

    // Creación de la estructura del motor (Se ejecuta solo la primera vez)
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Store: leagues
      if (!db.objectStoreNames.contains('leagues')) {
        const store = db.createObjectStore('leagues', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('isActive', 'isActive', { unique: false });
      }

      // 2. Store: teams
      if (!db.objectStoreNames.contains('teams')) {
        const store = db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
        store.createIndex('leagueId', 'leagueId', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }

      // 3. Store: players
      if (!db.objectStoreNames.contains('players')) {
        const store = db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
        store.createIndex('teamId', 'teamId', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }

      // 4. Store: matches
      if (!db.objectStoreNames.contains('matches')) {
        const store = db.createObjectStore('matches', { keyPath: 'id', autoIncrement: true });
        store.createIndex('leagueId', 'leagueId', { unique: false });
        store.createIndex('homeTeamId', 'homeTeamId', { unique: false });
        store.createIndex('awayTeamId', 'awayTeamId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }

      // 5. Store: events
      if (!db.objectStoreNames.contains('events')) {
        const store = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        store.createIndex('matchId', 'matchId', { unique: false });
        store.createIndex('playerId', 'playerId', { unique: false });
      }
    };
  });
}

/**
 * Operación genérica para guardar o actualizar un registro en un store
 */
export async function dbPut(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve(request.result); // Retorna el ID generado/actualizado
    request.onerror = () => reject(`Error al guardar en ${storeName}`);
  });
}

/**
 * Operación genérica para obtener todos los registros de un store
 */
export async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(`Error al obtener registros de ${storeName}`);
  });
}

/**
 * Obtiene los registros filtrados por un índice (ej. obtener equipos por leagueId)
 */
export async function dbGetByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(`Error al buscar en ${storeName} por ${indexName}`);
  });
}


/**
 * Activa una liga en DB y guarda su ID en localStorage
 */
export async function setActiveLeague(leagueId) {
  const db = await openDB();
  const idNum = Number(leagueId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction('leagues', 'readwrite');
    const store = tx.objectStore('leagues');

    const getAllReq = store.getAll();

    getAllReq.onsuccess = () => {
      const leagues = getAllReq.result;
      leagues.forEach((league) => {
        league.isActive = league.id === idNum;
        store.put(league);
      });
      localStorage.setItem('activeLeagueId', idNum);
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject('Error al cambiar la liga activa');
  });
}

/**
 * Obtiene la liga activa actual
 */
export async function getActiveLeague() {
  const leagues = await dbGetAll('leagues');
  return leagues.find(l => l.isActive) || null;
}

/**
 * Transacción atómica para finalizar un partido y actualizar la tabla de posiciones
 */
export async function finishMatchTransaction(matchId, scoreHome, scoreAway, playerStats = []) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['matches', 'teams', 'players', 'leagues'], 'readwrite');
    
    const matchStore = tx.objectStore('matches');
    const teamStore = tx.objectStore('teams');
    const playerStore = tx.objectStore('players');
    const leagueStore = tx.objectStore('leagues');

    tx.onerror = (e) => reject(e.target.error || 'Error en la transacción');
    tx.oncomplete = () => resolve(true);

    const matchReq = matchStore.get(Number(matchId));
    matchReq.onsuccess = () => {
      const match = matchReq.result;
      if (!match) return reject('Partido no encontrado');
      if (match.status === 'FINISHED' || match.status === 'completed') {
        return reject('El partido ya está finalizado.');
      }

      const leagueReq = leagueStore.get(match.leagueId);
      leagueReq.onsuccess = () => {
        const league = leagueReq.result;

        if (league.format === 'playoffs' && scoreHome === scoreAway) {
          return reject('No se permiten empates en eliminación directa.');
        }

        // 1. Actualizar estado del partido
        match.homeScore = Number(scoreHome);
        match.awayScore = Number(scoreAway);
        match.status = 'completed';
        matchStore.put(match);

        // 2. Actualizar estadísticas de los equipos
        const pts = calculateMatchPoints(league.sport, scoreHome, scoreAway);

        const homeTeamReq = teamStore.get(match.homeTeamId);
        homeTeamReq.onsuccess = () => {
          const homeTeam = homeTeamReq.result;
          if (homeTeam) {
            homeTeam.pj = (homeTeam.pj || 0) + 1;
            homeTeam.gf = (homeTeam.gf || 0) + Number(scoreHome);
            homeTeam.gc = (homeTeam.gc || 0) + Number(scoreAway);
            homeTeam.points = (homeTeam.points || 0) + pts.homePoints;

            if (scoreHome > scoreAway) homeTeam.pg = (homeTeam.pg || 0) + 1;
            else if (scoreHome < scoreAway) homeTeam.pp = (homeTeam.pp || 0) + 1;
            else homeTeam.pe = (homeTeam.pe || 0) + 1;

            teamStore.put(homeTeam);
          }
        };

        const awayTeamReq = teamStore.get(match.awayTeamId);
        awayTeamReq.onsuccess = () => {
          const awayTeam = awayTeamReq.result;
          if (awayTeam) {
            awayTeam.pj = (awayTeam.pj || 0) + 1;
            awayTeam.gf = (awayTeam.gf || 0) + Number(scoreAway);
            awayTeam.gc = (awayTeam.gc || 0) + Number(scoreHome);
            awayTeam.points = (awayTeam.points || 0) + pts.awayPoints;

            if (scoreAway > scoreHome) awayTeam.pg = (awayTeam.pg || 0) + 1;
            else if (scoreAway < scoreHome) awayTeam.pp = (awayTeam.pp || 0) + 1;
            else awayTeam.pe = (awayTeam.pe || 0) + 1;

            teamStore.put(awayTeam);
          }
        };

        // 3. Actualizar estadísticas de jugadores
        for (const stat of playerStats) {
          const pReq = playerStore.get(stat.playerId);
          pReq.onsuccess = () => {
            const player = pReq.result;
            if (player) {
              player.goals = (player.goals || 0) + (stat.goals || 1);
              playerStore.put(player);
            }
          };
        }

        // 4. Avance automático en playoffs
        if (league.format === 'playoffs' && match.nextMatchId) {
          const winnerId = scoreHome > scoreAway ? match.homeTeamId : match.awayTeamId;
          const nextMatchReq = matchStore.get(match.nextMatchId);

          nextMatchReq.onsuccess = () => {
            const nextMatch = nextMatchReq.result;
            if (nextMatch) {
              if (match.slot === 'home') nextMatch.homeTeamId = winnerId;
              else if (match.slot === 'away') nextMatch.awayTeamId = winnerId;
              matchStore.put(nextMatch);
            }
          };
        }
      };
    };
  });
}

/**
 * Transacción atómica para revertir un partido finalizado
 */
export async function undoMatchTransaction(matchId) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['matches', 'teams', 'players', 'leagues'], 'readwrite');
    const matchStore = tx.objectStore('matches');
    const teamStore = tx.objectStore('teams');
    const leagueStore = tx.objectStore('leagues');

    tx.onerror = (e) => reject(e.target.error || 'Error al revertir partido');
    tx.oncomplete = () => resolve(true);

    const matchReq = matchStore.get(Number(matchId));
    matchReq.onsuccess = () => {
      const match = matchReq.result;
      if (!match || (match.status !== 'FINISHED' && match.status !== 'completed')) {
        return reject('El partido no está finalizado.');
      }

      const leagueReq = leagueStore.get(match.leagueId);
      leagueReq.onsuccess = () => {
        const league = leagueReq.result;

        // Validar que la siguiente ronda no se haya jugado
        if (match.nextMatchId) {
          const nextMatchReq = matchStore.get(match.nextMatchId);
          nextMatchReq.onsuccess = () => {
            const nextMatch = nextMatchReq.result;
            if (nextMatch && (nextMatch.status === 'FINISHED' || nextMatch.status === 'completed')) {
              return reject('No puedes deshacer este partido porque la siguiente ronda ya fue jugada.');
            }
            if (nextMatch) {
              if (match.slot === 'home') nextMatch.homeTeamId = null;
              if (match.slot === 'away') nextMatch.awayTeamId = null;
              matchStore.put(nextMatch);
            }
          };
        }

        // Restar puntos y estadísticas a los equipos
        const pts = calculateMatchPoints(league.sport, match.homeScore, match.awayScore);

        const homeTeamReq = teamStore.get(match.homeTeamId);
        homeTeamReq.onsuccess = () => {
          const homeTeam = homeTeamReq.result;
          if (homeTeam) {
            homeTeam.pj = Math.max(0, (homeTeam.pj || 0) - 1);
            homeTeam.gf = Math.max(0, (homeTeam.gf || 0) - match.homeScore);
            homeTeam.gc = Math.max(0, (homeTeam.gc || 0) - match.awayScore);
            homeTeam.points = Math.max(0, (homeTeam.points || 0) - pts.homePoints);

            if (match.homeScore > match.awayScore) homeTeam.pg = Math.max(0, (homeTeam.pg || 0) - 1);
            else if (match.homeScore < match.awayScore) homeTeam.pp = Math.max(0, (homeTeam.pp || 0) - 1);
            else homeTeam.pe = Math.max(0, (homeTeam.pe || 0) - 1);

            teamStore.put(homeTeam);
          }
        };

        const awayTeamReq = teamStore.get(match.awayTeamId);
        awayTeamReq.onsuccess = () => {
          const awayTeam = awayTeamReq.result;
          if (awayTeam) {
            awayTeam.pj = Math.max(0, (awayTeam.pj || 0) - 1);
            awayTeam.gf = Math.max(0, (awayTeam.gf || 0) - match.awayScore);
            awayTeam.gc = Math.max(0, (awayTeam.gc || 0) - match.homeScore);
            awayTeam.points = Math.max(0, (awayTeam.points || 0) - pts.awayPoints);

            if (match.awayScore > match.homeScore) awayTeam.pg = Math.max(0, (awayTeam.pg || 0) - 1);
            else if (match.awayScore < match.homeScore) awayTeam.pp = Math.max(0, (awayTeam.pp || 0) - 1);
            else awayTeam.pe = Math.max(0, (awayTeam.pe || 0) - 1);

            teamStore.put(awayTeam);
          }
        };

        // Reestablecer partido a pendiente
        match.status = 'scheduled';
        match.homeScore = 0;
        match.awayScore = 0;
        matchStore.put(match);
      };
    };
  });
}

export async function generateLeagueFixtureTransaction(leagueId) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['teams', 'matches', 'leagues'], 'readwrite');
    const teamsStore = tx.objectStore('teams');
    const matchesStore = tx.objectStore('matches');
    const leaguesStore = tx.objectStore('leagues');

    tx.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => resolve(true);

    const leagueReq = leaguesStore.get(leagueId);
    leagueReq.onsuccess = () => {
      const league = leagueReq.result;
      if (!league) return reject('Liga no encontrada');

      const teamsReq = teamsStore.index('leagueId').getAll(leagueId);
      teamsReq.onsuccess = () => {
        const teams = teamsReq.result;
        if (teams.length < 2) return reject('Se necesitan al menos 2 equipos para generar el fixture');

        const fixture = league.format === 'playoffs'
          ? generatePlayoffs(teams)
          : generateRoundRobin(teams);

        fixture.forEach(m => {
          matchesStore.put({
            leagueId: league.id,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            homeScore: 0,
            awayScore: 0,
            status: 'scheduled',
            round: m.round
          });
        });
      };
    };
  });
}

/**
 * Operación genérica para eliminar un registro por su ID en un store
 */
export async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(Number(id));

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(`Error al eliminar registro ${id} de ${storeName}`);
  });
}

/**
 * Exporta toda la base de datos IndexedDB a un objeto JSON
 */
export async function exportDatabase() {
  const stores = ['leagues', 'teams', 'players', 'matches', 'events'];
  const backupData = {};

  for (const store of stores) {
    backupData[store] = await dbGetAll(store);
  }

  return JSON.stringify(backupData, null, 2);
}

/**
 * Importa un objeto JSON y sobrescribe/agrega datos en IndexedDB
 */
export async function importDatabase(jsonData) {
  const data = JSON.parse(jsonData);
  const db = await openDB();

  for (const storeName of Object.keys(data)) {
    if (Array.isArray(data[storeName])) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      for (const item of data[storeName]) {
        store.put(item);
      }
    }
  }
}


/**
 * Transacción Atómica: Elimina una liga y todos sus registros asociados (cascada)
 */
export async function deleteLeagueCascade(leagueId) {
  const db = await openDB();
  const idNum = Number(leagueId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['leagues', 'teams', 'players', 'matches', 'events'], 'readwrite');

    tx.onerror = (e) => reject(e.target.error || 'Error al eliminar la liga en cascada');
    tx.oncomplete = () => resolve(true);

    const leagueStore = tx.objectStore('leagues');
    const teamStore = tx.objectStore('teams');
    const playerStore = tx.objectStore('players');
    const matchStore = tx.objectStore('matches');
    const eventStore = tx.objectStore('events');

    // 1. Eliminar la liga
    leagueStore.delete(idNum);

    // 2. Obtener y eliminar equipos, jugadores asociados
    const teamIndex = teamStore.index('leagueId');
    const teamReq = teamIndex.getAll(idNum);

    teamReq.onsuccess = () => {
      const teams = teamReq.result;
      teams.forEach((team) => {
        // Eliminar jugadores del equipo
        const playerIndex = playerStore.index('teamId');
        const playerReq = playerIndex.getAll(team.id);
        playerReq.onsuccess = () => {
          playerReq.result.forEach((p) => playerStore.delete(p.id));
        };
        teamStore.delete(team.id);
      });
    };

    // 3. Obtener y eliminar partidos y sus eventos
    const matchIndex = matchStore.index('leagueId');
    const matchReq = matchIndex.getAll(idNum);

    matchReq.onsuccess = () => {
      const matches = matchReq.result;
      matches.forEach((m) => {
        const eventIndex = eventStore.index('matchId');
        const eventReq = eventIndex.getAll(m.id);
        eventReq.onsuccess = () => {
          eventReq.result.forEach((ev) => eventStore.delete(ev.id));
        };
        matchStore.delete(m.id);
      });
    };
  });
}