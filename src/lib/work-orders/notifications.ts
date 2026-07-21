// src/lib/work-orders/notifications.ts
// SERVER ONLY — never import in 'use client' files.
// Owner notification helpers for work order pending approval state.
// Also: vendor assignment notifications (SMS + email) — Plan 05-04.

import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_EMAIL_FROM } from '@/lib/email/brand'
import { sendEmail } from '@/lib/email/send'
import { PINGRAM_EMAIL_TYPES } from '@/lib/email/pingram-types'
import { OwnerApprovalEmail } from '@/lib/email/templates/OwnerApprovalEmail'
import { VendorAssignmentEmail } from '@/lib/email/templates/VendorAssignmentEmail'
import { sendVendorJobSMS } from '@/lib/work-orders/sms'

/**
 * notifyOwnerPendingApproval — sends an email notification to the property owner
 * when a work order enters 'pending_approval' status.
 *
 * Uses createAdminClient() because this runs server-side without the owner's session.
 * The in-app notification record creation is deferred to a future plan (Phase 5 v2).
 *
 * @param workOrderId - UUID of the work order
 * @param orgId - organization ID (for scoping)
 * @param propertyId - UUID of the property (to look up owner email)
 * @param estimatedCost - estimated cost in dollars
 * @param approveToken - UUID token for the approve action
 * @param declineToken - UUID token for the decline action
 */
export async function notifyOwnerPendingApproval(
  workOrderId: string,
  orgId: string,
  propertyId: string,
  estimatedCost: number,
  approveToken: string,
  declineToken: string
): Promise<void> {
  const adminSupabase = createAdminClient()

  // Look up the work order title + description
  const { data: wo } = await adminSupabase
    .from('work_orders')
    .select('title, description')
    .eq('id', workOrderId)
    .eq('org_id', orgId)
    .single()

  // Look up property address + owner email in a single query via owner_id FK → people
  const { data: property } = await adminSupabase
    .from('properties')
    .select('street_address, city, province, owner:people!owner_id(email, first_name)')
    .eq('id', propertyId)
    .eq('org_id', orgId)
    .single()

  // If we can't find an owner email, log and skip — don't crash the work order flow
  const owner = property?.owner as { email?: string; first_name?: string } | null
  const ownerEmail = owner?.email
  if (!ownerEmail) {
    console.warn(
      `[notifyOwnerPendingApproval] No owner email found for property ${propertyId} — skipping notification`
    )
    return
  }

  const propertyAddress = property
    ? `${property.street_address}, ${property.city}, ${property.province}`
    : `Property ${propertyId}`

  const workOrderTitle = wo?.title ?? 'Maintenance Work Order'
  const workOrderDescription = wo?.description?.trim() || 'No description provided.'

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.canarypm.ca'
  const approveUrl = `${baseUrl}/owner/approve/${approveToken}`
  const declineUrl = `${baseUrl}/owner/decline/${declineToken}`

  const result = await sendEmail({
    type: PINGRAM_EMAIL_TYPES.workOrderOwnerApproval,
    to: ownerEmail,
    subject: `Approval Required: ${workOrderTitle} — Est. $${estimatedCost.toFixed(2)}`,
    from: DEFAULT_EMAIL_FROM,
    template: createElement(OwnerApprovalEmail, {
      propertyAddress,
      workOrderTitle,
      workOrderDescription,
      estimatedCost,
      approveUrl,
      declineUrl,
    }),
  })

  if (!result.success) {
    // Log but don't throw — email failure should not block the work order status update
    console.error(
      `[notifyOwnerPendingApproval] Failed to send email to ${ownerEmail}:`,
      result.error
    )
  }

  // In-app notification record: deferred to Phase 5 v2 (notifications table not yet created)
  // When implemented, insert into notifications table with type='work_order_pending_approval',
  // target_user_id = owner's user_id, and a link back to /owner/approve/[token]
}

/**
 * sendVendorAssignmentNotifications — fires SMS (if phone exists) + Pingram email to vendor
 * when a work order is assigned (status → 'assigned').
 *
 * Both notifications are fire-and-forget: failures are logged but never thrown.
 * T-05-12, T-05-15: admin client used only for lookup; PINGRAM_API_KEY server-only.
 *
 * @param workOrderId - UUID of the work order
 * @param orgId - organization ID (for scoping)
 * @param vendorId - UUID of the assigned vendor (people.id)
 * @param propertyId - UUID of the property
 * @param workOrderTitle - title of the work order
 * @param workOrderDescription - description of the work order
 * @param vendorToken - vendor_token UUID (the no-login link credential)
 */
export async function sendVendorAssignmentNotifications(
  workOrderId: string,
  orgId: string,
  vendorId: string,
  propertyId: string,
  workOrderTitle: string,
  workOrderDescription: string,
  vendorToken: string
): Promise<void> {
  const adminSupabase = createAdminClient()

  // Look up vendor contact info
  const { data: vendor } = await adminSupabase
    .from('people')
    .select('first_name, last_name, email, phone')
    .eq('id', vendorId)
    .single()

  if (!vendor) {
    console.warn(`[sendVendorAssignmentNotifications] Vendor ${vendorId} not found — skipping notifications`)
    return
  }

  // Look up property address
  const { data: property } = await adminSupabase
    .from('properties')
    .select('street_address, city, province')
    .eq('id', propertyId)
    .eq('org_id', orgId)
    .single()

  const propertyAddress = property
    ? `${property.street_address}, ${property.city}, ${property.province}`
    : `Property ${propertyId}`

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.canarypm.ca'
  const noLoginLink = `${baseUrl}/vendor/jobs/${vendorToken}`

  // 1. SMS — non-blocking fire-and-forget (vendor may not have a phone number)
  if (vendor.phone) {
    sendVendorJobSMS({
      vendorPhone: vendor.phone,
      propertyAddress,
      jobDescription: workOrderTitle,
      noLoginLink,
    }).catch((err) => {
      console.error(`[sendVendorAssignmentNotifications] SMS fire-and-forget error:`, err)
    })
  }

  // 2. Email — always attempt; non-blocking
  if (!vendor.email) {
    console.warn(
      `[sendVendorAssignmentNotifications] No email for vendor ${vendorId} (${vendor.first_name} ${vendor.last_name}) — skipping email`
    )
    return
  }

  const result = await sendEmail({
    type: PINGRAM_EMAIL_TYPES.workOrderVendorAssignment,
    to: vendor.email,
    subject: `New Work Order: ${workOrderTitle} — ${propertyAddress}`,
    from: DEFAULT_EMAIL_FROM,
    template: createElement(VendorAssignmentEmail, {
      propertyAddress,
      workOrderTitle,
      workOrderDescription,
      noLoginLink,
    }),
  })

  if (!result.success) {
    console.error(
      `[sendVendorAssignmentNotifications] Failed to send email to vendor ${vendor.email}:`,
      result.error
    )
  }
}
