'use server'
// src/app/actions/inquiries.ts
// Server actions for public inquiry and application interest form submissions.
// Uses anon Supabase client for INSERTs (public RLS allows) and admin client
// for manager email lookup (service role — server-only, T-03-15).

import { z } from 'zod'
import { createClient as createClientJs } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { sendEmail } from '@/lib/email/send'
import { PINGRAM_EMAIL_TYPES } from '@/lib/email/pingram-types'
import { InquiryNotificationEmail } from '@/lib/email/templates/InquiryNotificationEmail'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// --- Action result type ---
export type InquiryActionResult =
  | { success: true }
  | { success: false; error: string }

// --- Anon client for public INSERTs ---
function createAnonClient() {
  return createClientJs<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// --- Admin client for manager email lookup (server-only) ---
function createAdminClientInternal() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClientJs<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// --- Shared: lookup manager email for an org (uses service role) ---
async function lookupManagerEmail(orgId: string): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[inquiries] SUPABASE_SERVICE_ROLE_KEY unset — skipping manager email lookup')
    return null
  }
  try {
    const admin = createAdminClientInternal()
    const { data } = await admin
      .from('people')
      .select('email')
      .eq('org_id', orgId)
      .contains('role', ['manager'])
      .eq('active', true)
      .limit(1)
      .single()
    return data?.email ?? null
  } catch (err) {
    console.warn('[inquiries] manager email lookup failed:', err)
    return null
  }
}

// --- Shared: send manager notification email ---
async function sendManagerNotification(params: {
  orgId: string
  listingTitle: string
  propertyAddress: string
  visitorName: string
  visitorEmail: string
  visitorPhone?: string | null
  type: 'inquiry' | 'application' | 'interest'
  moveInDate?: string | null
  budget?: number | null
  note?: string | null
}) {
  const managerEmail = await lookupManagerEmail(params.orgId)
  if (!managerEmail) {
    console.warn('[inquiries] No manager email found — skipping notification for org', params.orgId)
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.canarypm.ca'
  const typeLabel =
    params.type === 'interest'
      ? 'general interest'
      : params.type === 'inquiry'
        ? 'viewing request'
        : 'application'

  const result = await sendEmail({
    type: PINGRAM_EMAIL_TYPES.inquiryNotification,
    to: managerEmail,
    subject: `New ${typeLabel}: ${params.listingTitle}`,
    from: 'Canary PM <notifications@canarypm.ca>',
    template: React.createElement(InquiryNotificationEmail, {
      visitorName: params.visitorName,
      visitorEmail: params.visitorEmail,
      visitorPhone: params.visitorPhone,
      listingTitle: params.listingTitle,
      propertyAddress: params.propertyAddress,
      type: params.type,
      moveInDate: params.moveInDate,
      budget: params.budget,
      note: params.note,
      dashboardUrl: `${appUrl}/app`,
    }),
  })
  if (!result.success) {
    console.warn('[inquiries] manager notification failed:', result.error)
  }
}

// --- Shared: validate org_id matches the listing (T-03-13 — cross-org injection prevention) ---
// Uses the anon client + published-only RLS — must NOT require SUPABASE_SERVICE_ROLE_KEY.
// Public showing/apply forms run without service role on some hosts; failing closed with
// "Invalid listing or organization" was masking a missing env var (production incident).
async function validateListingOrg(
  listingId: string,
  submittedOrgId: string
): Promise<{ valid: boolean; listingTitle: string; propertyAddress: string }> {
  try {
    const supabase = createAnonClient()

    // Step 1: Fetch published listing to validate org ownership (listings_select_anon)
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, org_id, listing_title, unit_id')
      .eq('id', listingId)
      .eq('status', 'published')
      .single()

    if (listingError || !listing || listing.org_id !== submittedOrgId) {
      return { valid: false, listingTitle: '', propertyAddress: '' }
    }

    // Step 2: Fetch property address via unit (anon read allowed for published listings)
    let propertyAddress = ''
    if (listing.unit_id) {
      const { data: unit } = await supabase
        .from('units')
        .select('property_id')
        .eq('id', listing.unit_id)
        .single()

      if (unit?.property_id) {
        const { data: property } = await supabase
          .from('properties')
          .select('street_address, city, province')
          .eq('id', unit.property_id)
          .single()

        if (property) {
          propertyAddress = `${property.street_address}, ${property.city}, ${property.province}`
        }
      }
    }

    return {
      valid: true,
      listingTitle: listing.listing_title,
      propertyAddress,
    }
  } catch (err) {
    console.warn('[inquiries] listing validation failed:', err)
    return { valid: false, listingTitle: '', propertyAddress: '' }
  }
}

// --- Zod schemas ---

const inquirySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().optional(),
  move_in_date: z.string().optional(),
  budget: z.coerce.number().optional(),
  note: z.string().optional(),
  listing_id: z.string().uuid('Invalid listing'),
  org_id: z.string().uuid('Invalid org'),
})

const applicationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(1, 'Phone is required for applications'),
  move_in_date: z.string().optional(),
  note: z.string().optional(),
  listing_id: z.string().uuid('Invalid listing'),
  org_id: z.string().uuid('Invalid org'),
})

const emptyToUndef = (v: unknown) => {
  if (v == null) return undefined
  if (typeof v === 'string' && v.trim() === '') return undefined
  return v
}

const generalInterestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  move_in_date: z.preprocess(emptyToUndef, z.string().optional()),
  budget: z.preprocess(emptyToUndef, z.coerce.number().optional()),
  beds: z.preprocess(emptyToUndef, z.string().optional()),
  pets: z.preprocess(emptyToUndef, z.string().optional()),
  garage: z.preprocess(emptyToUndef, z.string().optional()),
  preferred_area: z.preprocess(emptyToUndef, z.string().optional()),
  note: z.preprocess(emptyToUndef, z.string().optional()),
  listing_id: z.preprocess(emptyToUndef, z.string().uuid('Invalid listing').optional()),
  property_id: z.preprocess(emptyToUndef, z.string().uuid('Invalid property').optional()),
  property_label: z.preprocess(emptyToUndef, z.string().optional()),
  property_slug: z.preprocess(emptyToUndef, z.string().optional()),
  org_id: z.string().uuid('Invalid org'),
})

/** Resolve listing + property context for general-interest submits (service role for draft/unlisted). */
async function resolveInterestContext(params: {
  orgId: string
  listingId?: string
  propertyId?: string
  propertyLabel?: string
  propertySlug?: string
}): Promise<{
  valid: boolean
  listingId: string | null
  propertyId: string | null
  listingTitle: string
  propertyAddress: string
}> {
  const empty = {
    valid: false,
    listingId: null as string | null,
    propertyId: null as string | null,
    listingTitle: '',
    propertyAddress: '',
  }

  try {
    // Prefer admin so draft/unlisted listings on leased homes can still be linked.
    const client = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClientInternal()
      : createAnonClient()

    let listingId = params.listingId ?? null
    let propertyId = params.propertyId ?? null
    let listingTitle = ''
    let propertyAddress = params.propertyLabel?.trim() || ''

    if (listingId) {
      const { data: listing } = await client
        .from('listings')
        .select('id, org_id, listing_title, unit_id')
        .eq('id', listingId)
        .eq('org_id', params.orgId)
        .maybeSingle()

      if (!listing) return empty
      listingTitle = listing.listing_title

      if (listing.unit_id) {
        const { data: unit } = await client
          .from('units')
          .select('property_id')
          .eq('id', listing.unit_id)
          .maybeSingle()
        if (unit?.property_id) {
          propertyId = propertyId ?? unit.property_id
          const { data: property } = await client
            .from('properties')
            .select('street_address, city, province, slug')
            .eq('id', unit.property_id)
            .eq('org_id', params.orgId)
            .maybeSingle()
          if (property) {
            propertyAddress =
              `${property.street_address}, ${property.city}, ${property.province}`.trim()
          }
        }
      }

      return { valid: true, listingId, propertyId, listingTitle, propertyAddress }
    }

    if (propertyId) {
      const { data: property } = await client
        .from('properties')
        .select('id, street_address, city, province, slug')
        .eq('id', propertyId)
        .eq('org_id', params.orgId)
        .maybeSingle()

      if (!property) return empty

      propertyAddress =
        propertyAddress ||
        `${property.street_address}, ${property.city}, ${property.province}`.trim()
      listingTitle =
        property.street_address?.split(',')[0]?.trim() ||
        property.slug ||
        params.propertySlug ||
        'Property interest'

      const { data: units } = await client
        .from('units')
        .select('id')
        .eq('property_id', propertyId)
        .eq('org_id', params.orgId)

      const unitIds = (units ?? []).map((u) => u.id)
      if (unitIds.length) {
        const { data: listing } = await client
          .from('listings')
          .select('id, listing_title')
          .eq('org_id', params.orgId)
          .in('unit_id', unitIds)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (listing) {
          listingId = listing.id
          listingTitle = listing.listing_title || listingTitle
        }
      }

      return { valid: true, listingId, propertyId, listingTitle, propertyAddress }
    }

    return empty
  } catch (err) {
    console.warn('[inquiries] interest context resolution failed:', err)
    return empty
  }
}

