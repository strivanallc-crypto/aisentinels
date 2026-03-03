// Doki — Document Sentinel · #4f46e5

interface Props { size?: number; className?: string }

export function Doki({ size = 48, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-label="Doki – Document Sentinel"
    >
      {/* Book body */}
      <rect x="18" y="12" width="64" height="76" rx="8" fill="#4f46e5" />
      {/* Spine */}
      <rect x="18" y="12" width="12" height="76" rx="8" fill="#3730a3" />
      {/* Pages edge */}
      <rect x="74" y="14" width="4" height="72" rx="2" fill="#c7d2fe" opacity="0.6" />
      <rect x="70" y="14" width="4" height="72" rx="2" fill="#a5b4fc" opacity="0.5" />
      {/* Face area */}
      <rect x="32" y="18" width="44" height="44" rx="8" fill="#6366f1" />
      {/* Eyes */}
      <circle cx="42" cy="36" r="7" fill="white" />
      <circle cx="64" cy="36" r="7" fill="white" />
      <circle cx="42" cy="36" r="3.5" fill="#3730a3" />
      <circle cx="64" cy="36" r="3.5" fill="#3730a3" />
      <circle cx="43.5" cy="34.5" r="1.5" fill="white" />
      <circle cx="65.5" cy="34.5" r="1.5" fill="white" />
      {/* Glasses */}
      <rect x="34" y="29" width="16" height="14" rx="7" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6" />
      <rect x="53" y="29" width="18" height="14" rx="7" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6" />
      <line x1="50" y1="36" x2="53" y2="36" stroke="white" strokeWidth="1.5" opacity="0.6" />
      {/* Smile */}
      <path d="M 43 48 Q 53 56 63 48" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Lines on body (text lines) */}
      <line x1="32" y1="72" x2="74" y2="72" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1="32" y1="79" x2="62" y2="79" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Star accent */}
      <path d="M 72 24 L 74 20 L 76 24 L 80 24 L 77 27 L 78 31 L 74 29 L 70 31 L 71 27 L 68 24 Z" fill="#fbbf24" />
    </svg>
  );
}
