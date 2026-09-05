import type { MatchState } from '@w3booster/sdk';
import { isMode } from '@w3booster/sdk/standard-game';

export interface Matchup { ownRace: string; opponentRace: string; map: string; }
export const races = ['human', 'orc', 'night-elf', 'undead'];
export const raceLabel = (race: string) => ({ human: 'Human', orc: 'Orc', 'night-elf': 'Night Elf', undead: 'Undead' })[race] || race;
export const matchupKey = (m: Matchup) => JSON.stringify([m.ownRace, m.opponentRace, m.map.trim().toLowerCase()]);
export const matchupTitle = (m: Matchup) => `${raceLabel(m.ownRace)} vs ${raceLabel(m.opponentRace)} · ${m.map}`;

// A note belongs to one directional 1v1 matchup on one exact map.
export function matchupFor(state: MatchState, playerId: string): Matchup | undefined {
  if (!state.match.id || state.match.status === 'none' || !isMode(state.match.mode, '1v1') || state.players.length !== 2 || !state.match.map?.trim()) return;
  const own = state.players.find(p => p.id === playerId);
  const opponent = state.players.find(p => p.id !== playerId);
  if (!own || !opponent || !races.includes(own.race || '') || !races.includes(opponent.race || '')) return;
  if (own.team != null && own.team === opponent.team) return;
  return { ownRace: own.race!, opponentRace: opponent.race!, map: state.match.map.trim() };
}
