import Link from 'next/link'

interface NavLink {
  href: string
  label: string
  external?: boolean
}

const LINKS: NavLink[] = [
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: 'https://github.com/evanokeefe39', label: 'GitHub', external: true },
]

/** Floating glass pill, top edge of the viewport. */
export default function Nav() {
  return (
    <nav className="glass absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-4 px-5 py-2.5">
      <span className="font-mono text-sm font-semibold tracking-tight text-white">evano</span>
      <span aria-hidden className="h-4 w-px bg-white/10" />
      <ul className="flex items-center gap-4">
        {LINKS.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              className="text-sm text-white/65 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
