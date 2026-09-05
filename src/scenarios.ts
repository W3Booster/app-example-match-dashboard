import { createDemoState } from '@w3booster/sdk/testing';

export const scenarios = ['match', 'no-match', 'missing-data', 'teams', 'observer', 'unknown-race', 'night-elf', 'finished'] as const;
export function scenarioState(name: string) {
  const fixture = createDemoState();
  const state = { ...fixture, match: { ...fixture.match, gameTime: 872 } };
  if (name === 'night-elf') return { ...state, players: state.players.map((p, i) => ({ ...p, race: i === 0 ? 'night-elf' : 'undead' })) };
  if (name === 'observer') return { ...state, match: { ...state.match, isObserver: true } };
  if (name === 'unknown-race') return { ...state, players: state.players.map(({ race: _race, ...player }) => player) };
  if (name === 'no-match') return { ...state, match: { id: '', status: 'none' as const, gameTime: 0, mode: '' }, players: [] };
  if (name === 'missing-data') return {
    match: state.match, capabilities: ['match', 'players'] as const,
    players: state.players.map(({ id, name, race, team }) => ({ id, name, race, team }))
  };
  if (name === 'finished') return { ...state, match: { ...state.match, status: 'finished' as const } };
  if (name === 'teams') return {
    ...state, match: { ...state.match, mode: '2v2' },
    players: [...state.players, ...state.players.map((player, index) => ({ ...player, id: String(index + 2), name: ['Moonrise', 'Stormguard'][index] }))]
  };
  return state;
}
