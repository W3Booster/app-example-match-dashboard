import { matchupKey, races, type Matchup } from './notebook-model';

export interface SavedNotes { version: 3; notes: Record<string, string>; lastMatch?: Matchup; previousNotes: string; }
const empty = (): SavedNotes => ({ version: 3, notes: {}, previousNotes: '' });
export function parseNotes(raw: string): SavedNotes {
  const data = JSON.parse(raw);
  if (data?.version !== 3 || !data.notes || typeof data.notes !== 'object' || Array.isArray(data.notes) || typeof data.previousNotes !== 'string') throw Error('Unreadable notes');
  for (const [key, text] of Object.entries(data.notes)) {
    const parts = JSON.parse(key);
    if (!Array.isArray(parts) || parts.length !== 3 || !races.includes(parts[0]) || !races.includes(parts[1]) || typeof parts[2] !== 'string' || !parts[2].trim() || typeof text !== 'string') throw Error('Unreadable note');
  }
  if (data.lastMatch && (!races.includes(data.lastMatch.ownRace) || !races.includes(data.lastMatch.opponentRace) || typeof data.lastMatch.map !== 'string' || !data.lastMatch.map.trim())) throw Error('Unreadable last matchup');
  return data;
}

// Compatibility only. New forks need just the v3 store, not this migration.
// Leave both retired keys untouched; collapse written fields into free-form text.
export function migrateNotes(v2: string | null, v1: string | null): SavedNotes {
  const result = empty();
  if (v2 !== null) {
    const old = JSON.parse(v2);
    if (old?.version !== 2 || !Array.isArray(old.plans)) throw Error('Unreadable previous notebook');
    for (const plan of old.plans) {
      const labels = { gamePlan: 'Game plan', scouting: 'Scouting cues', responses: 'Responses', mistakes: 'Mistakes to avoid', notes: 'Notes' };
      const text = Object.entries(labels).map(([key, label]) => {
        if (typeof plan[key] !== 'string') throw Error('Unreadable previous note');
        return plan[key] ? `${label}\n${plan[key]}` : '';
      }).filter(Boolean).join('\n\n');
      if (typeof plan.map !== 'string') throw Error('Unreadable previous map');
      if (races.includes(plan.ownRace) && races.includes(plan.opponentRace) && plan.map.trim()) {
        const key = matchupKey(plan);
        result.notes[key] = [result.notes[key], text].filter(Boolean).join('\n\n');
      } else if (text) result.previousNotes += `${plan.map || 'Any map'}\n${text}\n\n`;
    }
  } else if (v1 !== null) {
    const old = JSON.parse(v1);
    if (!Array.isArray(old)) throw Error('Unreadable previous notebook');
    for (const entry of old) {
      if (typeof entry.note !== 'string' || typeof entry.map !== 'string') throw Error('Unreadable previous note');
      result.previousNotes += `${entry.map}\n${entry.note}\n\n`;
    }
  }
  return result;
}

export function openNotes(base: string, status: HTMLElement) {
  const key = `${base}:v3`;
  let saved: string | null = null, writable = true, data = empty();
  try {
    saved = localStorage.getItem(key);
    data = saved === null ? migrateNotes(localStorage.getItem(`${base}:v2`), localStorage.getItem(base)) : parseNotes(saved);
  } catch { writable = false; status.textContent = 'Stored notes could not be read. They will not be overwritten. Copy any new text before closing.'; }
  return { data, save() {
    if (!writable) return;
    try {
      if (localStorage.getItem(key) !== saved) {
        writable = false;
        status.textContent = 'Notes changed in another window. Copy your text, then reload; the other version has not been overwritten.';
        return;
      }
      const next = JSON.stringify(data);
      localStorage.setItem(key, next); saved = next;
      status.textContent = 'Saved in this browser.';
    } catch { status.textContent = 'Could not save. Copy your text before closing.'; }
  } };
}
