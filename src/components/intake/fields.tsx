'use client'

import type { ReactNode } from 'react'

export function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <div className="cpub-field">
      <label>
        {label}
        {required ? <span style={{ color: 'var(--str-pill)' }}> *</span> : null}
      </label>
      {children}
      {error ? <p className="cint-error">{error}</p> : null}
    </div>
  )
}

export function RadioList({
  name,
  value,
  onChange,
  options,
  error,
}: {
  name: string
  value?: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  error?: string
}) {
  return (
    <div>
      <div className="cint-radio-list" role="radiogroup">
        {options.map((opt) => (
          <label key={opt.value} className="cint-radio">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {error ? <p className="cint-error">{error}</p> : null}
    </div>
  )
}
