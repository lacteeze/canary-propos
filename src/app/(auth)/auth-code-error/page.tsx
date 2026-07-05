import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function AuthCodeErrorPage() {
  return (
    <Card className="w-full max-w-[400px] shadow-sm">
      <CardHeader className="pb-2 text-center">
        <div className="mx-auto mb-2 flex items-center gap-1.5">
          <span className="text-xl font-semibold" style={{ color: '#D97706' }}>
            Canary
          </span>
          <span className="text-xl font-semibold text-stone-700">PropOS</span>
        </div>
        <h1 className="text-[1.75rem] font-semibold leading-tight text-stone-900">
          Sign-in didn&apos;t complete
        </h1>
      </CardHeader>

      <CardContent className="space-y-4 text-center">
        <p className="text-stone-600">
          Something went wrong connecting to the sign-in provider. Try again or
          sign in with your email and password.
        </p>

        <Link
          href="/login"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#D97706' }}
        >
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  )
}
