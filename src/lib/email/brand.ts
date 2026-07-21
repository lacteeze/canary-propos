/**
 * Shared email brand tokens — aligned with the public landing page (light theme).
 * Inline styles only; email clients do not support CSS variables reliably.
 */

export const DEFAULT_EMAIL_FROM = 'Canary PM <notifications@canarypm.ca>'

export const EMAIL_CONTACT = {
  email: 'info@canarypm.ca',
  phoneDisplay: '(709) 200-9626',
  phoneTel: '+17092009626',
} as const

/** Landing light palette (from landing-styles.css .cland2) */
export const emailColors = {
  bg: '#f6f1e7',
  panel: '#fdfbf6',
  elev: '#ffffff',
  border: '#e6dcc9',
  border2: '#d5c8ad',
  text: '#2b251d',
  dim: '#7d7263',
  faint: '#a4988a',
  accent: '#4d6b46',
  accentHi: '#415a3b',
  accentText: '#f2f6f0',
  yellow: '#f0c445',
  ink: '#211c15',
  inkText: '#f4efe6',
  inkDim: '#a89a84',
  danger: '#b42318',
  success: '#4d6b46',
} as const

export const emailFonts = {
  display: "Optima, 'Segoe UI', Candara, 'Trebuchet MS', sans-serif",
  body: "Georgia, 'Times New Roman', 'Segoe UI', system-ui, sans-serif",
  sans: "'Segoe UI', Candara, 'Trebuchet MS', system-ui, sans-serif",
} as const

export const emailStyles = {
  body: {
    backgroundColor: emailColors.bg,
    fontFamily: emailFonts.sans,
    margin: '0',
    padding: '24px 12px',
  },
  container: {
    backgroundColor: emailColors.elev,
    border: `1px solid ${emailColors.border}`,
    borderRadius: '12px',
    margin: '0 auto',
    maxWidth: '560px',
    overflow: 'hidden' as const,
    padding: '0',
  },
  header: {
    backgroundColor: emailColors.ink,
    padding: '28px 32px 24px',
  },
  wordmark: {
    color: emailColors.inkText,
    fontFamily: emailFonts.display,
    fontSize: '26px',
    fontWeight: '500' as const,
    letterSpacing: '0.02em',
    margin: '0 0 4px 0',
  },
  tagline: {
    color: emailColors.inkDim,
    fontFamily: emailFonts.sans,
    fontSize: '12px',
    fontWeight: '500' as const,
    letterSpacing: '0.04em',
    margin: '0',
    textTransform: 'uppercase' as const,
  },
  accentBar: {
    backgroundColor: emailColors.yellow,
    height: '3px',
    margin: '0',
    width: '100%',
  },
  content: {
    padding: '32px',
  },
  heading: {
    color: emailColors.text,
    fontFamily: emailFonts.display,
    fontSize: '22px',
    fontWeight: '500' as const,
    lineHeight: '1.3',
    margin: '0 0 16px 0',
  },
  bodyText: {
    color: emailColors.text,
    fontFamily: emailFonts.sans,
    fontSize: '15px',
    lineHeight: '1.65',
    margin: '0 0 14px 0',
  },
  label: {
    color: emailColors.dim,
    fontFamily: emailFonts.sans,
    fontSize: '11px',
    fontWeight: '700' as const,
    letterSpacing: '0.08em',
    margin: '18px 0 6px 0',
    textTransform: 'uppercase' as const,
  },
  link: {
    color: emailColors.accent,
    fontWeight: '600' as const,
  },
  cta: {
    backgroundColor: emailColors.accent,
    borderRadius: '999px',
    color: emailColors.accentText,
    display: 'inline-block',
    fontFamily: emailFonts.sans,
    fontSize: '15px',
    fontWeight: '700' as const,
    lineHeight: '48px',
    paddingLeft: '24px',
    paddingRight: '24px',
    textDecoration: 'none',
  },
  ctaSecondary: {
    backgroundColor: emailColors.elev,
    border: `2px solid ${emailColors.danger}`,
    borderRadius: '999px',
    color: emailColors.danger,
    display: 'inline-block',
    fontFamily: emailFonts.sans,
    fontSize: '15px',
    fontWeight: '700' as const,
    lineHeight: '44px',
    paddingLeft: '22px',
    paddingRight: '22px',
    textDecoration: 'none',
  },
  callout: {
    backgroundColor: emailColors.panel,
    borderLeft: `4px solid ${emailColors.accent}`,
    borderRadius: '4px',
    margin: '0 0 20px 0',
    padding: '16px 18px',
  },
  calloutLine: {
    color: emailColors.text,
    fontFamily: emailFonts.sans,
    fontSize: '15px',
    fontWeight: '600' as const,
    lineHeight: '1.5',
    margin: '0',
  },
  hr: {
    borderColor: emailColors.border,
    borderTop: `1px solid ${emailColors.border}`,
    margin: '0',
  },
  footerSection: {
    backgroundColor: emailColors.panel,
    padding: '24px 32px 28px',
  },
  footerNote: {
    color: emailColors.dim,
    fontFamily: emailFonts.sans,
    fontSize: '13px',
    lineHeight: '1.5',
    margin: '0 0 14px 0',
  },
  footerContact: {
    color: emailColors.text,
    fontFamily: emailFonts.sans,
    fontSize: '13px',
    fontWeight: '600' as const,
    lineHeight: '1.5',
    margin: '0 0 6px 0',
  },
  footerFine: {
    color: emailColors.faint,
    fontFamily: emailFonts.sans,
    fontSize: '12px',
    lineHeight: '1.4',
    margin: '0',
  },
  muted: {
    color: emailColors.dim,
    fontFamily: emailFonts.sans,
    fontSize: '13px',
    lineHeight: '1.5',
    margin: '0 0 8px 0',
  },
} as const
