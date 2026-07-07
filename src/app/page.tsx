import type { Metadata } from 'next'
import { Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from 'next/font/google'
import { LandingPage } from '@/components/landing/landing-page'
import { getHospitableStays } from '@/lib/landing/get-hospitable-stays'
import { getPublishedListings } from '@/lib/landing/get-published-listings'
import { getLandingStats } from '@/lib/landing/get-landing-stats'

/** Listings and rates change in Supabase — always fetch fresh on each request. */
export const dynamic = 'force-dynamic'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
})

export const metadata: Metadata = {
  title: "Canary Property Management — Rentals & Stress-Free Property Management in St. John's, NL",
  description:
    "Canary Property Management leases and manages long-term rentals and Airbnbs in St. John's, Newfoundland. Browse verified homes for rent, or hand your rental property to a local team with month-to-month agreements, 24/7 tenant support, and transparent pricing.",
  openGraph: {
    title: "Canary Property Management — St. John's, NL",
    description:
      "Verified homes for rent and stress-free property management in St. John's, Newfoundland.",
    type: 'website',
  },
}

export default async function HomePage() {
  const orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary'
  const stays = await getHospitableStays()
  const [listings, stats] = await Promise.all([
    getPublishedListings(orgSlug),
    getLandingStats(orgSlug, stays.length),
  ])
  // The dedicated /listings browse page is retired — all homes live on the landing page.
  const listingsHref = '/#homes'
  const staysHref = orgSlug ? `/?org=${orgSlug}#stays` : '/#stays'

  return (
    <div className={`${instrumentSans.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable}`} style={{ fontFamily: 'var(--font-instrument-sans), system-ui, sans-serif' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'RealEstateAgent',
            name: 'Canary Property Management',
            description:
              "Local property management company in St. John's, Newfoundland offering leasing, long-term rental management, Airbnb management, and maintenance with 3D virtual tours.",
            email: 'info@canarypm.ca',
            telephone: '+1-709-200-9626',
            address: {
              '@type': 'PostalAddress',
              addressLocality: "St. John's",
              addressRegion: 'NL',
              addressCountry: 'CA',
            },
            areaServed: ["St. John's", 'Mount Pearl', 'Paradise', 'Conception Bay South', 'Portugal Cove', 'Torbay'],
            openingHours: 'Mo-Fr 09:00-17:00',
            priceRange: 'Management from 12% of monthly rent',
            sameAs: [
              'https://www.instagram.com/canarypropertymanagement/',
              'https://www.facebook.com/canarypropertymanagement',
            ],
          }),
        }}
      />
      <LandingPage
        listings={listings}
        stays={stays}
        listingsHref={listingsHref}
        totalHomes={stats.totalHomes}
        staysHref={staysHref}
      />
    </div>
  )
}
