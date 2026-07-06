import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="auth-card">
      <p className="auth-kicker">Sign-in error</p>
      <h1 className="auth-title">Sign-in didn&apos;t complete</h1>
      <p className="auth-sub">
        Something went wrong connecting to the sign-in provider. Try again or
        sign in with your email and password.
      </p>

      <Link href="/login" className="auth-btn" style={{ textDecoration: 'none' }}>
        Back to sign in
      </Link>
    </div>
  )
}
