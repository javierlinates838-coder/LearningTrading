import type { ReactNode } from 'react';
import type { SceneId } from '../content/scenes';

/** Illustrated teaching scenes. Direction never relies on color alone: arrows and words are in the drawing. */

const ink = '#0C1017';
const text = '#F3EFE7';
const muted = '#AEB5C1';
const accent = '#7CC0FF';
const mastery = '#F0BF6E';
const up = '#5FD09A';
const down = '#FF8F80';
const line = '#6D7A91';

function Frame({ label, children, decorative }: { label: string; children: ReactNode; decorative?: boolean }) {
  return (
    <svg className="scene" viewBox="0 0 360 168" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
      <rect width="360" height="168" rx="14" fill={ink} />
      {children}
    </svg>
  );
}

function Candle({ x, y, h, up: rising, wick = 28 }: { x: number; y: number; h: number; up: boolean; wick?: number }) {
  const color = rising ? up : down;
  return (
    <g>
      <line x1={x + 7} x2={x + 7} y1={y - wick / 2} y2={y + h + wick / 2} stroke={color} strokeWidth="2" />
      <rect x={x} y={y} width="14" height={h} rx="2" fill={rising ? ink : color} stroke={color} strokeWidth="2" />
    </g>
  );
}

function Person({ x, y, color = text }: { x: number; y: number; color?: string }) {
  return (
    <g fill={color}>
      <circle cx={x} cy={y} r="8" />
      <path d={`M${x - 12} ${y + 34} q12 -16 24 0`} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d={`M${x} ${y + 8} v16`} stroke={color} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

export function SceneArt({ id, label, decorative }: { id: SceneId; label: string; decorative?: boolean }) {
  const art: Record<SceneId, ReactNode> = {
    welcome: (
      <>
        <path d="M28 128 C80 128 90 78 140 78 C190 78 200 108 250 96 C290 86 310 48 340 40" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <Candle x={46} y={96} h={28} up={false} />
        <Candle x={92} y={72} h={36} up />
        <Candle x={138} y={80} h={22} up={false} />
        <Candle x={184} y={58} h={40} up />
        <Candle x={230} y={64} h={24} up={false} />
        <Candle x={286} y={36} h={34} up />
        <circle cx="48" cy="132" r="7" fill={mastery} />
        <circle cx="150" cy="132" r="7" fill={accent} />
        <circle cx="300" cy="132" r="7" fill="none" stroke={line} strokeWidth="2" />
        <text x="28" y="24" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          A path of ideas, then a chart to try them on
        </text>
      </>
    ),
    shares: (
      <>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${36 + i * 78} 36)`}>
            <rect width="64" height="84" rx="8" fill="#151B25" stroke={accent} strokeWidth="2" />
            <circle cx="32" cy="22" r="8" fill="none" stroke={mastery} strokeWidth="2" />
            <text x="32" y="58" textAnchor="middle" fill={text} fontSize="16" fontFamily="Inter, sans-serif">
              $10
            </text>
          </g>
        ))}
        <text x="268" y="78" fill={text} fontSize="18" fontFamily="Inter, sans-serif">
          × 3
        </text>
        <text x="268" y="104" fill={accent} fontSize="20" fontFamily="Inter, sans-serif">
          = $30
        </text>
      </>
    ),
    spread: (
      <>
        <rect x="28" y="48" width="120" height="72" rx="12" fill="#133426" stroke={up} strokeWidth="2" />
        <text x="88" y="78" textAnchor="middle" fill={up} fontSize="14" fontFamily="Inter, sans-serif">
          Bid · sell
        </text>
        <text x="88" y="104" textAnchor="middle" fill={text} fontSize="22" fontFamily="Inter, sans-serif">
          $9.98
        </text>
        <rect x="212" y="48" width="120" height="72" rx="12" fill="#16304A" stroke={accent} strokeWidth="2" />
        <text x="272" y="78" textAnchor="middle" fill={accent} fontSize="14" fontFamily="Inter, sans-serif">
          Ask · buy
        </text>
        <text x="272" y="104" textAnchor="middle" fill={text} fontSize="22" fontFamily="Inter, sans-serif">
          $10.02
        </text>
        <path d="M152 84 H208" stroke={mastery} strokeWidth="2" strokeDasharray="4 3" />
        <text x="180" y="72" textAnchor="middle" fill={mastery} fontSize="12" fontFamily="Inter, sans-serif">
          spread
        </text>
      </>
    ),
    ladder: (
      <>
        <line x1="70" y1="24" x2="70" y2="148" stroke={line} strokeWidth="2" />
        <line x1="58" y1="36" x2="250" y2="36" stroke={up} strokeWidth="2" />
        <text x="258" y="40" fill={up} fontSize="14" fontFamily="Inter, sans-serif">
          ▲ Target
        </text>
        <line x1="58" y1="84" x2="250" y2="84" stroke={accent} strokeWidth="2" />
        <text x="258" y="88" fill={accent} fontSize="14" fontFamily="Inter, sans-serif">
          Entry
        </text>
        <line x1="58" y1="132" x2="250" y2="132" stroke={down} strokeWidth="2" />
        <text x="258" y="136" fill={down} fontSize="14" fontFamily="Inter, sans-serif">
          ▼ Stop
        </text>
        <rect x="78" y="84" width="18" height="48" fill="#3D1D1B" stroke={down} />
        <text x="108" y="114" fill={muted} fontSize="12" fontFamily="Inter, sans-serif">
          risk
        </text>
      </>
    ),
    costs: (
      <>
        <text x="28" y="40" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          A $4 gain, before costs
        </text>
        <rect x="28" y="56" width="220" height="28" rx="6" fill={up} />
        <text x="256" y="76" fill={up} fontSize="16" fontFamily="Inter, sans-serif">
          +$4
        </text>
        <text x="28" y="112" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          After the spread and a fee
        </text>
        <rect x="28" y="124" width="120" height="28" rx="6" fill={up} />
        <rect x="148" y="124" width="48" height="28" rx="6" fill="#3A2C15" stroke={mastery} />
        <text x="206" y="144" fill={text} fontSize="16" fontFamily="Inter, sans-serif">
          less
        </text>
      </>
    ),
    gap: (
      <>
        <Candle x={40} y={70} h={30} up />
        <Candle x={72} y={78} h={24} up={false} />
        <Candle x={104} y={64} h={32} up />
        <path d="M140 80 C180 80 180 120 230 120" fill="none" stroke={down} strokeWidth="2" strokeDasharray="5 4" />
        <text x="168" y="70" fill={down} fontSize="13" fontFamily="Inter, sans-serif">
          ▼ gap
        </text>
        <Candle x={236} y={108} h={28} up={false} />
        <Candle x={276} y={100} h={26} up />
        <text x="28" y="28" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          Price can skip. A stop fills at the next price, not the line.
        </text>
      </>
    ),
    zones: (
      <>
        <rect x="24" y="36" width="250" height="36" fill="#16304A" opacity="0.9" />
        <text x="280" y="58" fill={accent} fontSize="12" fontFamily="Inter, sans-serif">
          resistance
        </text>
        <rect x="24" y="108" width="250" height="36" fill="#133426" opacity="0.9" />
        <text x="280" y="130" fill={up} fontSize="12" fontFamily="Inter, sans-serif">
          support
        </text>
        <Candle x={48} y={78} h={26} up={false} />
        <Candle x={90} y={70} h={30} up />
        <Candle x={132} y={82} h={22} up={false} />
        <Candle x={174} y={68} h={34} up />
        <Candle x={216} y={80} h={24} up={false} />
      </>
    ),
    breakout: (
      <>
        <rect x="20" y="78" width="200" height="28" fill="#16304A" />
        <text x="28" y="70" fill={accent} fontSize="12" fontFamily="Inter, sans-serif">
          zone
        </text>
        <Candle x={36} y={86} h={22} up={false} />
        <Candle x={70} y={82} h={26} up />
        <Candle x={104} y={40} h={40} up />
        <text x="128" y="48" fill={up} fontSize="12" fontFamily="Inter, sans-serif">
          ▲ through
        </text>
        <Candle x={210} y={48} h={28} up />
        <Candle x={248} y={90} h={30} up={false} />
        <text x="210" y="150" fill={down} fontSize="12" fontFamily="Inter, sans-serif">
          ▼ fell back
        </text>
      </>
    ),
    fomo: (
      <>
        <Candle x={40} y={90} h={24} up />
        <Candle x={78} y={70} h={32} up />
        <Candle x={116} y={40} h={40} up />
        <text x="150" y="48" fill={up} fontSize="13" fontFamily="Inter, sans-serif">
          ▲ already moved
        </text>
        <Person x={250} y={78} color={mastery} />
        <path d="M230 100 H190" stroke={mastery} strokeWidth="2" markerEnd="url(#arr)" />
        <text x="200" y="150" fill={text} fontSize="13" fontFamily="Inter, sans-serif">
          urge, no stop
        </text>
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6" fill={mastery} />
          </marker>
        </defs>
      </>
    ),
    revenge: (
      <>
        <line x1="40" y1="56" x2="220" y2="56" stroke={down} strokeWidth="2" strokeDasharray="5 4" />
        <text x="230" y="60" fill={down} fontSize="13" fontFamily="Inter, sans-serif">
          ▼ first stop
        </text>
        <line x1="40" y1="118" x2="220" y2="118" stroke={down} strokeWidth="3" />
        <text x="230" y="122" fill={down} fontSize="13" fontFamily="Inter, sans-serif">
          ▼ moved
        </text>
        <path d="M150 64 v46" stroke={mastery} strokeWidth="2" />
        <path d="M142 100 l8 12 8 -12" fill="none" stroke={mastery} strokeWidth="2" />
        <rect x="70" y="56" width="16" height="62" fill="#3D1D1B" />
        <text x="40" y="152" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          The planned loss got bigger
        </text>
      </>
    ),
    scam: (
      <>
        {[
          ['Guaranteed', 'returns'],
          ['Act now', 'pressure'],
          ['Unregistered', 'seller'],
        ].map(([a, b], i) => (
          <g key={a} transform={`translate(${24 + i * 112} 40)`}>
            <rect width="100" height="78" rx="10" fill="#3D1D1B" stroke={down} strokeWidth="2" />
            <text x="50" y="34" textAnchor="middle" fill={text} fontSize="13" fontFamily="Inter, sans-serif">
              {a}
            </text>
            <text x="50" y="56" textAnchor="middle" fill={down} fontSize="13" fontFamily="Inter, sans-serif">
              {b}
            </text>
          </g>
        ))}
        <text x="24" y="148" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          Warning signs named by regulators
        </text>
      </>
    ),
    journal: (
      <>
        <rect x="28" y="28" width="140" height="116" rx="8" fill="#151B25" stroke={accent} strokeWidth="2" />
        <text x="44" y="52" fill={accent} fontSize="13" fontFamily="Inter, sans-serif">
          Plan
        </text>
        <text x="44" y="78" fill={text} fontSize="13" fontFamily="Inter, sans-serif">
          Entry · stop
        </text>
        <text x="44" y="100" fill={text} fontSize="13" fontFamily="Inter, sans-serif">
          Target · why
        </text>
        <rect x="192" y="28" width="140" height="116" rx="8" fill="#151B25" stroke={mastery} strokeWidth="2" />
        <text x="208" y="52" fill={mastery} fontSize="13" fontFamily="Inter, sans-serif">
          What happened
        </text>
        <text x="208" y="78" fill={text} fontSize="13" fontFamily="Inter, sans-serif">
          Fill · costs
        </text>
        <text x="208" y="100" fill={text} fontSize="13" fontFamily="Inter, sans-serif">
          Exit · reflection
        </text>
      </>
    ),
    grades: (
      <>
        <rect x="28" y="36" width="144" height="100" rx="12" fill="#133426" stroke={up} strokeWidth="2" />
        <text x="100" y="64" textAnchor="middle" fill={up} fontSize="13" fontFamily="Inter, sans-serif">
          Decision
        </text>
        <text x="100" y="96" textAnchor="middle" fill={text} fontSize="16" fontFamily="Inter, sans-serif">
          Followed plan
        </text>
        <rect x="188" y="36" width="144" height="100" rx="12" fill="#3D1D1B" stroke={down} strokeWidth="2" />
        <text x="260" y="64" textAnchor="middle" fill={down} fontSize="13" fontFamily="Inter, sans-serif">
          Outcome
        </text>
        <text x="260" y="96" textAnchor="middle" fill={text} fontSize="16" fontFamily="Inter, sans-serif">
          ▼ Loss
        </text>
      </>
    ),
    sample: (
      <>
        <text x="36" y="36" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          3 trades
        </text>
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={48 + i * 28} cy={78} r="10" fill={i === 2 ? down : up} />
        ))}
        <text x="36" y="118" fill={text} fontSize="13" fontFamily="Inter, sans-serif">
          Easy to misread
        </text>
        <text x="200" y="36" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          30 trades
        </text>
        {Array.from({ length: 15 }, (_, i) => (
          <circle key={i} cx={212 + (i % 5) * 24} cy={62 + Math.floor(i / 5) * 24} r="8" fill={i % 3 === 0 ? down : up} />
        ))}
      </>
    ),
    pass: (
      <>
        <Candle x={36} y={70} h={28} up />
        <Candle x={70} y={48} h={36} up />
        <Candle x={104} y={60} h={24} up={false} />
        <Candle x={138} y={40} h={40} up />
        <Person x={250} y={70} />
        <text x="214" y="140" fill={accent} fontSize="16" fontFamily="Inter, sans-serif">
          Pass
        </text>
        <text x="28" y="28" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          The chart can move without you
        </text>
      </>
    ),
    hypothesis: (
      <>
        <rect x="20" y="36" width="150" height="100" rx="12" fill="#1C2431" stroke={line} strokeWidth="2" strokeDasharray="5 4" />
        <text x="95" y="78" textAnchor="middle" fill={muted} fontSize="14" fontFamily="Inter, sans-serif">
          “Buy strong
        </text>
        <text x="95" y="98" textAnchor="middle" fill={muted} fontSize="14" fontFamily="Inter, sans-serif">
          stocks”
        </text>
        <rect x="190" y="36" width="150" height="100" rx="12" fill="#151B25" stroke={accent} strokeWidth="2" />
        <text x="206" y="62" fill={accent} fontSize="13" fontFamily="Inter, sans-serif">
          Entry rule
        </text>
        <text x="206" y="84" fill={down} fontSize="13" fontFamily="Inter, sans-serif">
          ▼ Stop
        </text>
        <text x="206" y="106" fill={up} fontSize="13" fontFamily="Inter, sans-serif">
          ▲ Target
        </text>
      </>
    ),
    hindsight: (
      <>
        <Candle x={28} y={80} h={24} up={false} />
        <Candle x={58} y={64} h={30} up />
        <Candle x={88} y={72} h={22} up={false} />
        <Candle x={118} y={48} h={36} up />
        <rect x="160" y="28" width="176" height="112" rx="10" fill="#151B25" stroke={mastery} strokeWidth="2" />
        <text x="248" y="78" textAnchor="middle" fill={mastery} fontSize="15" fontFamily="Inter, sans-serif">
          Not visible yet
        </text>
        <text x="248" y="102" textAnchor="middle" fill={muted} fontSize="13" fontFamily="Inter, sans-serif">
          at the time
        </text>
      </>
    ),
    steps: (
      <>
        {[
          ['1', 'Setup', accent],
          ['2', 'Stop', down],
          ['3', 'Size', mastery],
          ['4', 'Journal', text],
        ].map(([n, name, color], i) => (
          <g key={n} transform={`translate(${24 + i * 84} 48)`}>
            <circle cx="32" cy="28" r="26" fill="none" stroke={color} strokeWidth="3" />
            <text x="32" y="34" textAnchor="middle" fill={color} fontSize="18" fontFamily="Inter, sans-serif">
              {n}
            </text>
            <text x="32" y="78" textAnchor="middle" fill={text} fontSize="13" fontFamily="Inter, sans-serif">
              {name}
            </text>
          </g>
        ))}
      </>
    ),
  };

  return <Frame label={label} decorative={decorative}>{art[id]}</Frame>;
}
