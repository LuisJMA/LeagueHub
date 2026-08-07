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
 * Transacción Atómica: Activa una liga y desactiva todas las demás
 */
export async function setActiveLeague(leagueId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('leagues', 'readwrite');
    const store = tx.objectStore('leagues');

    const getAllReq = store.getAll();

    getAllReq.onsuccess = () => {
      const leagues = getAllReq.result;
      leagues.forEach(league => {
        league.isActive = (league.id === leagueId);
        store.put(league);
      });
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
  const db = await getDB();
  const tx = db.transaction(['matches', 'teams', 'players', 'leagues'], 'readwrite');
  
  const matchStore = tx.objectStore('matches');
  const teamStore = tx.objectStore('teams');
  const playerStore = tx.objectStore('players');
  const leagueStore = tx.objectStore('leagues');

  const match = await matchStore.get(matchId);
  const league = await leagueStore.get(match.leagueId);

  // Validaciones
  if (match.status === 'FINISHED') throw new Error('El partido ya está finalizado.');
  if (league.format === 'SINGLE_ELIMINATION' && scoreHome === scoreAway) {
    throw new Error('No se permiten empates en eliminación directa.');
  }

  // 1. Marcar como finalizado
  match.scoreHome = scoreHome;
  match.scoreAway = scoreAway;
  match.status = 'FINISHED';
  await matchStore.put(match);

  // 2. Sumar puntos/goles a los equipos
  // ... (actualización de PG, PE, PP, GF, GC, PTS según corresponda)

  // 3. Sumar estadísticas individuales a cada jugador
  for (const stat of playerStats) {
    const player = await playerStore.get(stat.playerId);
    if (player) {
      player.stats.goals = (player.stats.goals || 0) + stat.goals;
      player.stats.assists = (player.stats.assists || 0) + stat.assists;
      await playerStore.put(player);
    }
  }

  // 4. Avance automático en el Bracket (Eliminación Directa)
  if (league.format === 'SINGLE_ELIMINATION' && match.nextMatchId) {
    const winnerId = scoreHome > scoreAway ? match.homeTeamId : match.awayTeamId;
    const nextMatch = await matchStore.get(match.nextMatchId);

    if (nextMatch) {
      if (match.slot === 'home') {
        nextMatch.homeTeamId = winnerId;
      } else if (match.slot === 'away') {
        nextMatch.awayTeamId = winnerId;
      }
      await matchStore.put(nextMatch);
    }
  }

  await tx.done;
}

/**
 * Transacción atómica para revertir un partido finalizado
 */
export async function undoMatchTransaction(matchId, playerStatsToRollback = []) {
  const db = await getDB();
  const tx = db.transaction(['matches', 'teams', 'players', 'leagues'], 'readwrite');
  
  const matchStore = tx.objectStore('matches');
  const teamStore = tx.objectStore('teams');
  const playerStore = tx.objectStore('players');

  const match = await matchStore.get(matchId);
  if (match.status !== 'FINISHED') throw new Error('El partido no está finalizado.');

  // Bloqueo de Rollback en Eliminación Directa
  if (match.nextMatchId) {
    const nextMatch = await matchStore.get(match.nextMatchId);
    if (nextMatch && nextMatch.status === 'FINISHED') {
      throw new Error('No puedes deshacer este partido porque el partido de la siguiente ronda ya se jugó.');
    }
    
    // Limpiar el slot asignado en el siguiente partido si aún no se juega
    if (nextMatch) {
      if (match.slot === 'home') nextMatch.homeTeamId = null;
      if (match.slot === 'away') nextMatch.awayTeamId = null;
      await matchStore.put(nextMatch);
    }
  }

  // 1. Restar estadísticas individuales a los jugadores
  for (const stat of playerStatsToRollback) {
    const player = await playerStore.get(stat.playerId);
    if (player) {
      player.stats.goals = Math.max(0, (player.stats.goals || 0) - stat.goals);
      player.stats.assists = Math.max(0, (player.stats.assists || 0) - stat.assists);
      await playerStore.put(player);
    }
  }

  // 2. Restar estadísticas a los equipos
  // ... (revertir PG, PE, PP, GF, GC, PTS)

  // 3. Restaurar estado del partido
  match.status = 'PENDING';
  match.scoreHome = null;
  match.scoreAway = null;
  await matchStore.put(match);

  await tx.done;
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