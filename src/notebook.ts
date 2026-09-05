import type { ApplicationRuntime } from '@w3booster/sdk/app';
import type { Race } from '@w3booster/sdk';
import { element } from './ui';
import { matchupFor, matchupProblem, matchupKey, matchupTitle, matchups, races, raceLabel, type Matchup } from './notebook-model';
import { isMode } from '@w3booster/sdk/standard-game';
import { openNotes } from './notebook-storage';

export function notebook(runtime: ApplicationRuntime<any>, demo: boolean, signal: AbortSignal) {
  const view = element('section', '', 'notebook');
  const status = element('p', '', 'notice'); status.setAttribute('role', 'status');
  const storage = openNotes(`match-notebook:${document.body.dataset.application}:${demo ? 'demo' : 'live'}`, status);
  const context = element('p', '', 'eyebrow');
  const heading = element('h2');
  const perspective = element('div');
  const raceChoices = element('div', '', 'race-choices');
  const editor = element('div', '', 'note-editor');
  let shownKey = '', selectedPlayer = '', matchId = '', playerOptions = '';
  let raceOptions = '';
  let manualMatchup: Matchup | undefined;
  const browse = element('div', '', 'matchup-choices');
  const matchupSelect = element('select'); matchupSelect.setAttribute('aria-label', 'Matchup');
  const prompt = element('option', 'Choose matchup'); prompt.value = ''; prompt.disabled = true; matchupSelect.append(prompt);
  for (const matchup of matchups) {
    const option = element('option', `${raceLabel(matchup.ownRace)} vs ${raceLabel(matchup.opponentRace)}`);
    option.value = matchupKey(matchup); matchupSelect.append(option);
  }
  const mapSelect = element('select'); mapSelect.setAttribute('aria-label', 'Map');
  const matchupLabel = element('label', 'Matchup'); matchupLabel.append(matchupSelect);
  const mapLabel = element('label', 'Map'); mapLabel.append(mapSelect);
  browse.append(matchupLabel, mapLabel);
  matchupSelect.addEventListener('change', () => {
    manualMatchup = matchups.find(m => matchupKey(m) === matchupSelect.value);
    update();
  }, { signal });
  mapSelect.addEventListener('change', () => {
    const matchup = matchups.find(m => matchupKey(m) === matchupSelect.value);
    if (matchup) manualMatchup = { ...matchup, map: mapSelect.value };
    update();
  }, { signal });

  function updateChoices(matchup?: Matchup, current?: Matchup) {
    for (const option of matchupSelect.options) {
      const candidate = matchups.find(m => matchupKey(m) === option.value);
      if (!candidate) continue;
      const count = Object.keys(storage.data.notes).filter(key => {
        const [ownRace, opponentRace] = JSON.parse(key);
        return ownRace === candidate.ownRace && opponentRace === candidate.opponentRace;
      }).length;
      option.textContent = `${raceLabel(candidate.ownRace)} vs ${raceLabel(candidate.opponentRace)}${count ? ` · ${count} ${count === 1 ? 'note' : 'notes'}` : ''}`;
    }
    matchupSelect.value = matchup ? matchupKey({ ...matchup, map: '' }) : '';
    const maps = new Map<string, string>();
    // Preserve the labels of saved maps and offer the detected map as well.
    for (const key of Object.keys(storage.data.notes)) {
      const [ownRace, opponentRace, map] = JSON.parse(key);
      if (map && ownRace === matchup?.ownRace && opponentRace === matchup?.opponentRace) maps.set(map.trim().toLowerCase(), map);
    }
    for (const candidate of [storage.data.lastMatch, current, matchup]) {
      if (candidate?.map) maps.set(candidate.map.toLowerCase(), candidate.map);
    }
    const options = [['', 'All maps'], ...[...maps.entries()].sort((a, b) => a[1].localeCompare(b[1]))];
    const signature = JSON.stringify(options);
    if (mapSelect.dataset.options !== signature) {
      mapSelect.dataset.options = signature;
      mapSelect.replaceChildren(...options.map(([value, title]) => {
        const option = element('option', title); option.value = value; return option;
      }));
    }
    mapSelect.value = matchup?.map.toLowerCase() || '';
    mapSelect.disabled = !matchup;
  }
  let selectedRaces: Record<string, Race | undefined> = {};

  function show(matchup?: Matchup) {
    const key = matchup ? matchupKey(matchup) : '';
    heading.textContent = matchup ? matchupTitle(matchup) : 'Waiting for a 1v1 match';
    // Only switch the editor when its matchup changes, never on live ticks.
    if (shownKey === key) return;
    shownKey = key; editor.replaceChildren();
    if (!matchup) return;
    if (storage.data.notes[key] === undefined) {
      const create = element('button', 'Create matchup notes');
      create.addEventListener('click', () => {
        storage.data.notes[key] = ''; storage.save(); shownKey = ''; update();
        editor.querySelector('textarea')?.focus();
      }, { signal });
      editor.append(element('p', 'No notes for this matchup yet.'), create);
      return;
    }
    const label = element('label', 'Matchup notes');
    const text = element('textarea'); text.setAttribute('aria-label', 'Matchup notes');
    text.value = storage.data.notes[key]; text.rows = 10;
    text.placeholder = 'What do you want to remember next time?';
    text.addEventListener('input', () => { storage.data.notes[key] = text.value; storage.save(); }, { signal });
    label.append(text); editor.append(label);
  }

  function update() {
    const snapshot = runtime.lifecycle.get(), state = snapshot.state;
    const active = snapshot.isSynchronized && state && state.match.status !== 'none';
    if (active && state.match.id !== matchId) { matchId = state.match.id; selectedPlayer = ''; selectedRaces = {}; manualMatchup = undefined; }
    const detectedPlayer = state?.players.find(p => p.id === state.match.broadcasterPlayerId);
    const playerId = selectedPlayer || (state?.match.isObserver || state?.match.isReplay ? '' : detectedPlayer?.id || '');
    const choices = active && (state.match.isObserver || state.match.isReplay || !detectedPlayer) ? JSON.stringify([state.match.id, state.players.map(p => [p.id, p.name])]) : '';
    if (choices !== playerOptions) {
      playerOptions = choices; perspective.replaceChildren();
      if (choices && state) {
        const select = element('select'); select.setAttribute('aria-label', 'Your perspective');
        const prompt = element('option', 'Choose your player'); prompt.value = ''; select.append(prompt);
        for (const player of state.players) { const option = element('option', player.name); option.value = player.id; select.append(option); }
        select.value = selectedPlayer;
        select.addEventListener('change', () => { selectedPlayer = select.value; update(); }, { signal });
        perspective.append(select);
      }
    }
    // Random races can be hidden by the recorder. Ask only for missing data;
    // never infer a race from private game information or change the SDK state.
    const unknown = active && isMode(state.match.mode, '1v1') && state.players.length === 2 && state.players.some(p => p.id === playerId)
      ? state.players.filter(p => !races.includes(p.race || '')) : [];
    const raceSignature = JSON.stringify([matchId, playerId, unknown.map(p => p.id)]);
    if (raceSignature !== raceOptions) {
      raceOptions = raceSignature; raceChoices.replaceChildren();
      for (const player of unknown) {
        const label = element('label', player.id === playerId ? 'Your race ' : 'Opponent race ');
        const select = element('select'); select.setAttribute('aria-label', player.id === playerId ? 'Your race' : 'Opponent race');
        const prompt = element('option', 'Choose race'); prompt.value = ''; select.append(prompt);
        for (const race of races) { const option = element('option', raceLabel(race)); option.value = race; select.append(option); }
        select.value = selectedRaces[player.id] || '';
        select.addEventListener('change', () => { selectedRaces[player.id] = races.includes(select.value) ? select.value as Race : undefined; update(); }, { signal });
        label.append(select); raceChoices.append(label);
      }
    }
    const resolved = active ? { ...state, players: state.players.map(p => ({ ...p, race: races.includes(p.race || '') ? p.race : selectedRaces[p.id] || p.race })) } : undefined;
    const current = resolved ? matchupFor(resolved, playerId) : undefined;
    if (current && (!storage.data.lastMatch || matchupKey(storage.data.lastMatch) !== matchupKey(current))) {
      storage.data.lastMatch = current; storage.save();
    }
    context.textContent = active ? state.match.status === 'finished' ? 'LAST MATCH' : 'CURRENT MATCH' : 'LAST MATCH';
    const automatic = current || (!active ? storage.data.lastMatch : undefined);
    const shown = manualMatchup || (automatic ? { ...automatic, map: '' } : !active ? matchups[0] : undefined);
    if (manualMatchup) context.textContent = 'YOUR NOTEBOOK';
    else if (active && !current) context.textContent = matchupProblem(resolved!, playerId) || '';
    else if (!active && !storage.data.lastMatch) context.textContent = 'Choose a matchup to start your notebook.';
    updateChoices(shown, current);
    show(shown);
  }

  view.append(context, heading, perspective, raceChoices, browse, editor, status);
  if (storage.data.previousNotes) {
    const previous = element('details'); previous.append(element('summary', 'Notes from the previous version'));
    const text = element('textarea'); text.readOnly = true; text.value = storage.data.previousNotes; text.setAttribute('aria-label', 'Previous notes');
    previous.append(element('p', 'These notes had no exact matchup. Their text is kept here so you can copy it.'), text); view.append(previous);
  }
  runtime.lifecycle.subscribe(update, { signal }); update();
  return view;
}
