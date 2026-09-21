import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '../features/home/home-page'
import { useSearch } from '../features/search/search-context'

export const Route = createFileRoute('/')({
  component: HomeRoute,
})

function HomeRoute() {
  const { query, setQuery } = useSearch()
  return <HomePage query={query} onQueryChange={setQuery} />
}
