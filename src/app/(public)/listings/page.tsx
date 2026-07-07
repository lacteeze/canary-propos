// src/app/(public)/listings/page.tsx
// The dedicated listings browse page is retired — all listings are shown on
// the landing page (/#homes). Permanently redirect to the landing page.
import { permanentRedirect } from 'next/navigation'

export default function ListingsPage() {
  permanentRedirect('/')
}
