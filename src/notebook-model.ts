import type { MatchState } from '@w3booster/sdk';
import { isMode } from '@w3booster/sdk/standard-game';

export interface Matchup { ownRace: string; opponentRace: string; map: string; }
export const races = ['human', 'orc', 'night-elf', 'undead'];
export const raceLabel = (race: string) => ({ human: 'Human', orc: 'Orc', 'night-elf': 'Night Elf', undead: 'Undead' })[race] || race;
export const matchupKey = (m: Matchup) => JSON.stringify([m.ownRace, m.opponentRace, m.map.trim().toLowerCase()]);
export const matchupTitle = (m: Matchup) => `${raceLabel(m.ownRace)} vs ${raceLabel(m.opponentRace)} · ${m.map}`;

// A note belongs to one directional 1v1 matchup on one exact map.
export function matchupProblem(state: MatchState, playerId: string): string | undefined {
  if (!state.match.id || state.match.status === 'none') return 'Waiting for a game.';
  if (state.players.length < 2) return 'Waiting for both players. Check that player data is allowed in the app permissions.';
  if (!isMode(state.match.mode, '1v1') || state.players.length !== 2) return 'Matchup notes support 1v1 games, including games against the computer.';
  if (!state.match.map?.trim()) return 'Waiting for the map name.';
  const own = state.players.find(p => p.id === playerId);
  const opponent = state.players.find(p => p.id !== playerId);
  if (!own || !opponent) return 'Choose your player below.';
  if (own.team != null && own.team === opponent.team) return 'The two players must be on opposing teams.';
  if (!races.includes(own.race || '') || !races.includes(opponent.race || '')) return 'A race is unknown or hidden (Random). Choose the actual race below to create or open its notes.';
}

export function matchupFor(state: MatchState, playerId: string): Matchup | undefined {
  if (matchupProblem(state, playerId)) return;
  const own = state.players.find(p => p.id === playerId)!;
  const opponent = state.players.find(p => p.id !== playerId)!;
  return { ownRace: own.race!, opponentRace: opponent.race!, map: state.match.map!.trim() };
}
