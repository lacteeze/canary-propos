'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { canSeePublicListingEdit } from '@/lib/listings/staff-public-edit'

export function StaffEditDetailsLink({
  href,
  orgId,
}: {
  href: string
  orgId?: string | null
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    function applyRole(role: unknown, userOrgId: unknown) {
      setVisible(
        canSeePublicListingEdit(
          role as string | string[] | null | undefined,
          typeof userOrgId === 'string' ? userOrgId : null,
          orgId,
        ),
      )
    }

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setVisible(false)
        return
      }
      let role = user.app_metadata?.role
      let userOrgId = user.app_metadata?.org_id
      if (!role) {
        const { data: person } = await supabase
          .from('people')
          .select('role, org_id')
          .eq('user_id', user.id)
          .eq('active', true)
          .maybeSingle()
        role = person?.role
        userOrgId = person?.org_id
      }
      applyRole(role, userOrgId)
    })()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      applyRole(session?.user?.app_metadata?.role, session?.user?.app_metadata?.org_id)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [orgId])

  if (!visible) return null

  return (
    <a href={href} className="cpub-staff-edit">
      Edit details
    </a>
  )
}
