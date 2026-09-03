import { z } from 'zod'

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
}

function isBuildProcess(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.npm_lifecycle_event === 'build' ||
    // Vercel and GitHub Actions set CI during `next build`, including the
    // collect-page-data workers where NEXT_PHASE is already unset.
    process.env.CI === '1' ||
    process.env.CI === 'true'
  )
}

function assertServerEnv(): void {
  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })

  if (result.success) return

  const message = `Missing or invalid server environment variables:\n${formatIssues(result.error)}\nSee .env.example.`

  if (isBuildProcess()) {
    console.warn(message)
    return
  }

  throw new Error(message)
}

assertServerEnv()
