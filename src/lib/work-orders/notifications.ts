// src/lib/work-orders/notifications.ts
// SERVER ONLY — never import in 'use client' files.
// Owner notification helpers for work order pending approval state.
// Also: vendor assignment notifications (SMS + email) — Plan 05-04.

import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { sendVendorJobSMS } from '@/lib/work-orders/sms'

// --- Email template (inline — no JSX needed for simple HTML) ---
function renderPendingApprovalEmail(opts: {
  propertyAddress: string
  workOrderTitle: string
  estimatedCost: number
  approveUrl: string
  declineUrl: string
}): React.ReactElement {
  const { propertyAddress, workOrderTitle, estimatedCost, approveUrl, declineUrl } = opts

  // Build a minimal React element tree compatible with @react-email/components render()
  return createElement(
    'html',
    null,
    createElement(
      'body',
      { style: { fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' } },
      createElement('h2', { style: { color: '#1a1a1a' } }, 'Maintenance Approval Required'),
      createElement(
        'p',
        null,
        'A maintenance work order for one of your properties requires your approval before work can begin.'
      ),
      createElement(
        'table',
        { style: { borderCollapse: 'collapse', width: '100%', marginBottom: '24px' } },
        createElement(
          'tbody',
          null,
          createElement(
            'tr',
            null,
            createElement('td', { style: { padding: '8px 0', fontWeight: 'bold', width: '160px' } }, 'Property:'),
            createElement('td', { style: { padding: '8px 0' } }, propertyAddress)
          ),
          createElement(
            'tr',
            null,
            createElement('td', { style: { padding: '8px 0', fontWeight: 'bold' } }, 'Work Order:'),
            createElement('td', { style: { padding: '8px 0' } }, workOrderTitle)
          ),
          createElement(
            'tr',
            null,
            createElement('td', { style: { padding: '8px 0', fontWeight: 'bold' } }, 'Estimated Cost:'),
            createElement('td', { style: { padding: '8px 0' } }, `$${estimatedCost.toFixed(2)}`)
          )
        )
      ),
      createElement(
        'p',
        { style: { marginBottom: '16px' } },
        'Please review and respond below:'
      ),
      createElement(
        'div',
        { style: { display: 'flex', gap: '12px' } },
        createElement(
          'a',
          {
            href: approveUrl,
            style: {
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              marginRight: '12px',
            },
          },
          'Approve Work Order'
        ),
        createElement(
          'a',
          {
            href: declineUrl,
            style: {
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
            },
          },
          'Decline Work Order'
        )
      ),
      createElement(
        'p',
        { style: { marginTop: '32px', fontSize: '12px', color: '#6b7280' } },
        'This approval request was sent by Canary PropOS. If you have questions, contact your property manager.'
      )
    )
  ) as React.ReactElement
}

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

  // Look up the work order title
  const { data: wo } = await adminSupabase
    .from('work_orders')
    .select('title')
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.canarypm.ca'
  const approveUrl = `${baseUrl}/owner/approve/${approveToken}`
  const declineUrl = `${baseUrl}/owner/decline/${declineToken}`

  const template = renderPendingApprovalEmail({
    propertyAddress,
    workOrderTitle,
    estimatedCost,
    approveUrl,
    declineUrl,
  })

  const result = await sendEmail({
    to: ownerEmail,
    subject: `Approval Required: ${workOrderTitle} — Est. $${estimatedCost.toFixed(2)}`,
    template,
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

// ---------------------------------------------------------------------------
// Vendor assignment notifications (Plan 05-04)
// ---------------------------------------------------------------------------

function renderVendorAssignmentEmail(opts: {
  propertyAddress: string
  workOrderTitle: string
  workOrderDescription: string
  noLoginLink: string
}): React.ReactElement {
  const { propertyAddress, workOrderTitle, workOrderDescription, noLoginLink } = opts

  return createElement(
    'html',
    null,
    createElement(
      'body',
      { style: { fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' } },
      createElement('h2', { style: { color: '#1a1a1a' } }, 'New Work Order — Canary Property Management'),
      createElement(
        'p',
        null,
        'You have been assigned a new maintenance work order. Please review the details below and update the status when work begins and when completed.'
      ),
      createElement(
        'table',
        { style: { borderCollapse: 'collapse', width: '100%', marginBottom: '24px' } },
        createElement(
          'tbody',
          null,
          createElement(
            'tr',
            null,
            createElement('td', { style: { padding: '8px 0', fontWeight: 'bold', width: '140px' } }, 'Property:'),
            createElement('td', { style: { padding: '8px 0' } }, propertyAddress)
          ),
          createElement(
            'tr',
            null,
            createElement('td', { style: { padding: '8px 0', fontWeight: 'bold' } }, 'Job Title:'),
            createElement('td', { style: { padding: '8px 0' } }, workOrderTitle)
          ),
          createElement(
            'tr',
            null,
            createElement('td', { style: { padding: '8px 0', fontWeight: 'bold', verticalAlign: 'top' } }, 'Description:'),
            createElement('td', { style: { padding: '8px 0', whiteSpace: 'pre-wrap' } }, workOrderDescription)
          )
        )
      ),
      createElement(
        'p',
        { style: { marginBottom: '16px' } },
        'Use the link below to view full job details and update your status:'
      ),
      createElement(
        'a',
        {
          href: noLoginLink,
          style: {
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#1d4ed8',
            color: '#ffffff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
          },
        },
        'View Job Details'
      ),
      createElement(
        'p',
        { style: { marginTop: '32px', fontSize: '12px', color: '#6b7280' } },
        'This notification was sent by Canary PropOS. If you have questions, contact Canary Property Management.'
      )
    )
  ) as React.ReactElement
}

/**
 * sendVendorAssignmentNotifications — fires SMS (if phone exists) + Resend email to vendor
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

  const template = renderVendorAssignmentEmail({
    propertyAddress,
    workOrderTitle,
    workOrderDescription,
    noLoginLink,
  })

  const result = await sendEmail({
    to: vendor.email,
    subject: `New Work Order: ${workOrderTitle} — ${propertyAddress}`,
    template,
  })

  if (!result.success) {
    console.error(
      `[sendVendorAssignmentNotifications] Failed to send email to vendor ${vendor.email}:`,
      result.error
    )
  }
}
