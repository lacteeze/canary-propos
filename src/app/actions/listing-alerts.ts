'use server'
// Public landing-page "Notify me" / new-listing alert signup.
// Persists the email, then sends confirmation + company notification via Resend.
// Does not report success if email delivery fails (no silent fake success).

import React from 'react'
import { z } from 'zod'
import { createClient as createClientJs } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getOrgBySlug } from '@/lib/orgs'
import { sendEmail } from '@/lib/email/send'
import { ListingAlertConfirmEmail } from '@/lib/email/templates/ListingAlertConfirmEmail'
import { ListingAlertNotifyEmail } from '@/lib/email/templates/ListingAlertNotifyEmail'

export type ListingAlertActionResult =
  | { success: true }
  | { success: false; error: string }

const DEFAULT_COMPANY_NOTIFY = 'info@canarypm.ca'
const SOURCE = 'landing_footer'

const schema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
})

function createAnonClient() {
  return createClientJs<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

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

async function lookupManagerEmail(orgId: string): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[listing-alerts] SUPABASE_SERVICE_ROLE_KEY unset — skipping manager lookup')
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
      .maybeSingle()
    return data?.email ?? null
  } catch (err) {
    console.warn('[listing-alerts] manager email lookup failed:', err)
    return null
  }
}

function companyNotifyRecipients(managerEmail: string | null): string[] {
  const configured = process.env.LISTING_ALERT_NOTIFY_EMAIL?.trim()
  const primary = configured || DEFAULT_COMPANY_NOTIFY
  const recipients = new Set<string>([primary.toLowerCase()])
  if (managerEmail) {
    recipients.add(managerEmail.toLowerCase())
  }
  return [...recipients]
}

export async function subscribeListingAlerts(emailInput: string): Promise<ListingAlertActionResult> {
  const parsed = schema.safeParse({ email: emailInput })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid email' }
  }

  const email = parsed.data.email.toLowerCase()

  const orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary'
  const org = await getOrgBySlug(orgSlug)
  if (!org) {
    console.error('[listing-alerts] org not found for slug:', orgSlug)
    return { success: false, error: 'Something went wrong. Please try again or email info@canarypm.ca.' }
  }

  const supabase = createAnonClient()
  const { error: insertError } = await supabase.from('listing_alert_subscribers').upsert(
    {
      org_id: org.id,
      email,
      source: SOURCE,
    },
    { onConflict: 'org_id,email', ignoreDuplicates: true }
  )

  if (insertError) {
    console.error('[listing-alerts] insert error:', insertError)
    return {
      success: false,
      error: 'Could not save your email. Please try again or email info@canarypm.ca.',
    }
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[listing-alerts] RESEND_API_KEY is not set — signup saved, emails not sent')
    return {
      success: false,
      error:
        'We saved your email, but confirmation email is not configured yet. Please email info@canarypm.ca if you need confirmation.',
    }
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://canarypm.ca').replace(/\/$/, '')
  const listingsUrl = `${appUrl}/#homes`
  const signedUpAt = new Date().toLocaleString('en-CA', {
    timeZone: 'America/St_Johns',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const confirmResult = await sendEmail({
    to: email,
    subject: `You're on the list — new listings from ${org.name}`,
    from: 'Canary Property Management <notifications@canarypm.ca>',
    template: React.createElement(ListingAlertConfirmEmail, {
      orgName: org.name,
      subscriberEmail: email,
      listingsUrl,
    }),
  })

  if (!confirmResult.success) {
    console.error('[listing-alerts] confirmation email failed:', confirmResult.error)
    return {
      success: false,
      error: 'We saved your email, but could not send a confirmation. Please try again or email info@canarypm.ca.',
    }
  }

  const managerEmail = await lookupManagerEmail(org.id)
  const notifyTo = companyNotifyRecipients(managerEmail)
  const notifyResults = await Promise.all(
    notifyTo.map((to) =>
      sendEmail({
        to,
        subject: `New listing alert signup: ${email}`,
        from: 'Canary PropOS <notifications@canarypm.ca>',
        template: React.createElement(ListingAlertNotifyEmail, {
          subscriberEmail: email,
          orgName: org.name,
          source: SOURCE,
          signedUpAt,
        }),
      })
    )
  )

  const notifyFailed = notifyResults.filter((r) => !r.success)
  if (notifyFailed.length === notifyResults.length) {
    console.error('[listing-alerts] all company notifications failed:', notifyFailed)
    return {
      success: false,
      error: 'We saved your email, but our team notification failed. Please try again or email info@canarypm.ca.',
    }
  }
  if (notifyFailed.length > 0) {
    console.warn('[listing-alerts] some company notifications failed:', notifyFailed)
  }

  return { success: true }
}
