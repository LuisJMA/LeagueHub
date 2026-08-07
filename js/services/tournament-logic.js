// js/services/tournament-logic.js

export function generateBracketMatches(leagueId, teamIds) {
  const matches = [];
  const numTeams = teamIds.length;
  
  if (![4, 8, 16].includes(numTeams)) {
    throw new Error('La modalidad de Eliminación Directa requiere 4, 8 o 16 equipos.');
  }

  let matchCounter = 1;
  const numRounds = Math.log2(numTeams);

  // Estructura auxiliar para guardar los partidos por ronda
  const rounds = [];

  // Crear casillas de partidos por cada ronda (de la primera a la final)
  for (let r = 1; r <= numRounds; r++) {
    const matchesInRound = numTeams / Math.pow(2, r);
    const currentRoundMatches = [];

    for (let m = 0; m < matchesInRound; m++) {
      const match = {
        id: Date.now() + matchCounter++,
        leagueId: Number(leagueId),
        roundName: r === numRounds ? 'Final' : r === numRounds - 1 ? 'Semifinal' : `Ronda ${r}`,
        roundIndex: r,
        homeTeamId: null,
        awayTeamId: null,
        homeScore: 0,
        awayScore: 0,
        status: 'scheduled',
        nextMatchId: null,
        slot: null
      };

      // Si estamos en la primera ronda, emparejamos los equipos de entrada
      if (r === 1) {
        match.homeTeamId = teamIds[m * 2];
        match.awayTeamId = teamIds[m * 2 + 1];
      }

      currentRoundMatches.push(match);
    }
    rounds.push(currentRoundMatches);
  }

  // Vincular cada partido con su 'nextMatchId' y su 'slot' ('home' / 'away')
  for (let r = 0; r < numRounds - 1; r++) {
    const currentRound = rounds[r];
    const nextRound = rounds[r + 1];

    for (let i = 0; i < currentRound.length; i++) {
      const parentMatchIndex = Math.floor(i / 2);
      const parentMatch = nextRound[parentMatchIndex];

      currentRound[i].nextMatchId = parentMatch.id;
      currentRound[i].slot = i % 2 === 0 ? 'home' : 'away';
    }
  }

  // Aplanar la lista de partidos para retornarlos
  return rounds.flat();
}