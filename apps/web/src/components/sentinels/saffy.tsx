// Saffy — Safety Sentinel · ISO 45001 · #f59e0b

interface Props { size?: number; className?: string }

export function Saffy({ size = 48, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-label="Saffy – Safety Sentinel"
    >
      {/* Body / vest */}
      <rect x="22" y="52" width="56" height="34" rx="12" fill="#f59e0b" />
      {/* Vest straps */}
      <rect x="43" y="52" width="14" height="34" rx="0" fill="#fbbf24" opacity="0.5" />
      {/* Head */}
      <rect x="28" y="22" width="44" height="38" rx="14" fill="#fcd34d" />
      {/* Hard hat */}
      <path d="M 18 32 Q 50 10 82 32 L 82 38 Q 50 18 18 38 Z" fill="#f59e0b" />
      <rect x="14" y="36" width="72" height="8" rx="4" fill="#d97706" />
      {/* Eyes */}
      <circle cx="38" cy="38" r="7" fill="white" />
      <circle cx="62" cy="38" r="7" fill="white" />
      <circle cx="38" cy="38" r="3.5" fill="#92400e" />
      <circle cx="62" cy="38" r="3.5" fill="#92400e" />
      <circle cx="39.5" cy="36.5" r="1.5" fill="white" />
      <circle cx="63.5" cy="36.5" r="1.5" fill="white" />
      {/* Smile */}
      <path d="M 40 50 Q 50 58 60 50" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Safety icon on body */}
      <circle cx="50" cy="68" r="10" fill="white" opacity="0.9" />
      <path d="M 50 60 L 50 68 M 50 71 L 50 73" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
