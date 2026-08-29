'use server'

import React from 'react'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCaller } from '@/lib/canary/load-db'
import { sendEmail } from '@/lib/email/send'
import { PINGRAM_EMAIL_TYPES } from '@/lib/email/pingram-types'
import { IntakeResumeEmail } from '@/lib/email/templates/IntakeResumeEmail'
import { IntakeConfirmationEmail } from '@/lib/email/templates/IntakeConfirmationEmail'
import { IntakeStaffNotifyEmail } from '@/lib/email/templates/IntakeStaffNotifyEmail'
import {
  formatPropertyAddress,
  mergeStepIntoPayload,
  parsePayload,
  payloadToJson,
  stepSchemaFor,
  type IntakePayload,
  type IntakeStatus,
  type IntakeSubmission,
} from '@/lib/intake/schema'
import { appBaseUrl, resolveOnboardOrg } from '@/lib/intake/resolve-org'
import type { Json } from '@/types/supabase'
import { redirect } from 'next/navigation'

export type IntakeActionResult<T = Record<string, never>> =
  | ({ success: true } & T)
  | { success: false; error: string }

const tokenSchema = z.string().uuid()

function admin() {
  return createAdminClient()
}

function isStaffRole(roles: string[]) {
  return roles.some((r) => ['manager', 'employee', 'admin'].includes(r))
}

async function resolveOrgId(orgSlug?: string | null) {
  return resolveOnboardOrg(orgSlug)
}

function asSubmission(row: {
  id: string
  org_id: string
  token: string
  contact_name: string | null
  contact_email: string | null
  property_address: string | null
  payload: Json
  current_step: number
  status: string
  submitted_at: string | null
  created_at: string
  updated_at: string
}): IntakeSubmission {
  return {
    ...row,
    payload: parsePayload(row.payload),
    status: row.status as IntakeStatus,
  }
}

async function getByToken(token: string) {
  const parsed = tokenSchema.safeParse(token)
  if (!parsed.success) return { error: 'Invalid link.' as const, row: null }
  const { data, error } = await admin()
    .from('intake_submissions')
    .select(
      'id, org_id, token, contact_name, contact_email, property_address, payload, current_step, status, submitted_at, created_at, updated_at',
    )
    .eq('token', parsed.data)
    .maybeSingle()
  if (error) {
    console.error('[intake] lookup failed', error)
    return { error: 'Could not load this form.' as const, row: null }
  }
  if (!data) return { error: 'This form link was not found.' as const, row: null }
  return { error: null, row: asSubmission(data) }
}

export async function createIntakeSubmission(
  orgSlug?: string | null,
): Promise<IntakeActionResult<{ token: string }>> {
  const org = await resolveOrgId(orgSlug)
  if (!org) return { success: false, error: 'We could not find this management company.' }

  const { data, error } = await admin()
    .from('intake_submissions')
    .insert({
      org_id: org.id,
      payload: payloadToJson({}),
    })
    .select('token')
    .single()

  if (error || !data) {
    console.error('[intake] create failed', error)
    return { success: false, error: 'Could not start the form. Please try again.' }
  }
  return { success: true, token: data.token }
}

export async function startIntakeFormAction(formData: FormData) {
  const orgSlug = String(formData.get('org') ?? '') || null
  const result = await createIntakeSubmission(orgSlug)
  if (!result.success) {
    redirect(`/onboard?error=${encodeURIComponent(result.error)}`)
  }
  redirect(`/onboard/${result.token}`)
}

export async function loadIntakeSubmission(
  token: string,
): Promise<IntakeActionResult<{ submission: IntakeSubmission }>> {
  const found = await getByToken(token)
  if (found.error || !found.row) {
    return { success: false, error: found.error ?? 'Not found.' }
  }
  return { success: true, submission: found.row }
}

