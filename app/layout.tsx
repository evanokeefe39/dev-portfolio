import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'evano — dev portfolio',
  description: 'Data engineering worklog: token burn, PRs referenced, LOC deltas, and writing.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#04060c] font-sans text-white antialiased">{children}</body>
    </html>
  )
}
