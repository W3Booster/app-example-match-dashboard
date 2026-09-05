import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoState } from '@w3booster/sdk/testing';
import { matchupFor, matchupKey } from '../src/notebook-model.ts';

test('notes match exact races and map, independently of match ID', () => {
  const state = createDemoState();
  const matchup = matchupFor(state, '0');
  assert.equal(matchup.ownRace, 'human');
  assert.equal(matchupKey(matchup), matchupKey(matchupFor({ ...state, match: { ...state.match, id: 'next-game', map: ' echo isles ' } }, '0')));
  assert.notEqual(matchupKey(matchup), matchupKey(matchupFor(state, '1')));
  assert.notEqual(matchupKey(matchup), matchupKey({ ...matchup, map: 'Autumn Leaves' }));
});
test('unsupported or incomplete matches cannot create misleading notes', () => {
  const state = createDemoState();
  assert.equal(matchupFor(state, ''), undefined);
  for (const match of [{ ...state.match, status: 'none' }, { ...state.match, mode: '2v2' }, { ...state.match, map: '' }]) assert.equal(matchupFor({ ...state, match }, '0'), undefined);
  assert.equal(matchupFor({ ...state, players: state.players.map(p => ({ ...p, race: 'random' })) }, '0'), undefined);
  assert.ok(matchupFor({ ...state, match: { ...state.match, status: 'finished' } }, '0'));
});
