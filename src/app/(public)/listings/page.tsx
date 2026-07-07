// src/app/(public)/listings/page.tsx
// Retired — all listings live on the landing page (/#homes).
import { permanentRedirect } from 'next/navigation'

export default function ListingsBrowsePage() {
  permanentRedirect('/')
}
