'use client'

import { useState, useTransition } from 'react'
import { createAnnouncement } from '@/app/(tenant)/my-home/announcements/actions'

interface Announcement {
  id: string
  title: string
  body: string
  created_at: string
  expires_at: string | null
}

interface AnnouncementsSectionProps {
  propertyId: string
  announcements: Announcement[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export function AnnouncementsSection({ propertyId, announcements }: AnnouncementsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createAnnouncement(
        propertyId,
        title,
        body,
        expiresAt || null,
      )

      if (!result.success) {
        setError(result.error)
        return
      }

      // Reset form on success
      setTitle('')
      setBody('')
      setExpiresAt('')
      setShowForm(false)
    })
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-stone-900">Announcements</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
          >
            Post Announcement
          </button>
        )}
      </div>

      {/* Inline post form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-xl border border-stone-200 bg-stone-50 p-4"
        >
          <div className="mb-3">
            <label htmlFor="ann-title" className="mb-1 block text-sm font-medium text-stone-700">
              Title <span aria-hidden="true">*</span>
            </label>
            <input
              id="ann-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Parking lot closed Saturday"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="ann-body" className="mb-1 block text-sm font-medium text-stone-700">
              Message <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="ann-body"
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter the full announcement text…"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="ann-expires" className="mb-1 block text-sm font-medium text-stone-700">
              Expires on (optional)
            </label>
            <input
              id="ann-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60"
            >
              {isPending ? 'Posting…' : 'Post'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setError(null)
              }}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Announcement list */}
      {announcements.length === 0 ? (
        <p className="text-sm text-stone-400">No announcements posted yet for this property.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => {
            const expired = isExpired(ann.expires_at)
            const excerpt =
              ann.body.length > 120 ? ann.body.slice(0, 120).trimEnd() + '…' : ann.body

            return (
              <div
                key={ann.id}
                className={`rounded-xl border bg-white p-4 ${expired ? 'border-stone-100 opacity-60' : 'border-stone-200'}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="font-medium text-stone-900">{ann.title}</p>
                  {expired && (
                    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                      Expired
                    </span>
                  )}
                </div>
                <p className="mb-2 text-sm text-stone-600">{excerpt}</p>
                <p className="text-xs text-stone-400">
                  Posted {formatDate(ann.created_at)}
                  {ann.expires_at && ` · Expires ${formatDate(ann.expires_at)}`}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