export async function saveIntakeStep(input: {
  token: string
  step: number
  data: Record<string, unknown>
  currentStep: number
}): Promise<IntakeActionResult<{ submission: IntakeSubmission }>> {
  const found = await getByToken(input.token)
  if (found.error || !found.row) {
    return { success: false, error: found.error ?? 'Not found.' }
  }
  if (found.row.status !== 'draft') {
    return { success: false, error: 'This form has already been submitted and can no longer be changed.' }
  }

  const step = Number(input.step)
  const nextStep = Math.min(7, Math.max(1, Number(input.currentStep) || step))
  const parsed = step >= 1 && step <= 6 ? stepSchemaFor(step).safeParse(input.data) : { success: true as const, data: input.data }
  // Always persist what they typed — never drop a draft on validation failure.
  const stepData = (parsed.success ? parsed.data : input.data) as Record<string, unknown>
  const payload = mergeStepIntoPayload(found.row.payload, step, stepData)

  const contact = payload.contact
  const property = payload.property
  const contactName = contact?.full_name?.trim() || found.row.contact_name
  const contactEmail = contact?.email?.trim().toLowerCase() || found.row.contact_email
  const propertyAddress = formatPropertyAddress(property) || found.row.property_address

  const { data, error } = await admin()
    .from('intake_submissions')
    .update({
      payload: payloadToJson(payload),
      current_step: nextStep,
      contact_name: contactName ?? null,
      contact_email: contactEmail ?? null,
      property_address: propertyAddress ?? null,
    })
    .eq('token', found.row.token)
    .eq('status', 'draft')
    .select(
      'id, org_id, token, contact_name, contact_email, property_address, payload, current_step, status, submitted_at, created_at, updated_at',
    )
    .maybeSingle()

  if (error || !data) {
    console.error('[intake] save failed', error)
    return { success: false, error: 'Could not save this step. Please try again.' }
  }

  const saved = asSubmission(data)
  if (step === 1 && contactEmail && !found.row.payload.resume_email_sent) {
    await sendResumeEmail(saved)
  }

  return { success: true, submission: saved }
}

async function sendResumeEmail(row: IntakeSubmission) {
  const email = row.contact_email
  if (!email) return

  const { data: org } = await admin()
    .from('organizations')
    .select('name')
    .eq('id', row.org_id)
    .maybeSingle()

  const resumeUrl = `${appBaseUrl()}/onboard/${row.token}`
  const result = await sendEmail({
    type: PINGRAM_EMAIL_TYPES.intakeResume,
    to: email,
    subject: 'Continue your Canary intake form',
    from: 'Canary PM <notifications@canarypm.ca>',
    template: React.createElement(IntakeResumeEmail, {
      contactName: row.contact_name || 'there',
      resumeUrl,
      orgName: org?.name ?? 'Canary PM',
    }),
  })

  if (!result.success) {
    console.error('[intake] resume email failed', result.error)
    return
  }

  const payload: IntakePayload = { ...row.payload, resume_email_sent: true }
  await admin()
    .from('intake_submissions')
    .update({ payload: payloadToJson(payload) })
    .eq('token', row.token)
    .eq('status', 'draft')
}

export async function uploadIntakePhotos(formData: FormData): Promise<
  IntakeActionResult<{ paths: string[] }>
