import { z } from 'zod'

/** Structured quick fields for AI listing descriptions (stored on properties.listing_brief). */
export const listingBriefSchema = z.object({
  pets: z.string().trim().max(200).optional().default(''),
  utilities: z.string().trim().max(300).optional().default(''),
  parking: z.string().trim().max(200).optional().default(''),
  laundry: z.string().trim().max(200).optional().default(''),
  furnished: z.string().trim().max(120).optional().default(''),
  neighborhood: z.string().trim().max(500).optional().default(''),
  features: z.string().trim().max(800).optional().default(''),
})

export type ListingBrief = z.infer<typeof listingBriefSchema>

export function parseListingBrief(raw: unknown): ListingBrief {
  const parsed = listingBriefSchema.safeParse(raw ?? {})
  if (parsed.success) return parsed.data
  return {
    pets: '',
    utilities: '',
    parking: '',
    laundry: '',
    furnished: '',
    neighborhood: '',
    features: '',
  }
}

export function listingBriefToPromptLines(brief: ListingBrief): string[] {
  const rows: [string, string][] = [
    ['Pets', brief.pets],
    ['Utilities', brief.utilities],
    ['Parking', brief.parking],
    ['Laundry', brief.laundry],
    ['Furnished', brief.furnished],
    ['Neighborhood', brief.neighborhood],
    ['Standout features', brief.features],
  ]
  return rows.filter(([, v]) => v.trim()).map(([k, v]) => `${k}: ${v.trim()}`)
}
