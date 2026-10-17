/** Logotipo de LapiStock: un lápiz amarillo inclinado sobre fondo grafito. */
export function Logo({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="LapiStock">
      <rect width="64" height="64" rx="14" fill="#23262f" />
      <g transform="rotate(45 32 32)">
        <rect x="26" y="6" width="12" height="7" rx="2" fill="#f28b9b" />
        <rect x="26" y="12" width="12" height="5" fill="#c9cdd6" />
        <rect x="26" y="17" width="12" height="26" fill="#f5b700" />
        <rect x="30" y="17" width="4" height="26" fill="#ffcd3c" />
        <path d="M26 43 L38 43 L32 56 Z" fill="#e9c894" />
        <path d="M30.2 52.2 L33.8 52.2 L32 56 Z" fill="#23262f" />
      </g>
    </svg>
  );
}
