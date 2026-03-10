'use client';

type SentinelId = 'qualy' | 'envi' | 'saffy' | 'doki' | 'audie' | 'nexus';
type ShieldSize = 'sm' | 'md' | 'lg';

interface SentinelShieldProps {
  sentinel: SentinelId;
  size?: ShieldSize;
  className?: string;
  glow?: boolean;
}

const SENTINEL_META: Record<SentinelId, { color: string; initial: string }> = {
  qualy: { color: '#3B82F6', initial: 'Q' },
  envi:  { color: '#22C55E', initial: 'E' },
  saffy: { color: '#F59E0B', initial: 'S' },
  doki:  { color: '#6366F1', initial: 'D' },
  audie: { color: '#F43F5E', initial: 'A' },
  nexus: { color: '#8B5CF6', initial: 'N' },
};

const SIZE_MAP: Record<ShieldSize, { px: number; font: number; stroke: number }> = {
  sm: { px: 24, font: 10, stroke: 1.5 },
  md: { px: 40, font: 16, stroke: 2 },
  lg: { px: 56, font: 22, stroke: 2 },
};

export function SentinelShield({ sentinel, size = 'md', className = '', glow = false }: SentinelShieldProps) {
  const { color, initial } = SENTINEL_META[sentinel];
  const { px, font, stroke } = SIZE_MAP[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 56 56"
      fill="none"
      className={`${glow ? `glow-${sentinel}` : ''} ${className}`}
      aria-label={`${sentinel} sentinel shield`}
    >
      {/* Shield path */}
      <path
        d="M28 4L8 14v14c0 12.4 8.5 24 20 28 11.5-4 20-15.6 20-28V14L28 4z"
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
      {/* Letter initial */}
      <text
        x="28"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={font}
        fontWeight="700"
        fontFamily="var(--font-heading, 'Syne', system-ui, sans-serif)"
      >
        {initial}
      </text>
    </svg>
  );
}
