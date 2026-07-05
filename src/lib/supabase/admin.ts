// SERVER ONLY — never import in 'use client' files.
// This client uses the service_role key which bypasses ALL Row Level Security.
// Importing this in a client component would expose the key in the browser bundle.
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // NEVER prefix with NEXT_PUBLIC_
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
