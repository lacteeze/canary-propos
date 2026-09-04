import Link from 'next/link'
import { InterestForm } from '@/components/listings/InterestForm'
import { LandingListingCard, type ListingCardCopy } from '@/components/landing/LandingListingCard'
import { PublicHeader } from '@/components/public/PublicHeader'
import { listingGroupByPath } from '@/lib/listing-groups/registry'
import { interpolateLead } from '@/lib/listing-groups/stats'
import { formatCad, rentalsHref, type ListingGroupDef, type ListingGroupInventory } from '@/lib/listing-groups/types'
import './listing-group.css'

export function ListingGroupPage({
  group,
  inventory,
  orgId,
  orgSlug,
  cardCopy,
}: {
  group: ListingGroupDef
  inventory: ListingGroupInventory
  orgId: string
  orgSlug: string
  cardCopy: ListingCardCopy
}) {
  const lead = interpolateLead(group, inventory)

  return (
    <div className="cland2">
      <PublicHeader />
      <main className="clg">
        <nav aria-label="Breadcrumb">
          <ol className="clg-crumbs">
            <li>
              <Link href="/">Home</Link>
              <span aria-hidden="true"> / </span>
            </li>
            {group.crumbs.map((crumb, index) => {
              const last = index === group.crumbs.length - 1
              return (
                <li key={crumb.path || 'index'}>
                  <Link href={rentalsHref(crumb.path, orgSlug)} aria-current={last ? 'page' : undefined}>
                    {crumb.label}
                  </Link>
                  {!last ? <span aria-hidden="true"> / </span> : null}
                </li>
              )
            })}
          </ol>
        </nav>

        <p className="clg-eyebrow">Canary rentals</p>
        <h1 className="clg-title">{group.h1}</h1>
        <p className="clg-lead">{lead}</p>

        {inventory.listings.length > 0 ? (
          <>
            <div className="clg-table-wrap">
              <table className="clg-table">
                <thead>
                  <tr>
                    <th scope="col">Address</th>
                    <th scope="col">Beds</th>
                    <th scope="col">Rent</th>
                    <th scope="col">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.listings.map((listing) => (
                    <tr key={listing.id}>
                      <td>
                        <Link href={listing.href}>{listing.shortAddress}</Link>
                      </td>
                      <td>{listing.beds || '—'}</td>
                      <td>
                        {listing.rentN != null ? formatCad(listing.rentN) : listing.rentFormatted}
                      </td>
                      <td>{listing.moveIn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="clg-cards">
              {inventory.listings.map((listing, index) => (
                <LandingListingCard
                  key={listing.id}
                  listing={listing}
                  copy={cardCopy}
                  priority={index === 0}
                />
              ))}
            </div>
          </>
        ) : null}

        <section className="clg-copy">
          {group.body.map((paragraph) => (
            <p key={paragraph.slice(0, 48)}>{paragraph}</p>
          ))}
        </section>

        <section className="clg-faq">
          <h2>Common questions</h2>
          {group.faqs.map((faq) => (
            <details key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </section>

        {group.related.length > 0 ? (
          <section className="clg-related">
            <h2>Related searches</h2>
            <ul className="clg-related-list">
              {group.related.map((path) => {
                const related = listingGroupByPath(path)
                if (!related) return null
                return (
                  <li key={path || 'all'}>
                    <Link href={rentalsHref(path, orgSlug)}>{relatedLabel(related)}</Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        <section className="clg-waitlist" id="waitlist">
          <h2>Join the waitlist</h2>
          <p>
            Tell us the town, bedroom count, and must-haves. We email when a matching home
            publishes.
          </p>
          <InterestForm
            orgId={orgId}
            propertyLabel={`Rental waitlist: ${group.h1}`}
            hideHeading
          />
        </section>
      </main>
    </div>
  )
}

function relatedLabel(group: ListingGroupDef): string {
  if (group.kind === 'index') return 'All rentals'
  const last = group.crumbs[group.crumbs.length - 1]
  return last?.label ?? group.h1
}
