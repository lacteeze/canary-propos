import { z } from 'zod'

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
}

function assertServerEnv(): void {
  // `next build` imports this module while compiling. Preview deploys often
  // have public keys but keep the service role on Production only.
  const schema =
    process.env.NEXT_PHASE === 'phase-production-build'
      ? publicEnvSchema
      : serverEnvSchema

  const result = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })

  if (!result.success) {
    throw new Error(
      `Missing or invalid server environment variables:\n${formatIssues(result.error)}\nSee .env.example.`,
    )
  }
}

assertServerEnv()
