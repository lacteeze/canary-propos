'use server'
// src/app/actions/inquiries.ts
// Server actions for public inquiry and application interest form submissions.
// Uses anon Supabase client for INSERTs (public RLS allows) and admin client
// for manager email lookup (service role — server-only, T-03-15).

import { z } from 'zod'
import { createClient as createClientJs } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { sendEmail } from '@/lib/email/send'
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
  type: 'inquiry' | 'application'
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
  const typeLabel = params.type === 'inquiry' ? 'showing request' : 'application'

  await sendEmail({
    to: managerEmail,
    subject: `New ${typeLabel}: ${params.listingTitle}`,
    from: 'Canary PropOS <notifications@canarypm.ca>',
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
      dashboardUrl: `${appUrl}/dashboard`,
    }),
  })
}

// --- Shared: validate org_id matches the listing (T-03-13 — cross-org injection prevention) ---
async function validateListingOrg(
  listingId: string,
  submittedOrgId: string
): Promise<{ valid: boolean; listingTitle: string; propertyAddress: string }> {
  try {
    const admin = createAdminClientInternal()

    // Step 1: Fetch listing to validate org ownership
    const { data: listing } = await admin
      .from('listings')
      .select('id, org_id, listing_title, unit_id')
      .eq('id', listingId)
      .single()

    if (!listing || listing.org_id !== submittedOrgId) {
      return { valid: false, listingTitle: '', propertyAddress: '' }
    }

    // Step 2: Fetch property address via unit
    let propertyAddress = ''
    if (listing.unit_id) {
      const { data: unit } = await admin
        .from('units')
        .select('property_id')
        .eq('id', listing.unit_id)
        .single()

      if (unit?.property_id) {
        const { data: property } = await admin
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

// --- updateInquiryStatus (authenticated — manager only, T-03-17) ---

const updateStatusSchema = z.object({
  id: z.string().uuid('Invalid inquiry ID'),
  status: z.enum(['new', 'contacted', 'closed']),
})

export async function updateInquiryStatus(
  id: string,
  status: 'new' | 'contacted' | 'closed'
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
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .eq('org_id', person.org_id) // T-03-17: guard by org_id

  if (updateError) {
    console.error('[updateInquiryStatus] update error:', updateError)
    return { error: 'Failed to update status. Please try again.' }
  }

  revalidatePath('/inquiries')
  revalidatePath('/dashboard')
  return {}
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
