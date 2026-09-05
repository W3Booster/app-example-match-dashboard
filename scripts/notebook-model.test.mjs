import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchingPlans, mergeNotebooks, migrateLegacy, newPlan, parseNotebook } from '../src/notebook-model.ts';
const book = plans => ({ version: 2, plans });
test('map-specific advice precedes general advice; races are directional', () => {
  const general = newPlan('human', 'orc');
  const exact = newPlan('human', 'orc', 'Echo Isles');
  const reversed = newPlan('orc', 'human', 'Echo Isles');
  const anotherMap = newPlan('human', 'orc', 'Autumn Leaves');
  assert.deepEqual(matchingPlans([general, anotherMap, reversed, exact], 'human', 'orc', ' echo isles '), [exact, general]);
  assert.deepEqual(matchingPlans([general, exact], 'human', 'orc', ''), [general]);
  assert.deepEqual(matchingPlans([newPlan()], '', '', ''), []);
});
test('legacy notes and snapshots survive without guessing races', () => {
  const legacy = [{ id: 'one', map: 'Echo Isles', mode: '1v1', time: 50, players: ['A · human', 'B · orc'], note: 'Keep this note' }];
  const result = migrateLegacy(JSON.stringify(legacy));
  assert.equal(result.plans[0].notes, legacy[0].note);
  assert.equal(result.plans[0].ownRace, '');
  assert.equal(result.plans[0].matches[0].id, 'one');
  assert.deepEqual(parseNotebook(JSON.stringify(result)), result);
});
test('imports merge idempotently and preserve conflicting versions', () => {
  const original = newPlan('human', 'orc'); original.notes = 'Original';
  const changed = { ...original, notes: 'Imported edit' };
  const merged = mergeNotebooks(book([original]), book([changed]));
  assert.equal(merged.plans.length, 2);
  assert.equal(merged.plans[0].notes, 'Original');
  assert.notEqual(merged.plans[1].id, original.id);
  assert.deepEqual(mergeNotebooks(merged, book([changed])), merged);
});
test('invalid and oversized imports fail before merging', () => {
  assert.throws(() => parseNotebook('{'));
  assert.throws(() => parseNotebook(JSON.stringify({ version: 3, plans: [] })));
  assert.throws(() => parseNotebook(JSON.stringify(book([{ ...newPlan(), ownRace: 'random' }]))));
  assert.throws(() => parseNotebook(JSON.stringify(book([{ ...newPlan(), notes: 'x'.repeat(8001) }]))));
  const repeated = newPlan();
  assert.throws(() => parseNotebook(JSON.stringify(book([repeated, repeated]))));
  const current = book(Array.from({ length: 100 }, () => newPlan()));
  assert.throws(() => mergeNotebooks(current, book([{ ...newPlan(), notes: 'new' }])));
  assert.equal(current.plans.length, 100);
});