function buildInterestNote(parts: {
  beds?: string
  pets?: string
  garage?: string
  preferredArea?: string
  propertyLabel?: string
  propertySlug?: string
  note?: string
}): string {
  const lines = ['[General interest]']
  if (parts.beds) lines.push(`Beds: ${parts.beds}+`)
  if (parts.pets) lines.push(`Pets: ${parts.pets}`)
  if (parts.garage) lines.push(`Garage/parking: ${parts.garage}`)
  if (parts.preferredArea) lines.push(`Preferred area: ${parts.preferredArea}`)
  if (parts.propertyLabel || parts.propertySlug) {
    const ctx = [parts.propertyLabel, parts.propertySlug ? `slug:${parts.propertySlug}` : null]
      .filter(Boolean)
      .join(' · ')
    lines.push(`Source property: ${ctx}`)
  }
  if (parts.note?.trim()) {
    lines.push('')
    lines.push(parts.note.trim())
  }
  return lines.join('\n')
}

// --- updateInquiryStatus (authenticated — manager only, T-03-17) ---

const PIPELINE_STATUSES = [
  'new',
  'contacted',
  'application_sent',
  'signed',
  'closed',
] as const

const updateStatusSchema = z.object({
  id: z.string().uuid('Invalid inquiry ID'),
  status: z.enum(PIPELINE_STATUSES),
})

export async function updateInquiryStatus(
  id: string,
  status: (typeof PIPELINE_STATUSES)[number]
): Promise<{ error?: string }> {
  const parsed = updateStatusSchema.safeParse({ id, status })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Resolve caller's org_id (T-03-17 — cross-org update prevention)
  const { data: person } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person?.org_id) return { error: 'Not authorized' }
  if (!person.role?.includes('manager') && !person.role?.includes('admin')) {
    return { error: 'Not authorized' }
  }

  const { error: updateError } = await supabase
    .from('inquiries')
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('org_id', person.org_id) // T-03-17: guard by org_id

  if (updateError) {
    console.error('[updateInquiryStatus] update error:', updateError)
    return { error: 'Failed to update status. Please try again.' }
  }

  revalidatePath('/app')
  revalidatePath('/inquiries')
  revalidatePath('/dashboard')
  return {}
}

export async function addInquiryNote(
  inquiryId: string,
  body: string
): Promise<{ error?: string; noteId?: string }> {
  const text = body.trim()
  if (!text) return { error: 'Note cannot be empty.' }
  if (text.length > 2000) return { error: 'Note is too long.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person?.org_id) return { error: 'Not authorized' }
  if (
    !person.role?.includes('manager') &&
    !person.role?.includes('admin') &&
    !person.role?.includes('employee')
  ) {
    return { error: 'Not authorized' }
  }

  const { data: inquiry } = await supabase
    .from('inquiries')
    .select('id')
    .eq('id', inquiryId)
    .eq('org_id', person.org_id)
    .maybeSingle()

  if (!inquiry) return { error: 'Inquiry not found.' }

  const { data: inserted, error } = await supabase
    .from('inquiry_notes')
    .insert({
      org_id: person.org_id,
      inquiry_id: inquiryId,
      author_id: person.id,
      body: text,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[addInquiryNote]', error)
    return { error: 'Failed to save note.' }
  }

  revalidatePath('/app')
  return { noteId: inserted?.id }
}

export async function listInquiryNotes(
  inquiryId: string
): Promise<Array<{ id: string; body: string; createdAt: string; authorName: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: person } = await supabase
    .from('people')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person?.org_id) return []

  const { data } = await supabase
    .from('inquiry_notes')
    .select('id, body, created_at, people!author_id(first_name, last_name)')
    .eq('org_id', person.org_id)
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data ?? []).map((n) => {
    const author = n.people
    return {
      id: n.id,
      body: n.body,
      createdAt: String(n.created_at),
      authorName: author
        ? [author.first_name, author.last_name].filter(Boolean).join(' ') || 'Staff'
        : 'Staff',
    }
  })
}

