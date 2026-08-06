// js/services/sports-terms.js

export const SPORTS_TERMS = {
  futbol: {
    name: 'Fútbol',
    event: 'Gol',
    events: 'Goles',
    ranking: 'Goleadores',
    gf: 'GF', // Goles a Favor
    gc: 'GC', // Goles en Contra
    icon: '⚽'
  },
  basquet: {
    name: 'Básquetbol',
    event: 'Canasta',
    events: 'Canastas',
    ranking: 'Encestadores',
    gf: 'PF', // Puntos a Favor
    gc: 'PC', // Puntos en Contra
    icon: '🏀'
  },
  voley: {
    name: 'Vóleibol',
    event: 'Punto',
    events: 'Puntos',
    ranking: 'Anotadores',
    gf: 'PF', // Puntos a Favor
    gc: 'PC', // Puntos en Contra
    icon: '🏐'
  }
};

/**
 * Helper para obtener los términos del deporte activo
 * @param {string} sportKey - 'futbol', 'basquet' o 'voley'
 */
export function getSportTerms(sportKey) {
  return SPORTS_TERMS[sportKey] || SPORTS_TERMS.futbol;
}