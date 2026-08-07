// js/utils/fixture-generator.js

/**
 * Genera fixture Todos contra Todos (Round-Robin) usando el algoritmo Berger
 */
export function generateRoundRobin(teams) {
  const teamIds = teams.map(t => t.id);
  
  // Si el número de equipos es impar, se añade un comodín (null)
  if (teamIds.length % 2 !== 0) {
    teamIds.push(null);
  }

  const numTeams = teamIds.length;
  const numRounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;
  const schedule = [];

  let roundTeams = [...teamIds];

  for (let round = 0; round < numRounds; round++) {
    const roundMatches = [];

    for (let i = 0; i < matchesPerRound; i++) {
      const home = roundTeams[i];
      const away = roundTeams[numTeams - 1 - i];

      // Ignorar si alguno es el comodín (descansa)
      if (home !== null && away !== null) {
        // Alternar localía para equidad
        if (round % 2 === 0) {
          roundMatches.push({ homeTeamId: home, awayTeamId: away, round: round + 1 });
        } else {
          roundMatches.push({ homeTeamId: away, awayTeamId: home, round: round + 1 });
        }
      }
    }

    schedule.push(...roundMatches);

    // Rotar array manteniendo el primer elemento fijo
    roundTeams = [
      roundTeams[0],
      roundTeams[numTeams - 1],
      ...roundTeams.slice(1, numTeams - 1)
    ];
  }

  return schedule;
}

/**
 * Genera la primera ronda de Eliminación Directa (Playoffs)
 */
export function generatePlayoffs(teams) {
  const teamIds = teams.map(t => t.id);
  const matches = [];
  
  // Empareja secuencialmente (1 vs 2, 3 vs 4...)
  for (let i = 0; i < teamIds.length; i += 2) {
    if (i + 1 < teamIds.length) {
      matches.push({
        homeTeamId: teamIds[i],
        awayTeamId: teamIds[i + 1],
        round: 1,
        bracketPosition: Math.floor(i / 2) + 1
      });
    }
  }

  return matches;
}