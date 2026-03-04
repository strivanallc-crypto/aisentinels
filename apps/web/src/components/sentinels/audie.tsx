// Audie — Audit Sentinel · #F43F5E

interface Props { size?: number; className?: string }

export function Audie({ size = 48, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-label="Audie – Audit Sentinel"
    >
      {/* Clipboard body */}
      <rect x="20" y="18" width="60" height="70" rx="8" fill="#F43F5E" />
      {/* Clipboard clip */}
      <rect x="36" y="10" width="28" height="14" rx="4" fill="#E11D48" />
      <rect x="42" y="8" width="16" height="8" rx="3" fill="#FDA4AF" />
      {/* Face area */}
      <rect x="26" y="24" width="48" height="38" rx="8" fill="#FB7185" />
      {/* Eyes */}
      <circle cx="40" cy="40" r="7" fill="white" />
      <circle cx="60" cy="40" r="7" fill="white" />
      <circle cx="40" cy="40" r="3.5" fill="#881337" />
      <circle cx="60" cy="40" r="3.5" fill="#881337" />
      <circle cx="41.5" cy="38.5" r="1.5" fill="white" />
      <circle cx="61.5" cy="38.5" r="1.5" fill="white" />
      {/* Magnifying glass (audit symbol) */}
      <circle cx="62" cy="32" r="5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.7" />
      <line x1="65.5" y1="35.5" x2="69" y2="39" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      {/* Determined smile */}
      <path d="M 41 52 Q 50 58 59 52" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Checklist lines */}
      <rect x="28" y="70" width="4" height="4" rx="1" fill="#FECDD3" opacity="0.8" />
      <line x1="36" y1="72" x2="68" y2="72" stroke="#FECDD3" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <rect x="28" y="78" width="4" height="4" rx="1" fill="#FECDD3" opacity="0.8" />
      <line x1="36" y1="80" x2="58" y2="80" stroke="#FECDD3" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Checkmark in first box */}
      <path d="M 29 72 L 30.5 73.5 L 33 70.5" stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
