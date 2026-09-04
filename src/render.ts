import type { MatchState } from '@w3booster/sdk';
import { formatGameTime } from '@w3booster/sdk/standard-game';
import { element } from './ui';

export function dashboard(state: MatchState | null) {
  const view = element('section', '', 'match-desk');
  if (!state || state.match.status === 'none') {
    view.append(element('span', 'STANDBY', 'eyebrow'), element('h2', 'Waiting for a match'), element('p', 'The match desk is ready. Players appear when a match starts.'));
    return view;
  }
  const top = element('div', '', 'desk-topline');
  top.append(element('span', state.match.mode || 'Match', 'mode-tag'), element('span', state.match.map || 'Map unavailable'), element('span', state.match.status === 'finished' ? 'FINAL' : 'IN PROGRESS', 'live-tag'));
  const arena = element('div', '', 'arena');
  state.players.forEach((player, index) => {
    const card = element('article', '', 'contender');
    card.append(element('span', String(index + 1).padStart(2, '0'), 'contender-number'));
    card.append(element('span', player.race || 'Race unavailable', 'eyebrow'), element('h3', player.name));
    const team = player.team == null ? 'Team unavailable' : 'TEAM ' + (player.team + 1);
    card.append(element('p', team, 'team-label'));
    arena.append(card);
  });
  const clock = element('div', '', 'match-timer');
  clock.append(element('span', 'GAME TIME', 'eyebrow'), element('strong', formatGameTime(state.match.gameTime)), element('span', 'LIVE MATCH DESK', 'timer-caption'));
  const bottom = element('div', '', 'desk-bottomline');
  bottom.append(element('span', state.players.length + ' players connected'), element('span', 'Players · Teams · Match lifecycle'));
  view.append(top, clock, arena, bottom);
  if (state.match.status === 'finished') view.append(element('p', 'Match finished', 'notice'));
  return view;
}
