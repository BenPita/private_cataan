/**
 * Original illustrations (simple SVG drawings) for resources, development
 * cards and pieces. Inspired by the warm, painted board-game look, but drawn
 * from scratch — no official artwork is used.
 */
import type { DevCardType, Resource } from '@hex/engine';

export const RESOURCE_BG: Record<Resource, [string, string]> = {
  lumber: ['#4f8f3a', '#2c5e23'],
  brick: ['#d9773e', '#a8461f'],
  wool: ['#b7e07a', '#7fb24a'],
  grain: ['#f4cf5a', '#d9a22a'],
  ore: ['#a8b0ba', '#6d7680'],
};

export function ResourceGlyph({ r, size = 28, x, y }: { r: Resource; size?: number; x?: number; y?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} x={x} y={y} aria-hidden>
      {r === 'lumber' && (
        <g>
          <rect x="6" y="20" width="28" height="9" rx="4.5" fill="#8a5a2b" stroke="#4a2e12" strokeWidth="1.5" />
          <rect x="9" y="11" width="24" height="9" rx="4.5" fill="#a26c35" stroke="#4a2e12" strokeWidth="1.5" />
          <circle cx="30" cy="15.5" r="3.4" fill="#e8c48b" stroke="#4a2e12" strokeWidth="1.2" />
          <circle cx="30" cy="15.5" r="1.4" fill="none" stroke="#a26c35" strokeWidth="0.8" />
          <circle cx="30" cy="24.5" r="3.4" fill="#e8c48b" stroke="#4a2e12" strokeWidth="1.2" />
          <circle cx="30" cy="24.5" r="1.4" fill="none" stroke="#a26c35" strokeWidth="0.8" />
        </g>
      )}
      {r === 'brick' && (
        <g stroke="#6b2a10" strokeWidth="1.4">
          <rect x="5" y="23" width="14" height="7" rx="1" fill="#c8562a" />
          <rect x="20" y="23" width="14" height="7" rx="1" fill="#b84b22" />
          <rect x="12" y="15" width="14" height="7" rx="1" fill="#d4643a" />
          <rect x="16" y="7" width="12" height="7" rx="1" fill="#c8562a" />
        </g>
      )}
      {r === 'wool' && (
        <g>
          <ellipse cx="20" cy="22" rx="12" ry="8" fill="#fbfbf5" stroke="#8a8a80" strokeWidth="1.3" />
          <circle cx="12" cy="18" r="4" fill="#fbfbf5" stroke="#8a8a80" strokeWidth="1.1" />
          <circle cx="20" cy="15.5" r="4.5" fill="#fbfbf5" stroke="#8a8a80" strokeWidth="1.1" />
          <circle cx="27" cy="17" r="4" fill="#fbfbf5" stroke="#8a8a80" strokeWidth="1.1" />
          <ellipse cx="32" cy="22" rx="3.6" ry="3" fill="#3a3a3a" />
          <rect x="13" y="28" width="2.4" height="5" fill="#3a3a3a" />
          <rect x="24" y="28" width="2.4" height="5" fill="#3a3a3a" />
        </g>
      )}
      {r === 'grain' && (
        <g stroke="#8a6512" strokeWidth="1.1">
          {[12, 20, 28].map((x, i) => (
            <g key={x} transform={`rotate(${(i - 1) * 14} 20 34)`}>
              <line x1={x} y1="34" x2={x} y2="14" stroke="#9b7a1d" strokeWidth="1.6" />
              {[0, 1, 2, 3].map((k) => (
                <g key={k}>
                  <ellipse cx={x - 2.2} cy={10 + k * 4.2} rx="2" ry="3.2" fill="#f1c445" />
                  <ellipse cx={x + 2.2} cy={10 + k * 4.2} rx="2" ry="3.2" fill="#e8b632" />
                </g>
              ))}
            </g>
          ))}
        </g>
      )}
      {r === 'ore' && (
        <g stroke="#3b4148" strokeWidth="1.4" strokeLinejoin="round">
          <polygon points="6,30 12,16 22,12 31,17 35,29 22,34" fill="#8d96a0" />
          <polygon points="12,16 22,12 20,22 9,24" fill="#b8c0c8" />
          <polygon points="22,12 31,17 26,24 20,22" fill="#a1aab3" />
          <circle cx="16" cy="27" r="1.6" fill="#e8d36a" stroke="none" />
          <circle cx="27" cy="27" r="1.2" fill="#e8d36a" stroke="none" />
        </g>
      )}
    </svg>
  );
}

/** A printed resource card (painted illustration from /art), optionally with a count. */
export function ResourceCard({ r, count, small, dim }: { r: Resource; count?: number; small?: boolean; dim?: boolean }) {
  return (
    <span className={`rcard ${small ? 'small' : ''} ${dim ? 'dim' : ''}`}>
      <img className="rcard-img" src={`/art/card-${r}.webp`} alt="" draggable={false} />
      {count !== undefined && <b className="rcard-count">{count}</b>}
    </span>
  );
}

const DEV_COLORS: Record<DevCardType, string> = {
  knight: '#2f5d9e',
  victoryPoint: '#a8741a',
  roadBuilding: '#3f7a35',
  yearOfPlenty: '#6a4596',
  monopoly: '#9c3a2a',
};

/** A development card: coloured title banner, painted illustration, rules text. */
export function DevCardFace({ type, title, text }: { type: DevCardType; title: string; text?: string }) {
  return (
    <span className={`dcard ${text ? 'with-text' : ''}`}>
      <span className="dcard-head" style={{ background: DEV_COLORS[type] }}>
        {title}
      </span>
      <img className="dcard-art" src={`/art/dev-${type}.webp`} alt="" draggable={false} />
      {text && <span className="dcard-text">{text}</span>}
    </span>
  );
}

export const PLAYER_SHADE: Record<string, string> = {
  '#d8392b': '#9e2418',
  '#2f6fd6': '#1d4a94',
  '#f4f1e8': '#bdb7a6',
  '#f08a1c': '#b05f0b',
};

export function shade(color: string): string {
  return PLAYER_SHADE[color] ?? 'rgba(0,0,0,0.35)';
}
