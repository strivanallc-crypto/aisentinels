// Envi — Environmental Sentinel · ISO 14001 · #16a34a

interface Props { size?: number; className?: string }

export function Envi({ size = 48, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-label="Envi – Environmental Sentinel"
    >
      {/* Leaf-shaped body */}
      <path d="M 50 85 C 22 85 16 60 16 45 C 16 28 32 14 50 14 C 68 14 84 28 84 45 C 84 60 78 85 50 85 Z" fill="#16a34a" />
      {/* Inner leaf highlight */}
      <path d="M 50 78 C 28 78 22 57 22 45 C 22 31 35 20 50 20 C 65 20 78 31 78 45 C 78 57 72 78 50 78 Z" fill="#22c55e" opacity="0.4" />
      {/* Leaf vein */}
      <line x1="50" y1="78" x2="50" y2="20" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="50" y1="50" x2="36" y2="38" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <line x1="50" y1="55" x2="64" y2="43" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <line x1="50" y1="62" x2="38" y2="53" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      {/* Eyes */}
      <circle cx="40" cy="42" r="7" fill="white" />
      <circle cx="60" cy="42" r="7" fill="white" />
      <circle cx="40" cy="42" r="3.5" fill="#15803d" />
      <circle cx="60" cy="42" r="3.5" fill="#15803d" />
      <circle cx="41.5" cy="40.5" r="1.5" fill="white" />
      <circle cx="61.5" cy="40.5" r="1.5" fill="white" />
      {/* Smile */}
      <path d="M 41 54 Q 50 62 59 54" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Stem */}
      <path d="M 50 85 Q 45 92 38 94" stroke="#15803d" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
