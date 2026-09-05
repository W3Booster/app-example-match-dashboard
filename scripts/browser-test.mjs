import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview, createServer } from 'vite';

const config = JSON.parse(await readFile(new URL('../example.json', import.meta.url), 'utf8'));
const definition = JSON.parse(await readFile(new URL('../app-definition.json', import.meta.url), 'utf8'));
assert.deepEqual(config.surfaces, ['application']);
assert.deepEqual(definition.scopes, ['match:read', 'players:read']);
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const browser = await chromium.launch();
let dev;
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 960 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  const open = async scenario => { await page.goto(base + '/?capture=1&scenario=' + scenario); await page.waitForSelector('body[data-synchronized="true"]'); };
  await open('no-match');
  assert.equal(await page.getByLabel('Matchup', { exact: true }).locator('option:not([disabled])').count(), 16);
  assert.equal(await page.getByLabel('Map', { exact: true }).inputValue(), '');
  await page.getByLabel('Matchup', { exact: true }).selectOption(JSON.stringify(['undead', 'night-elf', '']));
  await page.getByRole('button', { name: 'Create matchup notes' }).click();
  await page.getByLabel('Matchup notes', { exact: true }).fill('Plan before playing any games.');
  await page.getByLabel('Matchup', { exact: true }).selectOption(JSON.stringify(['human', 'human', '']));
  await page.getByLabel('Matchup', { exact: true }).selectOption(JSON.stringify(['undead', 'night-elf', '']));
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Plan before playing any games.');
  await open('finished');
  await page.getByRole('button', { name: 'Create matchup notes' }).click();
  await page.getByLabel('Matchup notes', { exact: true }).fill('Scout before committing.\nKeep the first push short.');
  await open('match');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Scout before committing.\nKeep the first push short.');
  assert.equal(await page.locator('.notebook button').count(), 0, 'matching notes open without a click');
  assert.equal(await page.locator('.notebook textarea').count(), 1);
  assert.equal(await page.locator('.notebook input').count(), 0, 'no search, tags or import');
  if (process.argv.includes('--screenshot')) {
    await page.evaluate(() => document.fonts.ready);
    await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL('../docs/screenshot.png', import.meta.url).pathname });
  }
  await open('no-match');
  await page.getByText('LAST MATCH', { exact: true }).waitFor();
  assert.match(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), /Scout/);
  await page.getByLabel('Matchup notes', { exact: true }).fill('After the game: remember to scout.');
  await open('night-elf');
  assert.equal(await page.getByRole('button', { name: 'Create matchup notes' }).count(), 1);
  await open('teams');
  assert.equal(await page.locator('.note-editor textarea, .note-editor button').count(), 0);
  await open('computer');
  assert.match(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), /After the game/);
  assert.equal(await page.locator('.race-choices select').count(), 0);
  await open('computer-random');
  await page.getByText(/A race is unknown or hidden/).waitFor();
  assert.equal(await page.locator('.note-editor textarea, .note-editor button').count(), 0);
  await page.getByLabel('Opponent race', { exact: true }).selectOption('undead');
  await page.getByRole('button', { name: 'Create matchup notes' }).click();
  await page.getByLabel('Matchup notes', { exact: true }).fill('Notes against the computer');
  await open('no-match');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Notes against the computer');
  await open('computer-random');
  assert.equal(await page.getByLabel('Opponent race', { exact: true }).inputValue(), '', 'hidden race is not guessed from a previous game');
  await page.getByLabel('Opponent race', { exact: true }).selectOption('undead');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Notes against the computer');
  await open('unknown-race');
  await page.getByLabel('Your race', { exact: true }).selectOption('human');
  await page.getByLabel('Opponent race', { exact: true }).selectOption('orc');
  assert.match(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), /After the game/);
  await open('missing-player');
  await page.getByText('Choose your player below.', { exact: true }).waitFor();
  await page.getByLabel('Your perspective').selectOption('0');
  assert.match(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), /After the game/);
  await open('observer');
  await page.getByLabel('Your perspective').selectOption('0');
  assert.match(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), /After the game/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(11, 13, 16)');
  await page.goto(base + '/?demo=0');
  await page.getByText(/Opening localhost directly does not authorize|Could not start/).first().waitFor();
  assert.equal(await page.locator('.note-editor textarea').count(), 0, 'demo does not become live notes');

  // A live launch must negotiate the current protocol, independently of demo fixtures.
  let requestedProtocols;
  await page.route('**/stream/v1/stream-tickets', async route => {
    requestedProtocols = route.request().postDataJSON().protocolVersions;
    await route.fulfill({ status: 400, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ error: 'This server supports a different W3Booster protocol.' }) });
  });
  await page.goto(base + '/?demo=0');
  await page.getByText('Match Notebook needs a matching app and W3Booster update before it can connect.', { exact: true }).waitFor();
  assert.deepEqual(requestedProtocols, ['2.0']);
  assert.equal(await page.locator('.note-editor textarea').count(), 0);
  await page.unroute('**/stream/v1/stream-tickets');

  // Exercise actual start/end events without reloading or adding hooks to the app.
  dev = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } }); await dev.listen();
  await page.goto('http://127.0.0.1:' + dev.httpServer.address().port + '/?capture=1');
  await page.waitForSelector('body[data-synchronized="true"]');
  await page.evaluate(async () => {
    const { notebook } = await import('/src/notebook.ts');
    const { scenarioState } = await import('/src/scenarios.ts');
    let snapshot = { isSynchronized: true, state: scenarioState('match') };
    const callbacks = [];
    const runtime = { lifecycle: { get: () => snapshot, subscribe: fn => callbacks.push(fn) } };
    document.body.dataset.application = 'event-test';
    document.body.replaceChildren(notebook(runtime, true, new AbortController().signal));
    window.deliver = (scenario, overrides = {}, synchronized = true) => {
      const state = scenarioState(scenario);
      snapshot = { isSynchronized: synchronized, state: { ...state, match: { ...state.match, ...overrides } } };
      callbacks.forEach(fn => fn());
    };
  });
  await page.getByRole('button', { name: 'Create matchup notes' }).click();
  await page.getByLabel('Matchup notes', { exact: true }).fill('Automatically remember me');
  await page.evaluate(() => window.deliver('match', { gameTime: 900 }));
  assert.ok(await page.getByLabel('Matchup notes', { exact: true }).evaluate(el => el === document.activeElement));
  await page.evaluate(() => window.deliver('no-match'));
  await page.getByLabel('Matchup notes', { exact: true }).fill('Written after the game');
  await page.evaluate(() => window.deliver('match', { id: 'different-map', map: 'Autumn Leaves' }));
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Written after the game');
  await page.getByLabel('Map', { exact: true }).selectOption('autumn leaves');
  await page.getByRole('button', { name: 'Create matchup notes' }).click();
  await page.getByLabel('Matchup notes', { exact: true }).fill('Autumn Leaves only.');
  await page.evaluate(() => window.deliver('match', { id: 'different-map', map: 'Autumn Leaves', gameTime: 901 }));
  assert.ok(await page.getByLabel('Matchup notes', { exact: true }).evaluate(el => el === document.activeElement));
  await page.getByLabel('Map', { exact: true }).selectOption('');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Written after the game');
  await page.getByLabel('Map', { exact: true }).selectOption('autumn leaves');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Autumn Leaves only.');
  await page.getByLabel('Matchup', { exact: true }).selectOption(JSON.stringify(['orc', 'human', '']));
  await page.getByRole('button', { name: 'Create matchup notes' }).click();
  await page.getByLabel('Matchup notes', { exact: true }).fill('Manual browsing stays open.');
  await page.evaluate(() => window.deliver('match', { id: 'different-map', map: 'Autumn Leaves', gameTime: 902 }));
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Manual browsing stays open.');
  assert.ok(await page.getByLabel('Matchup notes', { exact: true }).evaluate(el => el === document.activeElement));
  await page.evaluate(() => window.deliver('match', { id: 'new-match-same-map' }));
  assert.equal(await page.getByLabel('Map', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Written after the game');
  await page.evaluate(() => window.deliver('match', { id: 'stale-map', map: 'Do not use stale data' }, false));
  await page.getByText('LAST MATCH', { exact: true }).waitFor();
  assert.match(await page.locator('h2').textContent(), /All maps/);
  await page.evaluate(() => window.deliver('computer-random', { id: 'random-ai' }));
  await page.getByLabel('Opponent race', { exact: true }).selectOption('orc');
  await page.getByLabel('Matchup notes', { exact: true }).fill('Live AI notes');
  await page.evaluate(() => window.deliver('computer-random', { id: 'random-ai', gameTime: 901 }));
  assert.ok(await page.getByLabel('Matchup notes', { exact: true }).evaluate(el => el === document.activeElement));
  await page.evaluate(() => window.deliver('computer', { id: 'random-ai', gameTime: 902 }));
  assert.equal(await page.locator('.race-choices select').count(), 0, 'reported race replaces manual fallback');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Live AI notes');
  await page.evaluate(() => window.deliver('computer-random', { id: 'next-ai-game' }));
  assert.equal(await page.getByLabel('Opponent race', { exact: true }).inputValue(), '');
  assert.equal(await page.locator('.note-editor textarea').count(), 0);
  await page.evaluate(() => {
    const base = 'match-notebook:event-test:demo';
    localStorage.removeItem(base + ':v3');
    localStorage.setItem(base + ':v2', JSON.stringify({ version: 2, plans: [{ ownRace: 'human', opponentRace: 'orc', map: 'Echo Isles', gamePlan: 'Old plan', scouting: 'Old cues', responses: '', mistakes: '', notes: 'Old notes' }] }));
  });
  await page.evaluate(async () => {
    const { migrateNotes } = await import('/src/notebook-storage.ts');
    const data = migrateNotes(localStorage.getItem('match-notebook:event-test:demo:v2'), null);
    if (!Object.values(data.notes)[0].includes('Old notes') || !Object.values(data.notes)[0].includes('Old cues')) throw Error('Migration lost text');
    const previous = JSON.parse(localStorage.getItem('match-notebook:event-test:demo:v2'));
    previous.plans.push({ ...previous.plans[0], map: '', notes: 'Old general advice' });
    const migrated = migrateNotes(JSON.stringify(previous), null);
    if (!migrated.notes[JSON.stringify(['human', 'orc', ''])].includes('Old general advice')) throw Error('Migration lost general advice');
    if (!migrated.notes[JSON.stringify(['human', 'orc', 'echo isles'])].includes('Old notes')) throw Error('Migration merged map advice');
  });
  // Existing v3 map notes remain separate and reachable; new notes default to all maps.
  await open('match');
  await page.evaluate(() => {
    const key = `match-notebook:${document.body.dataset.application}:demo:v3`;
    localStorage.setItem(key, JSON.stringify({ version: 3, notes: {
      [JSON.stringify(['human', 'orc', 'echo isles'])]: 'Existing map advice',
      [JSON.stringify(['undead', 'night-elf', 'last refuge'])]: 'Another saved matchup',
    }, lastMatch: { ownRace: 'human', opponentRace: 'orc', map: 'Echo Isles' }, previousNotes: '' }));
  });
  await open('no-match');
  assert.equal(await page.getByLabel('Map', { exact: true }).inputValue(), '');
  await page.getByRole('button', { name: 'Create matchup notes' }).click();
  await page.getByLabel('Matchup notes', { exact: true }).fill('General advice');
  await page.getByLabel('Map', { exact: true }).selectOption('echo isles');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Existing map advice');
  await page.getByLabel('Matchup', { exact: true }).selectOption(JSON.stringify(['undead', 'night-elf', '']));
  assert.equal(await page.getByLabel('Map', { exact: true }).inputValue(), '');
  await page.getByLabel('Map', { exact: true }).selectOption('last refuge');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Another saved matchup');
  await open('match');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'General advice');
  await page.getByLabel('Map', { exact: true }).selectOption('echo isles');
  assert.equal(await page.getByLabel('Matchup notes', { exact: true }).inputValue(), 'Existing map advice');
  assert.deepEqual(errors, []);
  console.log('Notebook: all matchups, general and map-specific notes, live selection, persistence, existing notes, migration, mobile UI and demo isolation passed.');
} finally { await dev?.close(); await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
