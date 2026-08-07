// js/services/db.js

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