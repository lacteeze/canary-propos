import { requireEntity, loadCanaryEntityContext } from '@/lib/canary/load-entity-page'
import PersonDetailPage from '@/components/canary/PersonDetailPage'

export const dynamic = 'force-dynamic'

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await loadCanaryEntityContext()
  requireEntity(ctx.db.people.find((p) => p.id === id))

  return (
    <PersonDetailPage
      id={id}
      db={ctx.db}
      canEdit={ctx.canEdit}
      priv={ctx.priv}
    />
  )
}
