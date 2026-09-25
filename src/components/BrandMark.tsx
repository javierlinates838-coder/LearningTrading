/** Three rising candles on a path: the app mark. Decorative; always paired with the app name. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <rect width="32" height="32" rx="8" fill="#151B25" />
      <path d="M6 24 L13 18 L19 20 L26 9" stroke="#7CC0FF" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="14" x2="9" y2="24" stroke="#F3EFE7" strokeWidth="1.5" />
      <rect x="7" y="17" width="4" height="5" rx="1" fill="#0C1017" stroke="#F3EFE7" strokeWidth="1.5" />
      <line x1="16" y1="10" x2="16" y2="22" stroke="#F3EFE7" strokeWidth="1.5" />
      <rect x="14" y="13" width="4" height="6" rx="1" fill="#0C1017" stroke="#F3EFE7" strokeWidth="1.5" />
      <line x1="23" y1="5" x2="23" y2="17" stroke="#F0BF6E" strokeWidth="1.5" />
      <rect x="21" y="7" width="4" height="7" rx="1" fill="#F0BF6E" />
    </svg>
  );
}