> {
  const token = String(formData.get('token') ?? '')
  const found = await getByToken(token)
  if (found.error || !found.row) {
    return { success: false, error: found.error ?? 'Not found.' }
  }
  if (found.row.status !== 'draft') {
    return { success: false, error: 'This form has already been submitted and can no longer be changed.' }
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) return { success: true, paths: found.row.payload.photos?.paths ?? [] }

  const existing = found.row.payload.photos?.paths ?? []
  const supabase = admin()
  const uploaded: string[] = []

  for (const file of files.slice(0, 12)) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > 20 * 1024 * 1024) continue
    const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'photo.jpg'
    const path = `${found.row.org_id}/intake/${found.row.token}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from('org-assets').upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
    if (error) {
      console.error('[intake] photo upload failed', error)
      continue
    }
    uploaded.push(path)
  }

  const paths = [...existing, ...uploaded]
  const payload = { ...found.row.payload, photos: { paths } }
  const { error } = await supabase
    .from('intake_submissions')
    .update({ payload: payloadToJson(payload) })
    .eq('token', found.row.token)
    .eq('status', 'draft')

  if (error) {
    console.error('[intake] photo payload save failed', error)
    return { success: false, error: 'Photos uploaded but we could not save them. Please try again.' }
  }

  return { success: true, paths }
}

export async function submitIntake(
  token: string,
): Promise<IntakeActionResult<{ submission: IntakeSubmission }>> {
  const found = await getByToken(token)
  if (found.error || !found.row) {
    return { success: false, error: found.error ?? 'Not found.' }
  }
  if (found.row.status !== 'draft') {
    return { success: false, error: 'This form has already been submitted.' }
  }

  const submittedAt = new Date().toISOString()
  const { data, error } = await admin()
    .from('intake_submissions')
    .update({
      status: 'submitted',
      submitted_at: submittedAt,
      current_step: 7,
    })
    .eq('token', found.row.token)
    .eq('status', 'draft')
    .select(
      'id, org_id, token, contact_name, contact_email, property_address, payload, current_step, status, submitted_at, created_at, updated_at',
    )
    .maybeSingle()

  if (error || !data) {
    console.error('[intake] submit failed', error)
    return { success: false, error: 'Could not submit. Please try again.' }
  }

  const saved = asSubmission(data)
  await sendSubmitEmails(saved)
  return { success: true, submission: saved }
}

async function sendSubmitEmails(row: IntakeSubmission) {
  const { data: org } = await admin()
    .from('organizations')
    .select('name')
    .eq('id', row.org_id)
    .maybeSingle()
  const orgName = org?.name ?? 'Canary PM'
  const phone = row.payload.contact?.phone ?? null

  if (row.contact_email) {
    const confirm = await sendEmail({
      type: PINGRAM_EMAIL_TYPES.intakeConfirmation,
      to: row.contact_email,
      subject: 'We received your property details',
      from: 'Canary PM <notifications@canarypm.ca>',
      template: React.createElement(IntakeConfirmationEmail, {
        contactName: row.contact_name || '',
        propertyAddress: row.property_address,
        orgName,
      }),
    })
    if (!confirm.success) console.error('[intake] confirmation email failed', confirm.error)
  }

  const staffTo = await staffNotifyRecipients(row.org_id)
  const detailUrl = `${appBaseUrl()}/app/onboard/${row.id}`
  await Promise.all(
    staffTo.map((to) =>
      sendEmail({
        type: PINGRAM_EMAIL_TYPES.intakeStaffNotify,
        to,
        subject: `New client intake: ${row.contact_name || row.contact_email || 'submission'}`,
        from: 'Canary PM <notifications@canarypm.ca>',
        template: React.createElement(IntakeStaffNotifyEmail, {
          contactName: row.contact_name || 'Unnamed',
          contactEmail: row.contact_email || '',
          contactPhone: phone,
          propertyAddress: row.property_address,
          detailUrl,
        }),
      }),
    ),
  )
}

async function staffNotifyRecipients(orgId: string): Promise<string[]> {
  const configured = process.env.LISTING_ALERT_NOTIFY_EMAIL?.trim()
  const recipients = new Set<string>()
  if (configured) recipients.add(configured.toLowerCase())
  recipients.add('info@canarypm.ca')

  try {
    const { data } = await admin()
      .from('people')
      .select('email')
      .eq('org_id', orgId)
      .contains('role', ['manager'])
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    if (data?.email) recipients.add(data.email.toLowerCase())
  } catch (err) {
    console.warn('[intake] manager email lookup failed', err)
  }

  return [...recipients]
}

export async function listIntakeSubmissionsForStaff(): Promise<
  IntakeActionResult<{ submissions: IntakeSubmission[] }>
> {
  const caller = await getCaller()
  if (caller === 'no-user') return { success: false, error: 'You must be signed in.' }
  if (caller === 'no-person') return { success: false, error: 'No workspace access.' }
  if (!isStaffRole(caller.roles)) return { success: false, error: 'Staff only.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('intake_submissions')
    .select(
      'id, org_id, token, contact_name, contact_email, property_address, payload, current_step, status, submitted_at, created_at, updated_at',
    )
    .eq('org_id', caller.orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[intake] staff list failed', error)
    return { success: false, error: 'Could not load submissions.' }
  }

  return { success: true, submissions: (data ?? []).map(asSubmission) }
}

export async function getIntakeSubmissionForStaff(
  id: string,
): Promise<IntakeActionResult<{ submission: IntakeSubmission; photoUrls: string[] }>> {
  const caller = await getCaller()
  if (caller === 'no-user') return { success: false, error: 'You must be signed in.' }
  if (caller === 'no-person') return { success: false, error: 'No workspace access.' }
  if (!isStaffRole(caller.roles)) return { success: false, error: 'Staff only.' }

  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { success: false, error: 'Not found.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('intake_submissions')
    .select(
      'id, org_id, token, contact_name, contact_email, property_address, payload, current_step, status, submitted_at, created_at, updated_at',
    )
    .eq('id', idParsed.data)
    .eq('org_id', caller.orgId)
    .maybeSingle()

  if (error || !data) {
    return { success: false, error: 'Submission not found.' }
  }

  const submission = asSubmission(data)
  const paths = submission.payload.photos?.paths ?? []
  const photoUrls: string[] = []
  if (paths.length > 0) {
    const signed = await admin().storage.from('org-assets').createSignedUrls(paths, 3600)
    for (const item of signed.data ?? []) {
      if (item.signedUrl) photoUrls.push(item.signedUrl)
    }
  }

  return { success: true, submission, photoUrls }
}
