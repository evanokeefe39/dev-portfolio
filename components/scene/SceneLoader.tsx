'use client'

import dynamic from 'next/dynamic'

// The warehouse is client-only (WebGL + local clock + /data fetch). `ssr: false`
// keeps it out of the static-export HTML so the local clock never hydrates
// against a build-time value. Must live in a client component: next/dynamic
// rejects `ssr: false` inside Server Components.
const Scene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => null,
})

export default function SceneLoader() {
  return <Scene />
}
