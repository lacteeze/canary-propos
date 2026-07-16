import type { ListingTermType } from '@/lib/landing/listing-term'

export type BrowseTermFilter = 'all' | 'long' | 'mid' | 'short'
export type BrowseSort = 'new' | 'lo' | 'hi' | 'soon'

export interface BrowseSearchParams {
  org?: string
  q?: string
  term?: string
  beds?: string
  price?: string
  pets?: string
  sort?: string
}

export interface BrowseFilters {
  q: string
  term: BrowseTermFilter
  beds: string
  price: string
  pets: boolean
  sort: BrowseSort
}

export interface BrowseListing {
  id: string
  href: string
  shortAddress: string
  city: string
  province: string
  rentN: number | null
  rentFormatted: string
  rentSuffix: 'incl' | 'POU'
  beds: number
  baths: number
  bathsLabel: string
  parking: string
  termType: ListingTermType | 'short'
  termLabel: string
  termDot: string
  moveIn: string
  petFriendly: boolean
  petLabel: string | null
  tags: string[]
  /** Cover / first photo URL (same as photos[0] when present). */
  photo: string | null
  /**
   * Signed photo URLs for the card. Initial browse payload only includes the
   * cover; remaining URLs load on first carousel advance (`photoCount` > 1).
   */
  photos: string[]
  /** Total listing photos available for the card carousel (may exceed `photos.length`). */
  photoCount: number
  createdAt: string
  availableFrom: string | null
}

export interface CityGroup {
  city: string
  listings: BrowseListing[]
}
