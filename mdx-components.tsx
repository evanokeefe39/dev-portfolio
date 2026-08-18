import type { MDXComponents } from 'mdx/types'

/**
 * Provider import source for @next/mdx (resolved by the
 * `next-mdx-import-source-file` alias before @mdx-js/react). Defining it
 * locally keeps the MDX runtime out of the RSC bundle — @mdx-js/react calls
 * React.createContext at module scope, which does not exist in React 19's
 * RSC build and crashes static generation.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
  }
}
