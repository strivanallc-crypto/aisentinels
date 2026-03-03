// Qualy — Quality Sentinel · ISO 9001 · #2563eb

interface Props { size?: number; className?: string }

export function Qualy({ size = 48, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-label="Qualy – Quality Sentinel"
    >
      {/* Body */}
      <rect x="22" y="48" width="56" height="36" rx="12" fill="#2563eb" />
      {/* Head */}
      <rect x="26" y="14" width="48" height="42" rx="16" fill="#3b82f6" />
      {/* Eyes */}
      <circle cx="38" cy="34" r="8" fill="white" />
      <circle cx="62" cy="34" r="8" fill="white" />
      <circle cx="38" cy="34" r="4" fill="#1d4ed8" />
      <circle cx="62" cy="34" r="4" fill="#1d4ed8" />
      <circle cx="39.5" cy="32.5" r="1.5" fill="white" />
      <circle cx="63.5" cy="32.5" r="1.5" fill="white" />
      {/* Smile */}
      <path d="M 40 46 Q 50 53 60 46" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Clipboard on body */}
      <rect x="35" y="56" width="30" height="20" rx="4" fill="white" opacity="0.9" />
      <rect x="42" y="52" width="16" height="6" rx="3" fill="#1d4ed8" />
      {/* Checklist lines */}
      <line x1="41" y1="63" x2="59" y2="63" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
      <line x1="41" y1="68" x2="55" y2="68" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
      <circle cx="38" cy="63" r="2" fill="#2563eb" />
      <circle cx="38" cy="68" r="2" fill="#2563eb" />
      {/* Antenna */}
      <line x1="50" y1="14" x2="50" y2="8" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="6" r="3" fill="#60a5fa" />
    </svg>
  );
}
