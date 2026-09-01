/**
 * Pingram notification `type` strings used by PropOS.
 * Each type must be created / allowed in the Pingram dashboard (region ca).
 */
export const PINGRAM_EMAIL_TYPES = {
  listingAlertConfirm: 'listing_alert_confirm',
  listingAlertNotify: 'listing_alert_notify',
  inquiryNotification: 'inquiry_notification',
  /** Manual staff send: matching published homes → inquirer. */
  matchingHomes: 'matching_homes_offer',
  tenantInvite: 'tenant_invite',
  teamInvite: 'team_invite',
  workOrderOwnerApproval: 'work_order_owner_approval',
  workOrderVendorAssignment: 'work_order_vendor_assignment',
  intakeResume: 'intake_resume',
  intakeConfirmation: 'intake_confirmation',
  intakeStaffNotify: 'intake_staff_notify',
} as const

export type PingramEmailType =
  (typeof PINGRAM_EMAIL_TYPES)[keyof typeof PINGRAM_EMAIL_TYPES]
