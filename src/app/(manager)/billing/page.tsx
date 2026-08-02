import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BillingDashboard } from '@/components/billing/BillingDashboard'

export default async function BillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: callerPerson } = await supabase
    .from('people')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')
  const isManager =
    callerPerson.role.includes('manager') || callerPerson.role.includes('admin')
  if (!isManager) redirect('/login')

  const now = new Date()
  return (
    <BillingDashboard
      initialYear={now.getFullYear()}
      initialMonth={now.getMonth() + 1}
    />
  )
}
