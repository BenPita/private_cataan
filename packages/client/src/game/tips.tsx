/**
 * First-game guidance: short tips that appear at the moment they are useful,
 * once per device. One tip at a time; "Got it" moves on to the next one.
 */
import { useState } from 'react';
import type { PlayerView } from '@hex/engine';
import { t, type Key } from '../i18n';
import { markTipSeen, seenTips, tipsEnabled } from '../prefs';

interface TipContext {
  view: PlayerView;
  myTurn: boolean;
  incomingTrade: boolean;
  board3d: boolean;
}

/** In priority order: urgent situations first. */
const TIPS: Array<{ id: string; text: Key; when: (c: TipContext) => boolean }> = [
  { id: 'discard', text: 'tipDiscard', when: (c) => c.view.phase === 'ROBBER_DISCARD' && c.view.pendingDiscards[c.view.me!] !== undefined },
  { id: 'robber', text: 'tipRobber', when: (c) => c.myTurn && c.view.phase === 'ROBBER_MOVE' },
  { id: 'trade', text: 'tipIncomingTrade', when: (c) => c.incomingTrade },
  { id: 'setup', text: 'tipSetup', when: (c) => c.myTurn && c.view.phase === 'INITIAL_PLACEMENT' && !c.view.setup?.lastSettlement },
  { id: 'setupRoad', text: 'tipSetupRoad', when: (c) => c.myTurn && c.view.phase === 'INITIAL_PLACEMENT' && !!c.view.setup?.lastSettlement },
  { id: 'roll', text: 'tipRoll', when: (c) => c.myTurn && c.view.phase === 'PRE_ROLL' },
  { id: 'tray', text: 'tipTray', when: (c) => c.myTurn && c.view.phase === 'MAIN_ACTIONS' && c.view.freeRoads === 0 },
  { id: 'dev', text: 'tipDev', when: (c) => (c.view.players[c.view.me!].devCardCount ?? 0) > 0 },
  { id: 'board3d', text: 'tipBoard3d', when: (c) => c.board3d && c.view.phase !== 'ORDER_ROLL' },
];

export function TipBubble(props: TipContext) {
  const [seen, setSeen] = useState(seenTips);
  if (!tipsEnabled()) return null;
  const tip = TIPS.find((x) => !seen.has(x.id) && x.when(props));
  if (!tip) return null;
  return (
    <div className="tip" role="status">
      <span className="tip-icon">💡</span>
      <p>{t(tip.text)}</p>
      <button
        className="btn primary small"
        onClick={() => {
          markTipSeen(tip.id);
          setSeen(seenTips());
        }}
      >
        {t('gotIt')}
      </button>
    </div>
  );
}
