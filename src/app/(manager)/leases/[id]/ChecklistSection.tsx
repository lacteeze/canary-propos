'use client'

import { useState, useTransition } from 'react'
import { createChecklist } from '@/app/(tenant)/my-home/checklist/actions'

interface ChecklistItem {
  id: string
  position: number
  label: string
  checked: boolean
  note: string | null
  checked_at: string | null
}

interface Checklist {
  id: string
  title: string
  type: string
  submitted_at: string | null
  created_at: string
  items: ChecklistItem[]
}

interface ChecklistSectionProps {
  leaseId: string
  existingChecklist: Checklist | null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ChecklistSection({ leaseId, existingChecklist }: ChecklistSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'move_in' | 'move_out'>('move_in')
  const [itemLabels, setItemLabels] = useState(['', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function addItem() {
    setItemLabels(prev => [...prev, ''])
  }

  function removeItem(index: number) {
    setItemLabels(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)
  }

  function updateItem(index: number, value: string) {
    setItemLabels(prev => prev.map((v, i) => (i === index ? value : v)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createChecklist(leaseId, type, title, itemLabels)
      if (!result.success) {
        setError(result.error)
      } else {
        setShowForm(false)
      }
    })
  }

  // Read-only view when checklist exists
  if (existingChecklist) {
    const isSubmitted = !!existingChecklist.submitted_at
    const checkedCount = existingChecklist.items.filter(i => i.checked).length

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-800">{existingChecklist.title}</p>
            <p className="text-xs text-stone-500 mt-0.5">
              {existingChecklist.type === 'move_in' ? 'Move-In' : 'Move-Out'} checklist &middot;{' '}
              {existingChecklist.items.length} items &middot;{' '}
              {checkedCount}/{existingChecklist.items.length} checked
            </p>
          </div>
          {isSubmitted ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              Signed off {formatDate(existingChecklist.submitted_at!)}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Pending tenant sign-off
            </span>
          )}
        </div>

        {existingChecklist.items.length > 0 && (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-stone-50">
            {existingChecklist.items.map(item => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border ${item.checked ? 'border-green-500 bg-green-500' : 'border-stone-300 bg-white'}`} />
                <span className={`text-sm ${item.checked ? 'text-stone-500 line-through' : 'text-stone-800'}`}>
                  {item.label}
                </span>
                {item.note && (
                  <span className="ml-auto text-xs text-stone-400 italic">{item.note}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // Create form
  if (showForm) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Move-In Acknowledgment"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as 'move_in' | 'move_out')}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
            >
              <option value="move_in">Move-In</option>
              <option value="move_out">Move-Out</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-2">Items</label>
          <div className="space-y-2">
            {itemLabels.map((label, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={label}
                  onChange={e => updateItem(index, e.target.value)}
                  placeholder={`Item ${index + 1}`}
                  className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none"
                />
                {itemLabels.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-stone-400 hover:text-red-500 transition-colors px-1"
                    aria-label="Remove item"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-2 text-sm text-stone-500 hover:text-stone-800 underline underline-offset-2"
          >
            + Add item
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-60"
          >
            {isPending ? 'Creating...' : 'Create Checklist'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  // Empty state — show create button
  return (
    <div className="text-center py-6">
      <p className="text-sm text-stone-500 mb-3">No checklist has been created for this lease yet.</p>
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center justify-center rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700"
      >
        Create Checklist
      </button>
    </div>
  )
}
