'use client'

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="no-print cy-btn">
      Print
    </button>
  )
}
