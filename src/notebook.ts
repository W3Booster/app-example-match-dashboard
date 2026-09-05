import type { ApplicationRuntime } from '@w3booster/sdk/app';
import { element } from './ui';
import { matchupFor, matchupKey, matchupTitle, type Matchup } from './notebook-model';
import { openNotes } from './notebook-storage';

export function notebook(runtime: ApplicationRuntime<any>, demo: boolean, signal: AbortSignal) {
  const view = element('section', '', 'notebook');
  const status = element('p', '', 'notice'); status.setAttribute('role', 'status');
  const storage = openNotes(`match-notebook:${document.body.dataset.application}:${demo ? 'demo' : 'live'}`, status);
  const context = element('p', '', 'eyebrow');
  const heading = element('h2');
  const perspective = element('div');
  const editor = element('div', '', 'note-editor');
  let shownKey = '', selectedPlayer = '', matchId = '', playerOptions = '';

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
        storage.data.notes[key] = ''; storage.save(); shownKey = ''; show(matchup);
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
    if (active && state.match.id !== matchId) { matchId = state.match.id; selectedPlayer = ''; }
    const playerId = selectedPlayer || (state?.match.isObserver || state?.match.isReplay ? '' : state?.match.broadcasterPlayerId || '');
    const choices = active && (state.match.isObserver || state.match.isReplay || !state.match.broadcasterPlayerId) ? JSON.stringify([state.match.id, state.players.map(p => [p.id, p.name])]) : '';
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
    const current = active ? matchupFor(state, playerId) : undefined;
    if (current && (!storage.data.lastMatch || matchupKey(storage.data.lastMatch) !== matchupKey(current))) {
      storage.data.lastMatch = current; storage.save();
    }
    context.textContent = active ? state.match.status === 'finished' ? 'LAST MATCH' : 'CURRENT MATCH' : 'LAST MATCH';
    if (active && !current) {
      context.textContent = 'Notes need a 1v1 match, a map, known races and your player.';
      show();
    } else {
      if (!active && !storage.data.lastMatch) context.textContent = 'Play a match to start your notebook.';
      show(current || storage.data.lastMatch);
    }
  }

  view.append(context, heading, perspective, editor, status);
  if (storage.data.previousNotes) {
    const previous = element('details'); previous.append(element('summary', 'Notes from the previous version'));
    const text = element('textarea'); text.readOnly = true; text.value = storage.data.previousNotes; text.setAttribute('aria-label', 'Previous notes');
    previous.append(element('p', 'These notes had no exact matchup. Their text is kept here so you can copy it.'), text); view.append(previous);
  }
  view.append(element('p', 'Notes stay in this browser. Demo and live notes are separate.', 'privacy'));
  runtime.lifecycle.subscribe(update, { signal }); update();
  return view;
}
