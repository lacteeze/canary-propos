import { requireEntity, loadCanaryEntityContext } from '@/lib/canary/load-entity-page'
import ListingDetailPage from '@/components/canary/ListingDetailPage'

export const dynamic = 'force-dynamic'

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await loadCanaryEntityContext()
  requireEntity(ctx.db.drafts.find((d) => d.id === id))

  return (
    <ListingDetailPage
      id={id}
      db={ctx.db}
      canEdit={ctx.canEdit}
    />
  )
}
