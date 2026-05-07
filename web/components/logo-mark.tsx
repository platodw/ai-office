export function LogoMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <g transform="translate(32 32)">
        <rect x="-2.2" y="-22" width="4.4" height="44" rx="2.2" fill="#1f1a14" />
        <rect x="-2.2" y="-22" width="4.4" height="44" rx="2.2" fill="#1f1a14" transform="rotate(45)" />
        <rect x="-2.2" y="-22" width="4.4" height="44" rx="2.2" fill="#1f1a14" transform="rotate(90)" />
        <rect x="-2.2" y="-22" width="4.4" height="44" rx="2.2" fill="#1f1a14" transform="rotate(135)" />
        <circle r="6" fill="#8a6a2e" />
      </g>
    </svg>
  );
}
