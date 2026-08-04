// Team member invite email for managers / employees
import { Button, Heading, Text } from '@react-email/components'
import { emailStyles } from '@/lib/email/brand'
import { EmailLayout } from '@/lib/email/templates/EmailLayout'

export interface TeamInviteEmailProps {
  inviteeEmail: string
  orgName: string
  role: string // "manager" | "employee" | "vendor" | "owner"
  signUpUrl: string
}

export function TeamInviteEmail({
  inviteeEmail,
  orgName,
  role,
  signUpUrl,
}: TeamInviteEmailProps) {
  const roleLabel =
    role === 'manager'
      ? 'a manager'
      : role === 'employee'
        ? 'an employee'
        : role === 'vendor'
          ? 'a vendor'
          : role === 'owner'
            ? 'an owner'
            : `a ${role}`

  return (
    <EmailLayout
      preview={`You've been invited to join ${orgName} as ${roleLabel}`}
      subtitle="Team Invite"
      footerNote={`This invite was sent by ${orgName}. If you didn't expect this email, you can ignore it.`}
    >
      <Heading style={emailStyles.heading}>You&apos;ve been invited to join {orgName}</Heading>
      <Text style={emailStyles.bodyText}>
        You&apos;ve been invited to join {orgName} as {roleLabel}. Click the button below to create
        your account and access your workspace.
      </Text>
      <Text style={emailStyles.bodyText}>
        Your account will be set up with the email address: <strong>{inviteeEmail}</strong>
      </Text>

      <Button href={signUpUrl} style={emailStyles.cta}>
        Accept invite
      </Button>
    </EmailLayout>
  )
}

export default TeamInviteEmail
