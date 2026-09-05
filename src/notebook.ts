import type { ApplicationRuntime } from '@w3booster/sdk/app';
import { formatGameTime, isMode } from '@w3booster/sdk/standard-game';
import { element } from './ui';
import { fields, limits, matchingPlans, mergeNotebooks, migrateLegacy, newPlan, parseNotebook, races, raceLabel, title, type Notebook, type Plan, type Race } from './notebook-model';

export function notebook(runtime: ApplicationRuntime<any>, demo: boolean, signal: AbortSignal) {
  const legacyKey = `match-notebook:${document.body.dataset.application}:${demo ? 'demo' : 'live'}`;
  const key = `${legacyKey}:v2`;
  const view = element('section', '', 'notebook');
  const notice = element('p', '', 'notice'); notice.setAttribute('role', 'status');
  const storageStatus = element('p', '', 'notice'); storageStatus.setAttribute('role', 'status');
  const live = element('section', '', 'notebook-live');
  const suggestions = element('div', '', 'notebook-suggestions');
  const library = element('div', '', 'notebook-library');
  const editor = element('div', '', 'notebook-editor');
  const search = element('input'); search.type = 'search'; search.placeholder = 'Search races, map or notes'; search.setAttribute('aria-label', 'Search plans');
  let book: Notebook = { version: 2, plans: [] }, selected = '', storageHealthy = true;
  let lastStored: string | null = null;
  let perspective = '', matchIdentity = '', liveSignature = '';
  try {
    const stored = localStorage.getItem(key);
    lastStored = stored;
    if (stored !== null) book = parseNotebook(stored);
    else {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null) {
        book = migrateLegacy(legacy);
        notice.textContent = 'Previous notes preserved as unclassified plans. Choose their races; the original notebook remains untouched.';
        persist();
      }
    }
    selected = book.plans[0]?.id || '';
  } catch {
    storageHealthy = false;
    storageStatus.textContent = 'Browser storage is unavailable or unreadable. It will not be overwritten. Changes are session-only; export before closing.';
  }
  function persist() {
    if (!storageHealthy) return;
    try {
      parseNotebook(JSON.stringify(book));
      if (localStorage.getItem(key) !== lastStored) {
        storageHealthy = false;
        storageStatus.textContent = 'This notebook changed in another window. Saving is paused to preserve both versions. Export your edits, reload, then import to merge.';
        return;
      }
      const serialized = JSON.stringify(book);
      localStorage.setItem(key, serialized);
      lastStored = serialized;
      storageStatus.textContent = 'Saved in this browser only. Export a backup before clearing browser data.';
    } catch { storageStatus.textContent = 'Could not save. Your changes are still on screen; export before closing.'; }
  }
  function updatePlan(plan: Plan, patch: Partial<Plan>) {
    try { parseNotebook(JSON.stringify({ version: 2, plans: book.plans.map(p => p === plan ? { ...p, ...patch } : p) })); }
    catch { notice.textContent = 'Notebook limit reached. Export and remove a plan or shorten its notes before adding more.'; return false; }
    Object.assign(plan, patch); persist(); return true;
  }
  function context() {
    const snapshot = runtime.lifecycle.get(), state = snapshot.state;
    if (!snapshot.isSynchronized || !state || state.match.status === 'none' || !state.match.id) return null;
    if (!isMode(state.match.mode, '1v1') || state.players.length !== 2) return null;
    const own = state.players.find(p => p.id === perspective), opponent = state.players.find(p => p.id !== perspective);
    if (!own || !opponent || (own.team != null && own.team === opponent.team)) return null;
    if (!races.includes(own.race as any) || !races.includes(opponent.race as any)) return null;
    return { state, own: own.race as Race, opponent: opponent.race as Race, map: state.match.map || '' };
  }
  function choose(plan: Plan) { selected = plan.id; renderLibrary(); renderEditor(); }
  function add(plan: Plan) {
    if (book.plans.length >= limits.plans) { notice.textContent = 'Notebook full (100 plans). Export and delete a plan before adding another.'; return; }
    try { parseNotebook(JSON.stringify({ version: 2, plans: [plan, ...book.plans] })); }
    catch { notice.textContent = 'Notebook size limit reached. Export and remove a plan before adding another.'; return; }
    book.plans.unshift(plan); persist(); choose(plan); renderSuggestions();
  }
  function renderSuggestions() {
    const current = context(); suggestions.replaceChildren();
    if (!current) { suggestions.append(element('p', 'Live suggestions need fresh 1v1 data, known races and a selected player. Manual plans remain available offline and during team games.')); return; }
    suggestions.append(element('h2', `For this matchup · ${raceLabel(current.own)} vs ${raceLabel(current.opponent)}`));
    const matches = matchingPlans(book.plans, current.own, current.opponent, current.map);
    if (!matches.length) suggestions.append(element('p', 'No matching plans yet. Nothing is created automatically.'));
    for (const plan of matches) {
      const button = element('button', '', 'suggested-plan');
      button.append(element('strong', plan.map || 'Any map'), element('span', plan.gamePlan || 'Open your matchup notes'));
      button.addEventListener('click', () => choose(plan), { signal }); suggestions.append(button);
    }
    const create = element('button', 'New plan for this matchup');
    create.addEventListener('click', () => { const fresh = context(); if (fresh) add(newPlan(fresh.own, fresh.opponent, fresh.map)); }, { signal });
    suggestions.append(create);
  }
  function renderLibrary() {
    library.replaceChildren(element('h2', `Your plans (${book.plans.length}/100)`));
    const query = search.value.trim().toLowerCase();
    const visible = book.plans.filter(p => [title(p), ...Object.keys(fields).map(f => p[f as keyof typeof fields])].join(' ').toLowerCase().includes(query));
    if (!visible.length) library.append(element('p', query ? 'No plans match your search.' : 'Start with a matchup you want to improve. No match needs to be running.'));
    for (const plan of visible) {
      const button = element('button', '', 'notebook-entry'); button.setAttribute('aria-pressed', String(plan.id === selected));
      button.append(element('strong', `${raceLabel(plan.ownRace)} vs ${raceLabel(plan.opponentRace)}`), element('span', `${plan.map || 'Any map'} · ${plan.matches.length} supporting matches`));
      button.addEventListener('click', () => choose(plan), { signal }); library.append(button);
    }
  }
  function labeled<T extends HTMLElement>(label: string, control: T) { const wrapper = element('label', label); control.setAttribute('aria-label', label); wrapper.append(control); return wrapper; }
  function raceSelect(value: Race) {
    const select = element('select');
    for (const race of ['', ...races]) { const option = element('option', race ? raceLabel(race) : 'Choose race'); option.value = race; select.append(option); }
    select.value = value; return select;
  }
  function renderEditor() {
    editor.replaceChildren();
    const plan = book.plans.find(p => p.id === selected);
    if (!plan) { editor.append(element('h2', 'Prepare for the next matchup.'), element('p', 'Create a reusable plan for your race, the opponent’s race and a map—or leave the map blank for general advice. Attach matches only when they teach you something.')); return; }
    const heading = element('h2', title(plan));
    const own = raceSelect(plan.ownRace), opponent = raceSelect(plan.opponentRace), map = element('input'); map.value = plan.map; map.maxLength = 200; map.placeholder = 'Any map';
    const tags = element('div', '', 'plan-tags'); tags.append(labeled('Your race', own), labeled('Opponent race', opponent), labeled('Map (blank = Any map)', map));
    const changed = () => { heading.textContent = title(plan); renderLibrary(); renderSuggestions(); };
    own.addEventListener('change', () => { if (updatePlan(plan, { ownRace: own.value as Race })) changed(); else own.value = plan.ownRace; }, { signal });
    opponent.addEventListener('change', () => { if (updatePlan(plan, { opponentRace: opponent.value as Race })) changed(); else opponent.value = plan.opponentRace; }, { signal });
    map.addEventListener('input', () => { if (updatePlan(plan, { map: map.value })) changed(); else map.value = plan.map; }, { signal });
    editor.append(element('span', 'PRIVATE / MATCHUP PREPARATION', 'eyebrow'), heading, tags);
    const prompts = { gamePlan: 'What will you practice in this matchup?', scouting: 'What information do you need, and when?', responses: 'If you scout X, how will you respond?', mistakes: 'What should you avoid repeating?', notes: 'Takeaways, build details, questions for next time…' };
    const writing = element('div', '', 'plan-writing');
    for (const [field, label] of Object.entries(fields)) {
      const name = field as keyof typeof fields;
      const input = element('textarea'); input.rows = name === 'notes' ? 4 : 3; input.maxLength = limits.text; input.value = plan[name]; input.placeholder = prompts[name];
      input.addEventListener('input', () => { if (updatePlan(plan, { [name]: input.value })) changed(); else input.value = plan[name]; }, { signal });
      writing.append(labeled(label, input));
    }
    const support = element('section', '', 'supporting-matches');
    const renderSupport = () => {
      support.replaceChildren(element('h3', `Supporting matches (${plan.matches.length}/20)`));
      if (!plan.matches.length) support.append(element('p', 'Save evidence for this plan, then write what you learned above. Snapshots are manual, not replay analysis.'));
      for (const match of plan.matches) {
        const item = element('div', '', 'saved-match');
        item.append(element('strong', `${match.map || 'Unknown map'} · ${formatGameTime(match.time)}`), element('p', match.players.join(' / ')));
        const remove = element('button', 'Remove snapshot');
        remove.addEventListener('click', () => { if (!confirm('Remove this snapshot? Your plan and notes will stay.')) return; plan.matches = plan.matches.filter(m => m.id !== match.id); persist(); renderSupport(); renderLibrary(); }, { signal });
        item.append(remove); support.append(item);
      }
    };
    const attach = element('button', 'Attach current match'); attach.className = 'attach-match';
    attach.addEventListener('click', () => {
      const current = context();
      if (!current) { notice.textContent = 'Select a player in a fresh 1v1 match first.'; return; }
      if (!matchingPlans([plan], current.own, current.opponent, current.map).length) { notice.textContent = 'This plan does not match the selected races and map. Assign its matchup first or choose a matching plan.'; return; }
      const { match, players } = current.state;
      if (plan.matches.length >= limits.matches && !plan.matches.some(m => m.id === match.id)) { notice.textContent = 'This plan already has 20 supporting matches. Export and remove a snapshot first.'; return; }
      if (!updatePlan(plan, { matches: [{ id: match.id, map: match.map || '', mode: match.mode || '', time: match.gameTime, players: players.map(p => `${p.name} · ${raceLabel(p.race || '')}`) }, ...plan.matches.filter(m => m.id !== match.id)] })) return;
      persist(); renderSupport(); renderLibrary(); notice.textContent = 'Snapshot attached. Your existing plan and notes are unchanged; add a takeaway when ready.';
    }, { signal });
    const copy = element('button', 'Copy plan');
    const fallback = element('textarea'); fallback.readOnly = true; fallback.hidden = true; fallback.setAttribute('aria-label', 'Plan to copy manually');
    copy.addEventListener('click', async () => {
      const report = `${title(plan)}\n\n${Object.entries(fields).map(([f, label]) => `${label}\n${plan[f as keyof typeof fields]}`).join('\n\n')}\n\nSupporting matches\n${plan.matches.map(m => `${m.map} · ${formatGameTime(m.time)} · ${m.players.join(' / ')}`).join('\n')}`;
      try { await navigator.clipboard.writeText(report); notice.textContent = 'Plan copied.'; }
      catch { fallback.hidden = false; fallback.value = report; fallback.focus(); fallback.select(); notice.textContent = 'Clipboard unavailable. Select and copy the plan below.'; }
    }, { signal });
    const remove = element('button', 'Delete plan');
    remove.addEventListener('click', () => { if (!confirm('Delete this plan, all its notes and supporting snapshots? Export a backup first if needed.')) return; book.plans = book.plans.filter(p => p.id !== plan.id); selected = book.plans[0]?.id || ''; persist(); renderLibrary(); renderEditor(); renderSuggestions(); }, { signal });
    const actions = element('div', '', 'notebook-actions'); actions.append(attach, copy, remove);
    renderSupport(); editor.append(writing, actions, fallback, support); updateAttach();
  }
  function updateAttach() {
    const attach = editor.querySelector<HTMLButtonElement>('.attach-match');
    if (attach) attach.disabled = !context();
  }
  const toolbar = element('div', '', 'notebook-toolbar');
  const create = element('button', 'New matchup plan'); create.addEventListener('click', () => add(newPlan()), { signal });
  const exportButton = element('button', 'Export notebook');
  exportButton.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(book)], { type: 'application/json' }));
    const link = element('a'); link.href = url; link.download = `match-notebook-${demo ? 'demo' : 'live'}.json`; view.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); notice.textContent = 'Export requested. Keep this file private: it contains your notes and captured player names.';
  }, { signal });
  const importInput = element('input'); importInput.type = 'file'; importInput.accept = '.json,application/json'; importInput.setAttribute('aria-label', 'Import notebook');
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0]; if (!file) return;
    try {
      if (file.size > limits.bytes) throw Error('Notebook exceeds the 2 MB import limit.');
      const incoming = parseNotebook(await file.text());
      if (signal.aborted) return;
      if (!confirm(`Merge ${incoming.plans.length} imported plans into this ${demo ? 'demo' : 'live'} notebook? Existing plans will not be overwritten; conflicting versions are kept separately.`)) return;
      const merged = mergeNotebooks(book, incoming), added = merged.plans.length - book.plans.length;
      book = merged; selected ||= book.plans[0]?.id || ''; persist(); renderLibrary(); renderEditor(); renderSuggestions(); notice.textContent = `Imported ${added} new plans. Existing plans preserved.`;
    } catch (error) { notice.textContent = `Import rejected; existing plans unchanged. ${error instanceof Error ? error.message : 'Invalid file.'}`; }
    finally { importInput.value = ''; }
  }, { signal });
  search.addEventListener('input', renderLibrary, { signal }); toolbar.append(create, exportButton, labeled('Import notebook', importInput), search);
  runtime.lifecycle.subscribe(snapshot => {
    const state = snapshot.state;
    if (matchIdentity !== state?.match.id) { matchIdentity = state?.match.id || ''; perspective = state?.match.isObserver ? '' : state?.match.broadcasterPlayerId || ''; }
    const signature = JSON.stringify([snapshot.isSynchronized, state?.match.id, state?.match.status, state?.match.mode, state?.match.map, state?.players.map(p => [p.id, p.name, p.race, p.team])]);
    if (signature !== liveSignature) {
      liveSignature = signature;
      live.replaceChildren(element('span', snapshot.isSynchronized ? state?.match.status === 'finished' ? 'FINISHED MATCH' : 'CURRENT MATCH' : 'CONNECTION NOT FRESH', 'eyebrow'));
      live.append(element('strong', state?.match.status !== 'none' && snapshot.isSynchronized ? state?.match.map || 'Unknown map' : 'No fresh match · prepare manually'), element('span', '', 'match-clock'));
      if (snapshot.isSynchronized && state && state.match.status !== 'none' && isMode(state.match.mode, '1v1') && state.players.length === 2) {
        const select = element('select'), prompt = element('option', 'Choose player'); prompt.value = ''; select.append(prompt);
        for (const player of state.players) { const option = element('option', `${player.name} · ${raceLabel(player.race || '')}`); option.value = player.id; select.append(option); }
        select.value = perspective;
        select.addEventListener('change', () => { perspective = select.value; renderSuggestions(); updateAttach(); }, { signal }); live.append(labeled('Your perspective', select));
      }
      renderSuggestions(); updateAttach();
    }
    const clock = live.querySelector('.match-clock'); if (clock) clock.textContent = snapshot.isSynchronized && state?.match.status !== 'none' && state ? formatGameTime(state.match.gameTime) : '';
  }, { signal });
  const columns = element('div', '', 'notebook-columns'); columns.append(library, editor);
  renderLibrary(); renderEditor();
  view.append(live, suggestions, toolbar, notice, storageStatus, columns, element('p', 'Private browser-local notes · Demo and live notebooks are separate · No cloud sync or account isolation · Manual 1v1 preparation, no overlay'));
  return view;
}
