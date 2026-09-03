type EmptyStateProps = {
  title: string
  hint: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, hint, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div
      className="cy-card"
      style={{ padding: 28, maxWidth: 520 }}
    >
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
      <p style={{ margin: '8px 0 0', color: 'var(--dim)', lineHeight: 1.5 }}>{hint}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="cy-btn-primary cy-accent-btn"
          onClick={onAction}
          style={{ marginTop: 18, minHeight: 44 }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
