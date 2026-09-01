'use client'

import { useMemo, useState, useTransition } from 'react'
import { useAppRouter } from './useAppRouter'
import { toast } from 'sonner'
import { invitePersonToPortal } from '@/app/(manager)/people/actions'
import { listingHref, moneyCad, personHref, propertyHref, shortAddress, tenantNamesFromInfo } from '@/lib/canary/entity-href'
import type { CanaryDb, CanaryPerson } from '@/lib/canary/types'
import EntityDetailDrawer, { type DrawerState } from './EntityDetailDrawer'
import { EntityPageShell, useEntityBack, type EntityChrome } from './EntityPageShell'

export default function PersonDetailPage({
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
  const router = useAppRouter()
  const goBack = useEntityBack('/app?view=people')
  const [, startTransition] = useTransition()
  const [overlay, setOverlay] = useState<DrawerState>(null)
  const peopleById = useMemo(
    () => new Map(db.people.map((p: CanaryPerson) => [p.id, p])),
    [db.people],
  )
  const person = db.people.find((p) => p.id === id)

  const actions = useMemo(() => {
    if (!priv || !person) return []
    const portalRoles = ['Vendor', 'Tenant', 'Client', 'Admin']
    if (!person.email || !portalRoles.includes(person.role)) return []
    return [{
      label: 'Invite to portal',
      onClick: () => {
        if (!window.confirm(`Send a portal invite to ${person.email}?`)) return
        startTransition(async () => {
          const res = await invitePersonToPortal(person.id)
          if (!res.success) {
            toast.error(res.error)
            return
          }
          toast.success(`Invite sent to ${person.email}`)
        })
      },
    }]
  }, [priv, person, startTransition])

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

  if (!person) {
    return (
      <EntityPageShell chrome={chrome} activeView="people" pageTitle="People">
        <div className="cy-entity-page-head">
          <button type="button" className="cy-property-modal-back-btn" onClick={goBack} aria-label="Back">
            ← Back
          </button>
          <div className="cy-entity-page-title-block">
            <div style={{ fontWeight: 700, fontSize: 17 }}>Person not found</div>
          </div>
        </div>
      </EntityPageShell>
    )
  }

  return (
    <EntityPageShell chrome={chrome} activeView="people" pageTitle={person.name || 'People'}>
      <EntityDetailDrawer
        drawer={{ kind: 'person', id }}
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
