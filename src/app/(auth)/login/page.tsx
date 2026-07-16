import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginPageClient } from './LoginPageClient'

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/app')
  }

  return <LoginPageClient />
}
