/**
 * Tiny inline SVG icons for the krab tooltip / focus panel — currentColor,
 * no dependencies. Default ~14px; pass a Tailwind size class (e.g.
 * `h-3 w-3`) via `className` to override.
 */

interface IconProps {
  className?: string
}

/** Rounded-square/box glyph for a repo. */
export function RepoIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M3.5 10.5h17" />
    </svg>
  )
}

/** Git-branch glyph: stem + two circles. */
export function BranchIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}
