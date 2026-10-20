export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#067d6f" />
      <path d="M16 44V30M26 44V24M36 44V32M46 44V18" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <circle cx="46" cy="18" r="4" fill="#52f4d4" />
    </svg>
  );
}
