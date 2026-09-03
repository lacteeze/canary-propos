import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="auth-card">
      <p className="auth-kicker">Link expired</p>
      <h1 className="auth-title">This confirmation link is no longer valid</h1>
      <p className="auth-sub">
        Email confirmation links expire. Request a new sign-in or confirmation
        email, or sign in with your email and password if your account is already
        confirmed.
      </p>

      <Link href="/login" className="auth-btn" style={{ textDecoration: 'none' }}>
        Back to sign in
      </Link>
    </div>
  )
}
