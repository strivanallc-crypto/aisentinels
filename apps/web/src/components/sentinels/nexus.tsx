// Nexus — CAPA Sentinel · #8B5CF6

interface Props { size?: number; className?: string }

export function Nexus({ size = 48, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-label="Nexus – CAPA Sentinel"
    >
      {/* Gear body */}
      <circle cx="50" cy="50" r="35" fill="#8B5CF6" />
      {/* Gear teeth */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="46"
          y="12"
          width="8"
          height="10"
          rx="2"
          fill="#7C3AED"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      {/* Inner face circle */}
      <circle cx="50" cy="50" r="26" fill="#A78BFA" />
      {/* Eyes */}
      <circle cx="40" cy="46" r="6" fill="white" />
      <circle cx="60" cy="46" r="6" fill="white" />
      <circle cx="40" cy="46" r="3" fill="#4C1D95" />
      <circle cx="60" cy="46" r="3" fill="#4C1D95" />
      <circle cx="41.2" cy="44.8" r="1.3" fill="white" />
      <circle cx="61.2" cy="44.8" r="1.3" fill="white" />
      {/* Thinking brow */}
      <line x1="35" y1="38" x2="44" y2="36" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <line x1="56" y1="36" x2="65" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* Analytical smile */}
      <path d="M 42 56 Q 50 62 58 56" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Root cause symbol (question mark) */}
      <path d="M 48 66 Q 48 64 50 63 Q 53 61 53 59 Q 53 57 50 57 Q 48 57 47 58" stroke="#DDD6FE" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <circle cx="48" cy="69" r="1" fill="#DDD6FE" opacity="0.7" />
    </svg>
  );
}
