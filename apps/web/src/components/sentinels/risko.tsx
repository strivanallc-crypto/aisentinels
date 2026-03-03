// Risko — Risk Sentinel · #7c3aed

interface Props { size?: number; className?: string }

export function Risko({ size = 48, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-label="Risko – Risk Sentinel"
    >
      {/* Shield body */}
      <path d="M 50 8 L 84 22 L 84 52 C 84 70 68 84 50 92 C 32 84 16 70 16 52 L 16 22 Z" fill="#7c3aed" />
      {/* Shield inner */}
      <path d="M 50 16 L 78 28 L 78 52 C 78 67 64 79 50 86 C 36 79 22 67 22 52 L 22 28 Z" fill="#8b5cf6" opacity="0.5" />
      {/* Eyes */}
      <circle cx="38" cy="42" r="8" fill="white" />
      <circle cx="62" cy="42" r="8" fill="white" />
      <circle cx="38" cy="42" r="4" fill="#5b21b6" />
      <circle cx="62" cy="42" r="4" fill="#5b21b6" />
      <circle cx="39.5" cy="40.5" r="1.5" fill="white" />
      <circle cx="63.5" cy="40.5" r="1.5" fill="white" />
      {/* Alert brow lines */}
      <line x1="33" y1="34" x2="43" y2="37" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="57" y1="37" x2="67" y2="34" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      {/* Mouth — concerned */}
      <path d="M 41 55 Q 50 51 59 55" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Exclamation on body */}
      <rect x="46" y="62" width="8" height="16" rx="4" fill="white" opacity="0.9" />
      <circle cx="50" cy="83" r="4" fill="white" opacity="0.9" />
    </svg>
  );
}
