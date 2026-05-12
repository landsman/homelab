import { createFileRoute } from '@tanstack/react-router'
import { StatusPage } from '../features/status-page/status-page'
import { useSearch } from '../features/search/search-context'

export const Route = createFileRoute('/status')({
  component: StatusRoute,
})

function StatusRoute() {
  const { query, setQuery } = useSearch()
  return <StatusPage query={query} onQueryChange={setQuery} />
}
