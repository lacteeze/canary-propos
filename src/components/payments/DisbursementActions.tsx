'use client'

// src/components/payments/DisbursementActions.tsx
// Client component: period selector + generate statement button.
// Handles form navigation (year/month search params) and the generate API call.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface DisbursementActionsProps {
  propertyId: string
  selectedYear: number
  selectedMonth: number
  yearOptions: number[]
  statementAlreadyExists: boolean
}

export function DisbursementActions({
  propertyId,
  selectedYear,
  selectedMonth,
  yearOptions,
  statementAlreadyExists,
}: DisbursementActionsProps) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pdfPath, setPdfPath] = useState<string | null>(null)

  function handleYearChange(value: string | null) {
    if (!value) return
    router.push(`/payments/disbursement/${propertyId}?year=${value}&month=${selectedMonth}`)
  }

  function handleMonthChange(value: string | null) {
    if (!value) return
    router.push(`/payments/disbursement/${propertyId}?year=${selectedYear}&month=${value}`)
  }

  async function handleGenerateStatement() {
    setGenerating(true)
    setMessage(null)
    setPdfPath(null)

    try {
      const response = await fetch('/api/statements/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          year: selectedYear,
          month: selectedMonth,
        }),
      })

      const data = (await response.json()) as { success?: boolean; pdf_path?: string; error?: string }

      if (response.status === 409) {
        setMessage({ type: 'error', text: 'A statement already exists for this period.' })
      } else if (!response.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to generate statement' })
      } else {
        setPdfPath(data.pdf_path ?? null)
        setMessage({ type: 'success', text: 'Statement generated successfully.' })
        // Refresh the page to pick up statementAlreadyExists = true
        router.refresh()
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Year selector */}
          <div className="space-y-1">
            <label className="text-xs text-stone-500 font-medium uppercase tracking-wide">Year</label>
            <Select value={String(selectedYear)} onValueChange={handleYearChange}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month selector */}
          <div className="space-y-1">
            <label className="text-xs text-stone-500 font-medium uppercase tracking-wide">Month</label>
            <Select value={String(selectedMonth)} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate / Download button */}
          <div className="flex items-end">
            {statementAlreadyExists ? (
              <Button variant="outline" disabled>
                Statement exists
              </Button>
            ) : (
              <Button onClick={handleGenerateStatement} disabled={generating}>
                {generating ? 'Generating…' : 'Generate Statement PDF'}
              </Button>
            )}
          </div>
        </div>

        {/* Feedback */}
        {message && (
          <p
            className={`mt-3 text-sm ${
              message.type === 'success' ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {message.text}
            {pdfPath && message.type === 'success' && (
              <span className="ml-2 text-stone-500">(Path: {pdfPath})</span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
