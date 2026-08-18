import Nav from '@/components/Nav'
import StatCard from '@/components/StatCard'
import BlogCarousel from '@/components/BlogCarousel'
import RepoCarousel from '@/components/RepoCarousel'
import SceneLoader from '@/components/scene/SceneLoader'
import { getPosts } from '@/lib/posts'

export default async function HomePage() {
  const posts = await getPosts()
  return (
    <main className="page-backdrop relative min-h-screen overflow-hidden">
      <SceneLoader />
      <Nav />
      <StatCard />
      <RepoCarousel />
      <BlogCarousel posts={posts} />
    </main>
  )
}
