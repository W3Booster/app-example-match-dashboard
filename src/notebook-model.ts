export const races = ['human', 'orc', 'night-elf', 'undead'] as const;
export type Race = typeof races[number] | '';
export interface Snapshot { id: string; map: string; mode: string; time: number; players: string[]; }
export interface Plan {
  id: string; ownRace: Race; opponentRace: Race; map: string;
  gamePlan: string; scouting: string; responses: string; mistakes: string; notes: string;
  matches: Snapshot[];
}
export interface Notebook { version: 2; plans: Plan[]; }
export const fields = { gamePlan: 'Game plan', scouting: 'Scouting cues', responses: 'Responses', mistakes: 'Mistakes to avoid', notes: 'Free-form notes' } as const;
export const limits = { plans: 100, matches: 20, text: 8000, bytes: 2_000_000 };
export const raceLabel = (race: string) => ({ human: 'Human', orc: 'Orc', 'night-elf': 'Night Elf', undead: 'Undead' })[race] || 'Unclassified';
export const normalizeMap = (map: string) => map.trim().toLowerCase();
export const title = (plan: Plan) => `${raceLabel(plan.ownRace)} vs ${raceLabel(plan.opponentRace)} · ${plan.map || 'Any map'}`;
export function newPlan(ownRace: Race = '', opponentRace: Race = '', map = ''): Plan {
  return { id: crypto.randomUUID(), ownRace, opponentRace, map, gamePlan: '', scouting: '', responses: '', mistakes: '', notes: '', matches: [] };
}
function text(value: unknown, max = limits.text): asserts value is string {
  if (typeof value !== 'string' || value.length > max) throw Error('Invalid or oversized notebook text.');
}
function snapshot(value: any): Snapshot {
  if (!value || typeof value !== 'object') throw Error('Invalid match snapshot.');
  text(value.id, 200); text(value.map, 200); text(value.mode, 200);
  if (!value.id || !Number.isFinite(value.time) || value.time < 0 || !Array.isArray(value.players) || value.players.length > 32) throw Error('Invalid match snapshot.');
  value.players.forEach((p: unknown) => text(p, 500));
  return { id: value.id, map: value.map, mode: value.mode, time: value.time, players: [...value.players] };
}
export function parseNotebook(raw: string): Notebook {
  if (new TextEncoder().encode(raw).byteLength > limits.bytes) throw Error('Notebook exceeds the 2 MB import limit.');
  const data = JSON.parse(raw);
  if (data?.version !== 2 || !Array.isArray(data.plans) || data.plans.length > limits.plans) throw Error('Expected a version 2 notebook with at most 100 plans.');
  const ids = new Set<string>();
  const plans = data.plans.map((p: any) => {
    if (!p || typeof p !== 'object') throw Error('Invalid plan.');
    text(p.id, 200); text(p.map, 200);
    if (!p.id || ids.has(p.id) || ![...races, ''].includes(p.ownRace) || ![...races, ''].includes(p.opponentRace)) throw Error('Invalid plan identity or races.');
    ids.add(p.id);
    for (const field of Object.keys(fields)) text(p[field]);
    if (!Array.isArray(p.matches) || p.matches.length > limits.matches) throw Error('Too many supporting matches.');
    const matches = p.matches.map(snapshot);
    if (new Set(matches.map((m: Snapshot) => m.id)).size !== matches.length) throw Error('Duplicate supporting match.');
    return { id: p.id, ownRace: p.ownRace, opponentRace: p.opponentRace, map: p.map,
      gamePlan: p.gamePlan, scouting: p.scouting, responses: p.responses, mistakes: p.mistakes, notes: p.notes, matches };
  });
  return { version: 2, plans };
}
// Copy the retired store, never modify its original key or guess a perspective.
export function migrateLegacy(raw: string): Notebook {
  if (raw.length > limits.bytes) throw Error('Legacy notebook is too large.');
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.length > 20) throw Error('Invalid legacy notebook.');
  const plans = entries.map(entry => {
    const saved = snapshot(entry); text(entry.note);
    return { ...newPlan(), id: `legacy:${saved.id}`, map: saved.map === 'Unknown map' ? '' : saved.map, notes: entry.note, matches: [saved] };
  });
  return parseNotebook(JSON.stringify({ version: 2, plans }));
}
export function matchingPlans(plans: Plan[], own: Race, opponent: Race, map: string) {
  if (!own || !opponent) return [];
  return plans.filter(p => p.ownRace === own && p.opponentRace === opponent && (!normalizeMap(p.map) || normalizeMap(p.map) === normalizeMap(map)))
    .sort((a, b) => Number(!!normalizeMap(b.map)) - Number(!!normalizeMap(a.map)));
}
export function mergeNotebooks(current: Notebook, incoming: Notebook): Notebook {
  const plans = [...current.plans];
  const signature = ({ id: _id, ...content }: Plan) => JSON.stringify(content);
  for (const plan of incoming.plans) {
    if (plans.some(existing => signature(existing) === signature(plan))) continue;
    plans.push(plans.some(p => p.id === plan.id) ? { ...plan, id: crypto.randomUUID() } : plan);
  }
  return parseNotebook(JSON.stringify({ version: 2, plans }));
}
