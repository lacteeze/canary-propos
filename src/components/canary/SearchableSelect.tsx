'use client'

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import './searchable-select.css'

export type SearchableSelectOption = {
  value: string
  label: string
  searchText?: string
}

export function filterSelectOptions(
  options: SearchableSelectOption[],
  query: string,
): SearchableSelectOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter((item) => {
    const hay = (item.searchText ?? `${item.label} ${item.value}`).toLowerCase()
    return hay.includes(q)
  })
}

type SearchableSelectProps = {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
  className?: string
  emptyMessage?: string
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  disabled,
  id,
  'aria-label': ariaLabel,
  className,
  emptyMessage = 'No matches',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const selected = useMemo(
    () => options.find((item) => item.value === value) ?? null,
    [options, value],
  )

  const filtered = useMemo(() => filterSelectOptions(options, query), [options, query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setHighlight(0)
  }, [])

  const pick = useCallback(
    (next: string) => {
      close()
      if (next !== value) onChange(next)
    },
    [close, onChange, value],
  )

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, close])

  const openPicker = useCallback(() => {
    if (disabled) return
    const idx = options.findIndex((item) => item.value === value)
    setQuery('')
    setHighlight(idx >= 0 ? idx : 0)
    setOpen(true)
  }, [disabled, options, value])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[highlight]
      if (item) pick(item.value)
    }
  }

  return (
    <div className={['cy-combo', className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="cy-combo__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return
          if (open) close()
          else openPicker()
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`cy-combo__value${selected ? '' : ' cy-combo__value--placeholder'}`}>
          {selected?.label ?? placeholder}
        </span>
        <span className="cy-combo__caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="cy-combo__popover">
          <input
            ref={inputRef}
            type="search"
            className="cy-combo__search"
            placeholder={searchPlaceholder}
            value={query}
            disabled={disabled}
            aria-autocomplete="list"
            aria-controls={listId}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlight(0)
            }}
            onKeyDown={onInputKeyDown}
          />
          <ul ref={listRef} id={listId} className="cy-combo__list" role="listbox">
            {filtered.length === 0 ? (
              <li className="cy-combo__empty">{emptyMessage}</li>
            ) : (
              filtered.map((item, idx) => {
                const isSelected = item.value === value
                const active = idx === highlight
                return (
                  <li
                    key={item.value || `__empty-${idx}`}
                    data-idx={idx}
                    role="option"
                    aria-selected={isSelected}
                    className={[
                      'cy-combo__option',
                      active ? 'is-active' : '',
                      isSelected ? 'is-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => setHighlight(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pick(item.value)
                    }}
                  >
                    {item.label}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
