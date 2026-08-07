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
export async function finishMatchTransaction(matchId, homeScore, awayScore) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['matches', 'teams', 'leagues'], 'readwrite');
    const matchesStore = tx.objectStore('matches');
    const teamsStore = tx.objectStore('teams');
    const leaguesStore = tx.objectStore('leagues');

    tx.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => resolve(true);

    const matchReq = matchesStore.get(matchId);
    matchReq.onsuccess = () => {
      const match = matchReq.result;
      if (!match) return reject('Partido no encontrado');

      const leagueReq = leaguesStore.get(match.leagueId);
      leagueReq.onsuccess = () => {
        const league = leagueReq.result;
        const points = calculateMatchPoints(league.sport, homeScore, awayScore);

        // 1. Actualizar partido
        match.homeScore = Number(homeScore);
        match.awayScore = Number(awayScore);
        match.status = 'completed';
        matchesStore.put(match);

        // 2. Actualizar Equipo Local
        const homeTeamReq = teamsStore.get(match.homeTeamId);
        homeTeamReq.onsuccess = () => {
          const homeTeam = homeTeamReq.result;
          homeTeam.pj = (homeTeam.pj || 0) + 1;
          homeTeam.gf = (homeTeam.gf || 0) + match.homeScore;
          homeTeam.gc = (homeTeam.gc || 0) + match.awayScore;
          homeTeam.points = (homeTeam.points || 0) + points.homePoints;
          if (match.homeScore > match.awayScore) homeTeam.pg = (homeTeam.pg || 0) + 1;
          else if (match.homeScore < match.awayScore) homeTeam.pp = (homeTeam.pp || 0) + 1;
          else homeTeam.pe = (homeTeam.pe || 0) + 1;
          teamsStore.put(homeTeam);
        };

        // 3. Actualizar Equipo Visitante
        const awayTeamReq = teamsStore.get(match.awayTeamId);
        awayTeamReq.onsuccess = () => {
          const awayTeam = awayTeamReq.result;
          awayTeam.pj = (awayTeam.pj || 0) + 1;
          awayTeam.gf = (awayTeam.gf || 0) + match.awayScore;
          awayTeam.gc = (awayTeam.gc || 0) + match.homeScore;
          awayTeam.points = (awayTeam.points || 0) + points.awayPoints;
          if (match.awayScore > match.homeScore) awayTeam.pg = (awayTeam.pg || 0) + 1;
          else if (match.awayScore < match.homeScore) awayTeam.pp = (awayTeam.pp || 0) + 1;
          else awayTeam.pe = (awayTeam.pe || 0) + 1;
          teamsStore.put(awayTeam);
        };
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
    const tx = db.transaction(['matches', 'teams', 'leagues'], 'readwrite');
    const matchesStore = tx.objectStore('matches');
    const teamsStore = tx.objectStore('teams');
    const leaguesStore = tx.objectStore('leagues');

    tx.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => resolve(true);

    const matchReq = matchesStore.get(matchId);
    matchReq.onsuccess = () => {
      const match = matchReq.result;
      if (!match || match.status !== 'completed') return resolve(false);

      const leagueReq = leaguesStore.get(match.leagueId);
      leagueReq.onsuccess = () => {
        const league = leagueReq.result;
        const points = calculateMatchPoints(league.sport, match.homeScore, match.awayScore);

        // Revertir Equipo Local
        const homeTeamReq = teamsStore.get(match.homeTeamId);
        homeTeamReq.onsuccess = () => {
          const homeTeam = homeTeamReq.result;
          homeTeam.pj = Math.max(0, (homeTeam.pj || 0) - 1);
          homeTeam.gf = Math.max(0, (homeTeam.gf || 0) - match.homeScore);
          homeTeam.gc = Math.max(0, (homeTeam.gc || 0) - match.awayScore);
          homeTeam.points = Math.max(0, (homeTeam.points || 0) - points.homePoints);
          if (match.homeScore > match.awayScore) homeTeam.pg = Math.max(0, (homeTeam.pg || 0) - 1);
          else if (match.homeScore < match.awayScore) homeTeam.pp = Math.max(0, (homeTeam.pp || 0) - 1);
          else homeTeam.pe = Math.max(0, (homeTeam.pe || 0) - 1);
          teamsStore.put(homeTeam);
        };

        // Revertir Equipo Visitante
        const awayTeamReq = teamsStore.get(match.awayTeamId);
        awayTeamReq.onsuccess = () => {
          const awayTeam = awayTeamReq.result;
          awayTeam.pj = Math.max(0, (awayTeam.pj || 0) - 1);
          awayTeam.gf = Math.max(0, (awayTeam.gf || 0) - match.awayScore);
          awayTeam.gc = Math.max(0, (awayTeam.gc || 0) - match.homeScore);
          awayTeam.points = Math.max(0, (awayTeam.points || 0) - points.awayPoints);
          if (match.awayScore > match.homeScore) awayTeam.pg = Math.max(0, (awayTeam.pg || 0) - 1);
          else if (match.awayScore < match.homeScore) awayTeam.pp = Math.max(0, (awayTeam.pp || 0) - 1);
          else awayTeam.pe = Math.max(0, (awayTeam.pe || 0) - 1);
          teamsStore.put(awayTeam);
        };

        // Reestablecer partido a pendiente
        match.status = 'scheduled';
        match.homeScore = 0;
        match.awayScore = 0;
        matchesStore.put(match);
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