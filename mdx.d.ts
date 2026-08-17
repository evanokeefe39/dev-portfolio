declare module '*.mdx' {
  import type { ComponentType } from 'react'

  const MDXComponent: ComponentType<Record<string, unknown>>
  export default MDXComponent

  // Exported by remark-mdx-frontmatter from the frontmatter block
  export const frontmatter: { title: string; date: string }
}
