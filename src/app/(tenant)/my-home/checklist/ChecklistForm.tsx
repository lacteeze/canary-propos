'use client'

// D-11: vendor_cost and billed_amount are never referenced in this file.
import { useState, useTransition, useCallback, useRef } from 'react'
import { updateChecklistItem, submitChecklist } from './actions'

interface ChecklistItemData {
  id: string
  position: number
  label: string
  checked: boolean
  note: string | null
  checked_at: string | null
}

interface ChecklistFormProps {
  checklistId: string
  checklistTitle: string
  checklistType: 'move_in' | 'move_out'
  items: ChecklistItemData[]
  isSubmitted: boolean
  submittedAt: string | null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function ChecklistForm({
  checklistId,
  checklistTitle,
  checklistType,
  items,
  isSubmitted,
  submittedAt,
}: ChecklistFormProps) {
  const [localItems, setLocalItems] = useState<ChecklistItemData[]>(items)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitPending, startSubmitTransition] = useTransition()
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleCheckChange = useCallback(
    (itemId: string, checked: boolean) => {
      if (isSubmitted) return
      setLocalItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, checked } : item)),
      )
      startSubmitTransition(async () => {
        const note = localItems.find((i) => i.id === itemId)?.note ?? null
        const result = await updateChecklistItem(itemId, checked, note)
        if (!result.success) {
          setItemErrors((prev) => ({ ...prev, [itemId]: result.error }))
        }
      })
    },
    [isSubmitted, localItems],
  )

  const handleNoteChange = useCallback(
    (itemId: string, note: string) => {
      if (isSubmitted) return
      setLocalItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, note } : item)),
      )
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId])
      }
      debounceTimers.current[itemId] = setTimeout(async () => {
        const item = localItems.find((i) => i.id === itemId)
        if (!item) return
        const result = await updateChecklistItem(itemId, item.checked, note || null)
        if (!result.success) {
          setItemErrors((prev) => ({ ...prev, [itemId]: result.error }))
        }
      }, 800)
    },
    [isSubmitted, localItems],
  )

  function handleSubmitSignOff() {
    setShowConfirm(true)
  }

  function confirmSubmit() {
    setShowConfirm(false)
    setSubmitError(null)
    startSubmitTransition(async () => {
      const result = await submitChecklist(checklistId)
      if (!result.success) {
        setSubmitError(result.error)
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {checklistTitle}
        </h2>
        <span className="cy-chip">
          {checklistType === 'move_in' ? 'Move-In' : 'Move-Out'}
        </span>
      </div>

      {isSubmitted && submittedAt && (
        <div className="cy-portal-alert cy-portal-alert--ok">
          Signed off on {formatDate(submittedAt)}
          <div style={{ fontWeight: 500, fontSize: 12, marginTop: 2, opacity: 0.85 }}>
            This checklist is now read-only.
          </div>
        </div>
      )}

      <div className="cy-portal-card" style={{ padding: 0, overflow: 'hidden' }}>
        {localItems.length === 0 ? (
          <p className="cy-portal-muted" style={{ margin: 0, padding: 20, textAlign: 'center' }}>
            No items in this checklist.
          </p>
        ) : (
          localItems.map((item, i) => {
            const showNote = item.checked || !!item.note
            return (
              <div
                key={item.id}
                style={{
                  padding: '12px 16px',
                  borderTop: i === 0 ? undefined : '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    id={`item-${item.id}`}
                    checked={item.checked}
                    disabled={isSubmitted}
                    onChange={(e) => handleCheckChange(item.id, e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <label
                    htmlFor={`item-${item.id}`}
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      cursor: isSubmitted ? 'default' : 'pointer',
                      color: item.checked ? 'var(--faint)' : 'var(--text)',
                      textDecoration: item.checked ? 'line-through' : undefined,
                    }}
                  >
                    {item.label}
                  </label>
                </div>

                {showNote && (
                  <div style={{ marginTop: 8, marginLeft: 26 }}>
                    <textarea
                      value={item.note ?? ''}
                      disabled={isSubmitted}
                      onChange={(e) => handleNoteChange(item.id, e.target.value)}
                      placeholder="Add a note (optional)..."
                      rows={2}
                      className="cy-input"
                      style={{ resize: 'none', fontSize: 12.5 }}
                    />
                  </div>
                )}

                {itemErrors[item.id] && (
                  <p style={{ margin: '6px 0 0 26px', fontSize: 12, color: 'var(--red)' }}>
                    {itemErrors[item.id]}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {!isSubmitted && (
        <div style={{ display: 'grid', gap: 10 }}>
          {submitError && <div className="cy-portal-alert cy-portal-alert--err">{submitError}</div>}

          {showConfirm ? (
            <div className="cy-portal-alert cy-portal-alert--warn">
              <p style={{ margin: '0 0 10px' }}>
                Once submitted, this checklist cannot be edited. Continue?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={confirmSubmit}
                  disabled={isSubmitPending}
                  className="cy-btn-primary"
                >
                  {isSubmitPending ? 'Submitting...' : 'Yes, submit sign-off'}
                </button>
                <button type="button" onClick={() => setShowConfirm(false)} className="cy-btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmitSignOff}
              disabled={isSubmitPending}
              className="cy-btn-primary"
              style={{ justifySelf: 'start' }}
            >
              Submit sign-off
            </button>
          )}
        </div>
      )}
    </div>
  )
}
