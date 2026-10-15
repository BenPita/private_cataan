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

/** A small resource "card": cream frame, painted colour panel, icon. */
export function ResourceCard({ r, count, small, dim }: { r: Resource; count?: number; small?: boolean; dim?: boolean }) {
  const [a, b] = RESOURCE_BG[r];
  return (
    <span className={`rcard ${small ? 'small' : ''} ${dim ? 'dim' : ''}`}>
      <span className="rcard-art" style={{ background: `radial-gradient(circle at 40% 30%, ${a}, ${b})` }}>
        <ResourceGlyph r={r} size={small ? 18 : 30} />
      </span>
      {count !== undefined && <b className="rcard-count">{count}</b>}
    </span>
  );
}

const DEV_COLORS: Record<DevCardType, string> = {
  knight: '#3b6fb6',
  victoryPoint: '#c48a1a',
  roadBuilding: '#4c8a3c',
  yearOfPlenty: '#7a4fb0',
  monopoly: '#b5432f',
};

export function DevArt({ type, size = 44 }: { type: DevCardType; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      {type === 'knight' && (
        <g>
          <path d="M14 40 L14 22 Q14 10 24 8 Q34 10 34 22 L34 40 Z" fill="#cfd6de" stroke="#2f3a46" strokeWidth="2" />
          <rect x="17" y="20" width="14" height="3" fill="#2f3a46" />
          <path d="M24 8 Q28 2 34 4" fill="none" stroke="#c0392b" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {type === 'victoryPoint' && (
        <g>
          <circle cx="24" cy="24" r="16" fill="#f3c74e" stroke="#8a5d0b" strokeWidth="2" />
          <polygon points="24,12 27.5,20.5 36,21 29.5,27 31.5,35.5 24,31 16.5,35.5 18.5,27 12,21 20.5,20.5" fill="#fff4c4" stroke="#8a5d0b" strokeWidth="1.2" />
        </g>
      )}
      {type === 'roadBuilding' && (
        <g>
          <rect x="6" y="26" width="36" height="7" rx="2" fill="#a26c35" stroke="#4a2e12" strokeWidth="1.5" transform="rotate(-18 24 29)" />
          <rect x="6" y="14" width="36" height="7" rx="2" fill="#b97d40" stroke="#4a2e12" strokeWidth="1.5" transform="rotate(-18 24 17)" />
        </g>
      )}
      {type === 'yearOfPlenty' && (
        <g>
          <path d="M10 30 Q24 6 38 30 Z" fill="#f6e3a8" stroke="#6b4a12" strokeWidth="2" />
          <circle cx="24" cy="22" r="4" fill="#ffd54a" stroke="#6b4a12" strokeWidth="1.2" />
          <path d="M24 12 L24 6 M16 16 L12 12 M32 16 L36 12" stroke="#f2a516" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="12" y="30" width="24" height="8" rx="2" fill="#8a5a2b" />
        </g>
      )}
      {type === 'monopoly' && (
        <g>
          <circle cx="18" cy="28" r="10" fill="#f3c74e" stroke="#8a5d0b" strokeWidth="2" />
          <circle cx="30" cy="22" r="10" fill="#f8d465" stroke="#8a5d0b" strokeWidth="2" />
          <text x="30" y="27" textAnchor="middle" fontSize="13" fontWeight="700" fill="#8a5d0b">$</text>
        </g>
      )}
    </svg>
  );
}

export function DevCardFace({ type, title }: { type: DevCardType; title: string }) {
  return (
    <span className="dcard">
      <span className="dcard-head" style={{ background: DEV_COLORS[type] }}>
        {title}
      </span>
      <span className="dcard-art">
        <DevArt type={type} />
      </span>
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