// --- submitInquiry ---
export async function submitInquiry(formData: FormData): Promise<InquiryActionResult> {
  const raw = Object.fromEntries(formData.entries())

  const parsed = inquirySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const { name, email, phone, move_in_date, budget, note, listing_id, org_id } = parsed.data

  // T-03-13: validate org_id against listing's actual org
  const { valid, listingTitle, propertyAddress } = await validateListingOrg(listing_id, org_id)
  if (!valid) {
    return { success: false, error: 'Invalid listing or organization.' }
  }

  // INSERT with anon client (public RLS policy allows INSERT)
  const supabase = createAnonClient()
  const { error: insertError } = await supabase.from('inquiries').insert({
    org_id,
    listing_id,
    type: 'inquiry',
    name,
    email,
    phone: phone || null,
    move_in_date: move_in_date || null,
    budget: budget ?? null,
    note: note || null,
    status: 'new',
  })

  if (insertError) {
    console.error('[submitInquiry] insert error:', insertError)
    return { success: false, error: 'Failed to submit your request. Please try again.' }
  }

  // Send manager notification (secondary — do not fail the action if email fails)
  try {
    await sendManagerNotification({
      orgId: org_id,
      listingTitle,
      propertyAddress,
      visitorName: name,
      visitorEmail: email,
      visitorPhone: phone,
      type: 'inquiry',
      moveInDate: move_in_date,
      budget,
      note,
    })
  } catch (err) {
    console.warn('[submitInquiry] email notification failed (non-fatal):', err)
  }

  return { success: true }
}

// --- submitApplication ---
export async function submitApplication(formData: FormData): Promise<InquiryActionResult> {
  const raw = Object.fromEntries(formData.entries())

  const parsed = applicationSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const { name, email, phone, move_in_date, note, listing_id, org_id } = parsed.data

  // T-03-13: validate org_id against listing's actual org
  const { valid, listingTitle, propertyAddress } = await validateListingOrg(listing_id, org_id)
  if (!valid) {
    return { success: false, error: 'Invalid listing or organization.' }
  }

  // INSERT with anon client
  const supabase = createAnonClient()
  const { error: insertError } = await supabase.from('inquiries').insert({
    org_id,
    listing_id,
    type: 'application',
    name,
    email,
    phone: phone || null,
    move_in_date: move_in_date || null,
    budget: null,
    note: note || null,
    status: 'new',
  })

  if (insertError) {
    console.error('[submitApplication] insert error:', insertError)
    return { success: false, error: 'Failed to submit your application. Please try again.' }
  }

  // Send manager notification (secondary)
  try {
    await sendManagerNotification({
      orgId: org_id,
      listingTitle,
      propertyAddress,
      visitorName: name,
      visitorEmail: email,
      visitorPhone: phone,
      type: 'application',
      moveInDate: move_in_date,
      note,
    })
  } catch (err) {
    console.warn('[submitApplication] email notification failed (non-fatal):', err)
  }

  return { success: true }
}

// --- submitGeneralInterest (“what I’m looking for” / get on our list) ---
export async function submitGeneralInterest(formData: FormData): Promise<InquiryActionResult> {
  const raw = Object.fromEntries(formData.entries())

  const parsed = generalInterestSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const {
    name,
    email,
    phone,
    move_in_date,
    budget,
    beds,
    pets,
    garage,
    preferred_area,
    note,
    listing_id,
    property_id,
    property_label,
    property_slug,
    org_id,
  } = parsed.data

  if (!listing_id && !property_id) {
    return { success: false, error: 'Missing listing or property context.' }
  }

  const ctx = await resolveInterestContext({
    orgId: org_id,
    listingId: listing_id,
    propertyId: property_id,
    propertyLabel: property_label,
    propertySlug: property_slug,
  })
  if (!ctx.valid) {
    return { success: false, error: 'Invalid listing or property.' }
  }

  const composedNote = buildInterestNote({
    beds,
    pets,
    garage,
    preferredArea: preferred_area,
    propertyLabel: property_label || ctx.propertyAddress || undefined,
    propertySlug: property_slug,
    note,
  })

  const supabase = createAnonClient()
  const { error: insertError } = await supabase.from('inquiries').insert({
    org_id,
    listing_id: ctx.listingId,
    property_id: ctx.propertyId,
    type: 'inquiry',
    name,
    email,
    phone: phone || null,
    move_in_date: move_in_date || null,
    budget: budget ?? null,
    note: composedNote,
    status: 'new',
  })

  if (insertError) {
    console.error('[submitGeneralInterest] insert error:', insertError)
    return { success: false, error: 'Failed to submit your interest. Please try again.' }
  }

  try {
    await sendManagerNotification({
      orgId: org_id,
      listingTitle: ctx.listingTitle || property_label || 'General interest',
      propertyAddress: ctx.propertyAddress || property_label || '',
      visitorName: name,
      visitorEmail: email,
      visitorPhone: phone,
      type: 'interest',
      moveInDate: move_in_date,
      budget,
      note: composedNote,
    })
  } catch (err) {
    console.warn('[submitGeneralInterest] email notification failed (non-fatal):', err)
  }

  return { success: true }
}
