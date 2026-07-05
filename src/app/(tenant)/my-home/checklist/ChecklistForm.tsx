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
  // Local state mirrors server data for optimistic UI
  const [localItems, setLocalItems] = useState<ChecklistItemData[]>(items)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitPending, startSubmitTransition] = useTransition()
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})

  // Debounce refs per item
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleCheckChange = useCallback(
    (itemId: string, checked: boolean) => {
      if (isSubmitted) return
      setLocalItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, checked } : item
        )
      )
      startSubmitTransition(async () => {
        const note = localItems.find(i => i.id === itemId)?.note ?? null
        const result = await updateChecklistItem(itemId, checked, note)
        if (!result.success) {
          setItemErrors(prev => ({ ...prev, [itemId]: result.error }))
        }
      })
    },
    [isSubmitted, localItems]
  )

  const handleNoteChange = useCallback(
    (itemId: string, note: string) => {
      if (isSubmitted) return
      setLocalItems(prev =>
        prev.map(item => (item.id === itemId ? { ...item, note } : item))
      )
      // Debounce 800ms
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId])
      }
      debounceTimers.current[itemId] = setTimeout(async () => {
        const item = localItems.find(i => i.id === itemId)
        if (!item) return
        const result = await updateChecklistItem(itemId, item.checked, note || null)
        if (!result.success) {
          setItemErrors(prev => ({ ...prev, [itemId]: result.error }))
        }
      }, 800)
    },
    [isSubmitted, localItems]
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
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">{checklistTitle}</h2>
        </div>
        <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
          {checklistType === 'move_in' ? 'Move-In' : 'Move-Out'}
        </span>
      </div>

      {/* Submitted banner */}
      {isSubmitted && submittedAt && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm font-medium text-green-800">
            Signed off on {formatDate(submittedAt)}
          </p>
          <p className="mt-0.5 text-xs text-green-600">This checklist is now read-only.</p>
        </div>
      )}

      {/* Item list */}
      <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden">
        {localItems.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500 text-center">No items in this checklist.</p>
        ) : (
          localItems.map(item => {
            const showNote = item.checked || !!item.note
            return (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`item-${item.id}`}
                    checked={item.checked}
                    disabled={isSubmitted}
                    onChange={e => handleCheckChange(item.id, e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-stone-300 text-stone-900 focus:ring-stone-500 disabled:opacity-60"
                  />
                  <label
                    htmlFor={`item-${item.id}`}
                    className={`flex-1 text-sm cursor-pointer ${item.checked ? 'text-stone-400 line-through' : 'text-stone-800'} ${isSubmitted ? 'cursor-default' : ''}`}
                  >
                    {item.label}
                  </label>
                </div>

                {showNote && (
                  <div className="mt-2 ml-7">
                    <textarea
                      value={item.note ?? ''}
                      disabled={isSubmitted}
                      onChange={e => handleNoteChange(item.id, e.target.value)}
                      placeholder="Add a note (optional)..."
                      rows={2}
                      className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-xs text-stone-700 placeholder-stone-400 focus:border-stone-400 focus:outline-none disabled:bg-stone-50 disabled:text-stone-500"
                    />
                  </div>
                )}

                {itemErrors[item.id] && (
                  <p className="ml-7 mt-1 text-xs text-red-600">{itemErrors[item.id]}</p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Submit sign-off */}
      {!isSubmitted && (
        <div className="space-y-2">
          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
          )}

          {showConfirm ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <p className="text-sm font-medium text-amber-900">
                Once submitted, this checklist cannot be edited. Continue?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmSubmit}
                  disabled={isSubmitPending}
                  className="inline-flex items-center justify-center rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-60"
                >
                  {isSubmitPending ? 'Submitting...' : 'Yes, submit sign-off'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-sm text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSubmitSignOff}
              disabled={isSubmitPending}
              className="inline-flex items-center justify-center rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-60"
            >
              Submit Sign-Off
            </button>
          )}
        </div>
      )}
    </div>
  )
}
