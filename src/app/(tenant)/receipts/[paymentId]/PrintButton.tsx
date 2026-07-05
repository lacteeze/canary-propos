'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
    >
      Print
    </button>
  )
}
