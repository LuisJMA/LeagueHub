// js/utils/sports-rules.js

export const SPORTS_RULES = {
  FUTBOL: 'futbol',
  BASQUET: 'basquet',
  VOLEY: 'voley'
};

/**
 * Calcula los puntos asignados según el deporte y el marcador
 */
export function calculateMatchPoints(sport, homeScore, awayScore) {
  const hScore = Number(homeScore);
  const aScore = Number(awayScore);

  switch (sport) {
    case SPORTS_RULES.FUTBOL:
      if (hScore > aScore) return { homePoints: 3, awayPoints: 0 };
      if (hScore < aScore) return { homePoints: 0, awayPoints: 3 };
      return { homePoints: 1, awayPoints: 1 }; // Empate

    case SPORTS_RULES.BASQUET:
      if (hScore === aScore) {
        throw new Error('El básquetbol no admite empates.');
      }
      return hScore > aScore 
        ? { homePoints: 2, awayPoints: 1 } 
        : { homePoints: 1, awayPoints: 2 };

    case SPORTS_RULES.VOLEY:
      if (hScore === aScore) {
        throw new Error('El vóleibol no admite empates por sets.');
      }
      if (hScore === 3 && (aScore === 0 || aScore === 1)) return { homePoints: 3, awayPoints: 0 };
      if (hScore === 3 && aScore === 2) return { homePoints: 2, awayPoints: 1 };
      if (aScore === 3 && (hScore === 0 || hScore === 1)) return { homePoints: 0, awayPoints: 3 };
      if (aScore === 3 && hScore === 2) return { homePoints: 1, awayPoints: 2 };
      
      return hScore > aScore 
        ? { homePoints: 2, awayPoints: 1 } 
        : { homePoints: 1, awayPoints: 2 };

    default:
      if (hScore > aScore) return { homePoints: 3, awayPoints: 0 };
      if (hScore < aScore) return { homePoints: 0, awayPoints: 3 };
      return { homePoints: 1, awayPoints: 1 };
  }
}