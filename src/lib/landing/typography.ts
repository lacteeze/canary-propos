/** Humanist display face — Optima on macOS/iOS, Candara/Segoe UI elsewhere. */
export const fontDisplay =
  "var(--font-display), Optima, 'Segoe UI', Candara, 'Trebuchet MS', sans-serif"

export const displayAccentStyle = {
  fontFamily: fontDisplay,
  fontStyle: 'normal' as const,
  fontWeight: 500,
}
