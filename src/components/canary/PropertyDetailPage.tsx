'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { archiveProperties, unarchiveProperties } from '@/app/actions/entity-updates'
import { listingHref, moneyCad, personHref, propertyHref, shortAddress, tenantNamesFromInfo } from '@/lib/canary/entity-href'
import type { CanaryDb, CanaryPerson } from '@/lib/canary/types'
import EntityDetailDrawer, { type DrawerState } from './EntityDetailDrawer'
import { EntityPageShell, useEntityBack, type EntityChrome } from './EntityPageShell'

export default function PropertyDetailPage({
  id,
  db,
  canEdit,
  priv,
  chrome,
}: {
  id: string
  db: CanaryDb
  canEdit: boolean
  priv: boolean
  chrome: EntityChrome
}) {
  const router = useRouter()
  const goBack = useEntityBack('/app?view=properties')
  const [, startTransition] = useTransition()
  const [overlay, setOverlay] = useState<DrawerState>(null)
  const peopleById = useMemo(
    () => new Map(db.people.map((p: CanaryPerson) => [p.id, p])),
    [db.people],
  )

  const property = db.properties.find((p) => p.id === id)
  const actions = useMemo(() => {
    if (!priv || !property) return []
    const items: { label: string; onClick: () => void }[] = []
    if (property.archivedAt) {
      items.push({
        label: 'Restore',
        onClick: () => {
          if (!window.confirm(`Restore ${shortAddress(property.address)}? It will reappear in active property views.`)) return
          startTransition(async () => {
            const res = await unarchiveProperties([property.id])
            if (!res.success) {
              window.alert(res.error)
              return
            }
            router.refresh()
          })
        },
      })
    } else {
      items.push({
        label: 'Archive',
        onClick: () => {
          if (!window.confirm(`Archive ${shortAddress(property.address)}? It will be hidden from all active views but can be restored later.`)) return
          startTransition(async () => {
            const res = await archiveProperties([property.id])
            if (!res.success) {
              window.alert(res.error)
              return
            }
            router.refresh()
          })
        },
      })
    }
    items.push({
      label: 'Timeline',
      onClick: () => router.push('/app?view=leases'),
    })
    return items
  }, [priv, property, router, startTransition])

  const onNavigate = (d: NonNullable<DrawerState>) => {
    if (d.kind === 'property') {
      router.push(propertyHref(d.id))
      return
    }
    if (d.kind === 'person') {
      router.push(personHref(d.id))
      return
    }
    setOverlay(d)
  }

  if (!property) {
    return (
      <EntityPageShell chrome={chrome} activeView="properties" pageTitle="Property">
        <div className="cy-entity-page-head">
          <button type="button" className="cy-property-modal-back-btn" onClick={goBack} aria-label="Back">
            ← Back
          </button>
          <div className="cy-entity-page-title-block">
            <div style={{ fontWeight: 700, fontSize: 17 }}>Property not found</div>
          </div>
        </div>
      </EntityPageShell>
    )
  }

  return (
    <EntityPageShell chrome={chrome} activeView="properties" pageTitle={shortAddress(property.address) || 'Property'}>
      <EntityDetailDrawer
        drawer={{ kind: 'property', id }}
        presentation="page"
        onClose={goBack}
        db={db}
        canEdit={canEdit}
        priv={priv}
        peopleById={peopleById}
        onNavigate={onNavigate}
        actions={actions}
        tenantNames={tenantNamesFromInfo}
        short={shortAddress}
        money={moneyCad}
        onOpenListing={(d) => router.push(listingHref(d.id))}
      />
      {overlay ? (
        <EntityDetailDrawer
          drawer={overlay}
          onClose={() => setOverlay(null)}
          db={db}
          canEdit={canEdit}
          priv={priv}
          peopleById={peopleById}
          onNavigate={onNavigate}
          tenantNames={tenantNamesFromInfo}
          short={shortAddress}
          money={moneyCad}
          onOpenListing={(d) => router.push(listingHref(d.id))}
        />
      ) : null}
    </EntityPageShell>
  )
}
