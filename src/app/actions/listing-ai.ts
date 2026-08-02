'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { gatewayGenerateText, isAiGatewayConfigured } from '@/lib/ai/gateway'
import { listingBriefToPromptLines, parseListingBrief } from '@/lib/listings/listing-brief'

export type ListingAiResult =
  | {
      success: true
      title: string
      description: string
      highlights: string[]
    }
  | { success: false; error: string }

async function getStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) return null
  const roles = (person.role as unknown as string[]) ?? []
  if (!roles.includes('manager') && !roles.includes('admin')) return null
  return { supabase, person }
}

const applySchema = z.object({
  listingId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(8000),
  highlights: z.array(z.string().trim().max(120)).max(12),
})

export async function generateListingDescription(input: {
  propertyId?: string
  listingId?: string
}): Promise<ListingAiResult> {
  const ctx = await getStaff()
  if (!ctx) return { success: false, error: 'Only managers can generate listing copy.' }

  if (!isAiGatewayConfigured() && !process.env.AI_GATEWAY_API_KEY) {
    return {
      success: false,
      error:
        'AI Gateway is not configured. Set AI_GATEWAY_API_KEY (or enable AI Gateway + OIDC on Vercel).',
    }
  }

  let propertyId = input.propertyId
  let listingId = input.listingId
  let existingTitle = ''
  let unitId: string | null = null

  if (listingId) {
    const { data: listing } = await ctx.supabase
      .from('listings')
      .select('id, listing_title, unit_id, units!unit_id(property_id)')
      .eq('id', listingId)
      .eq('org_id', ctx.person.org_id)
      .single()
    if (!listing) return { success: false, error: 'Listing not found.' }
    existingTitle = listing.listing_title || ''
    unitId = listing.unit_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propertyId = (listing.units as any)?.property_id ?? propertyId
  }

  if (!propertyId) return { success: false, error: 'Property or listing required.' }

  const { data: property } = await ctx.supabase
    .from('properties')
    .select('id, street_address, city, province, property_type, listing_brief')
    .eq('id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .single()
  if (!property) return { success: false, error: 'Property not found.' }

  const { data: units } = await ctx.supabase
    .from('units')
    .select('id, bedrooms, bathrooms, asking_rent, amenities, unit_number')
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .limit(5)

  const unit =
    (unitId ? units?.find((u) => u.id === unitId) : null) || units?.[0] || null

  const { data: media } = await ctx.supabase
    .from('property_media')
    .select('id')
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .eq('visibility', 'listing')

  const { data: kb } = await ctx.supabase
    .from('property_knowledge_base')
    .select('markdown')
    .eq('property_id', propertyId)
    .eq('org_id', ctx.person.org_id)
    .maybeSingle()

  const brief = parseListingBrief(property.listing_brief)
  const briefLines = listingBriefToPromptLines(brief)

  const prompt = [
    'Write a rental listing for a Canadian property manager public website.',
    'Return ONLY valid JSON with keys: title (string), description (string, 2-4 short paragraphs), highlights (string array, 3-6 items).',
    'Tone: warm, clear, professional. No emoji. No invented amenities.',
    '',
    `Address: ${property.street_address}, ${property.city}, ${property.province}`,
    `Property type: ${property.property_type}`,
    unit
      ? `Unit: ${unit.unit_number || 'main'} · ${unit.bedrooms ?? '?'} bed · ${unit.bathrooms ?? '?'} bath · asking $${unit.asking_rent ?? '?'}/mo`
      : '',
    unit?.amenities?.length ? `Amenities: ${(unit.amenities as string[]).join(', ')}` : '',
    `Listing photos on file: ${(media ?? []).length}`,
    existingTitle ? `Current title: ${existingTitle}` : '',
    briefLines.length ? `Quick fields:\n${briefLines.join('\n')}` : '',
    kb?.markdown?.trim()
      ? `Property knowledge (use facts only):\n${kb.markdown.trim().slice(0, 2500)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const { text } = await gatewayGenerateText({
      tag: 'listing-description',
      system:
        'You are a property listing copywriter for Canary Property Management. Output JSON only.',
      prompt,
      maxOutputTokens: 1600,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { success: false, error: 'AI returned unreadable output. Try again.' }

    const parsed = JSON.parse(jsonMatch[0]) as {
      title?: string
      description?: string
      highlights?: string[]
    }

    const title = String(parsed.title || existingTitle || property.street_address).trim()
    const description = String(parsed.description || '').trim()
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 8)
      : []

    if (!description) return { success: false, error: 'AI did not produce a description.' }

    return { success: true, title, description, highlights }
  } catch (err) {
    console.error('[generateListingDescription]', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'AI generation failed.',
    }
  }
}

export async function applyGeneratedListingCopy(input: z.infer<typeof applySchema>): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  const ctx = await getStaff()
  if (!ctx) return { success: false, error: 'Only managers can save listing copy.' }

  const parsed = applySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid listing copy.' }

  const { error } = await ctx.supabase
    .from('listings')
    .update({
      listing_title: parsed.data.title,
      listing_description: parsed.data.description,
      highlights: parsed.data.highlights,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.listingId)
    .eq('org_id', ctx.person.org_id)

  if (error) {
    console.error('[applyGeneratedListingCopy]', error)
    return { success: false, error: 'Failed to save listing.' }
  }

  revalidatePath('/app')
  revalidatePath('/listings')
  return { success: true }
}
