import { requireEntity, loadCanaryEntityContext } from '@/lib/canary/load-entity-page'
import PropertyDetailPage from '@/components/canary/PropertyDetailPage'

export const dynamic = 'force-dynamic'

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await loadCanaryEntityContext()
  requireEntity(ctx.db.properties.find((p) => p.id === id))

  return (
    <PropertyDetailPage
      id={id}
      db={ctx.db}
      canEdit={ctx.canEdit}
      priv={ctx.priv}
      chrome={{
        role: ctx.role,
        priv: ctx.priv,
        userName: ctx.userName,
        userEmail: ctx.userEmail,
        userAvatarUrl: ctx.userAvatarUrl,
      }}
    />
  )
}
