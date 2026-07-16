'use server'

import { getListingCardPhotos } from '@/lib/landing/get-listing-card-photos'

/** Public: sign remaining listing card photos on first carousel advance. */
export async function fetchListingCardPhotos(listingId: string): Promise<string[]> {
  return getListingCardPhotos(listingId)
}
