import type { ApplicationRuntime } from '@w3booster/sdk/app';
import { formatGameTime } from '@w3booster/sdk/standard-game';
import { element } from './ui';

interface Entry { id: string; map: string; mode: string; time: number; players: string[]; note: string; }
export function notebook(runtime: ApplicationRuntime<any>, demo: boolean, signal: AbortSignal) {
  const key = `match-notebook:${document.body.dataset.application}:${demo ? 'demo' : 'live'}`;
  const view = element('section', '', 'notebook');
  const live = element('div', '', 'notebook-live');
  const capture = element('button', 'Keep match snapshot');
  const notice = element('p', '', 'notice'); notice.setAttribute('role', 'status');
  const library = element('div', '', 'notebook-library');
  const editor = element('div', '', 'notebook-editor');
  let entries: Entry[] = [], selected = '', storageHealthy = true;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(stored) || stored.length > 20 || stored.some(e => !e || typeof e.id !== 'string' || typeof e.map !== 'string' || typeof e.mode !== 'string' || !Number.isFinite(e.time) || !Array.isArray(e.players) || e.players.some((p: unknown) => typeof p !== 'string') || typeof e.note !== 'string')) throw Error('Invalid notebook');
    entries = stored; selected = entries[0]?.id || '';
  } catch { storageHealthy = false; notice.textContent = 'Browser storage is unavailable or unreadable. Existing storage will not be overwritten; copy your notes before closing.'; }
  function persist() {
    if (!storageHealthy) return;
    try { localStorage.setItem(key, JSON.stringify(entries)); notice.textContent = 'Saved in this browser only. Demo and live notebooks are separate.'; }
    catch { notice.textContent = 'Could not save in this browser. Copy your notes before closing.'; }
  }
  function renderEditor() {
    editor.replaceChildren();
    const entry = entries.find(e => e.id === selected);
    if (!entry) { editor.append(element('h2', 'Make the next game better.'), element('p', 'Keep a match snapshot, then record an opening, a turning point, or one thing to practice. Notes stay private in this browser; they are never sent to an overlay.')); return; }
    const note = element('textarea'); note.value = entry.note; note.maxLength = 8000; note.rows = 8;
    note.placeholder = 'Opening plan\nTurning point\nOne thing to practice next game';
    const label = element('label', 'Private match notes'); label.append(note);
    note.addEventListener('input', () => { entry.note = note.value; persist(); }, { signal });
    const copy = element('button', 'Copy match summary + notes');
    const fallback = element('textarea'); fallback.readOnly = true; fallback.hidden = true; fallback.setAttribute('aria-label', 'Summary to copy manually');
    copy.addEventListener('click', async () => {
      const report = `${entry.map} · ${entry.mode} · Snapshot at ${formatGameTime(entry.time)}\n${entry.players.join('\n')}\n\n${entry.note}`;
      try { await navigator.clipboard.writeText(report); notice.textContent = 'Match summary and notes copied.'; }
      catch { fallback.hidden = false; fallback.value = report; fallback.focus(); fallback.select(); notice.textContent = 'Clipboard unavailable. Select and copy the summary below.'; }
    }, { signal });
    const remove = element('button', 'Delete this note');
    remove.addEventListener('click', () => {
      if (!confirm('Delete this saved match snapshot and its notes?')) return;
      entries = entries.filter(e => e.id !== selected); selected = entries[0]?.id || ''; persist(); renderLibrary(); renderEditor();
    }, { signal });
    const actions = element('div', '', 'notebook-actions'); actions.append(copy, remove);
    editor.append(element('span', 'PRIVATE / LOCAL NOTEBOOK', 'eyebrow'), element('h2', entry.map), element('p', `${entry.mode} · Saved snapshot at ${formatGameTime(entry.time)}`), element('p', entry.players.join(' / ')), label, actions, fallback);
  }
  function renderLibrary() {
    library.replaceChildren(element('h2', `Your notebook (${entries.length}/20)`));
    for (const entry of entries) {
      const button = element('button', '', 'notebook-entry'); button.setAttribute('aria-pressed', String(entry.id === selected));
      button.append(element('strong', entry.map), element('span', entry.players.join(' / ')));
      button.addEventListener('click', () => { selected = entry.id; renderLibrary(); renderEditor(); }, { signal }); library.append(button);
    }
    library.append(element('p', 'Snapshots are kept only when you ask. This is not replay analysis or automatic match history. Clearing browser data removes these notes.'));
  }
  capture.addEventListener('click', () => {
    const snapshot = runtime.lifecycle.get(); const state = snapshot.state;
    if (!snapshot.isSynchronized || !state || state.match.status === 'none' || !state.match.id) return;
    const existing = entries.find(e => e.id === state.match.id);
    if (!existing && entries.length >= 20) { notice.textContent = 'Notebook full. Copy and delete a note before keeping another match.'; return; }
    const entry: Entry = { id: state.match.id, map: state.match.map || 'Unknown map', mode: state.match.mode || 'Match', time: state.match.gameTime, players: state.players.map(p => `${p.name} · ${p.race || 'Unknown race'}${p.team == null ? '' : ' · Team ' + (p.team + 1)}`), note: existing?.note || '' };
    entries = [entry, ...entries.filter(e => e.id !== entry.id)]; selected = entry.id; persist(); renderLibrary(); renderEditor();
  }, { signal });
  runtime.lifecycle.subscribe(snapshot => {
    const state = snapshot.state;
    capture.disabled = !snapshot.isSynchronized || !state || state.match.status === 'none' || !state.match.id;
    live.replaceChildren(element('span', snapshot.isSynchronized ? 'CURRENT MATCH' : 'CONNECTION NOT FRESH', 'eyebrow'), element('strong', capture.disabled ? 'Waiting for fresh match data' : `${state!.match.map || 'Unknown map'} · ${formatGameTime(state!.match.gameTime)}`), capture);
  }, { signal });
  const columns = element('div', '', 'notebook-columns'); columns.append(library, editor);
  renderLibrary(); renderEditor(); view.append(live, notice, columns); return view;
}
