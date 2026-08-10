'use client'

import React from 'react'

type AutosizeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Currently visible option label — used to size the control (native select won't hug). */
  sizeToLabel: string
}

/** Native select sized to the selected label via a hidden mirror span. */
export function AutosizeSelect({
  sizeToLabel,
  className,
  children,
  ...rest
}: AutosizeSelectProps) {
  return (
    <span className="cy-select-autosize">
      <span className="cy-select-autosize__mirror" aria-hidden="true">
        {sizeToLabel || '\u00a0'}
      </span>
      <select className={className} {...rest}>
        {children}
      </select>
    </span>
  )
}
