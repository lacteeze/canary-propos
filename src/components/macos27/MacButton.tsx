'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type MacButtonVariant = 'bordered' | 'primary' | 'borderless'
export type MacButtonSize = 'sm' | 'md' | 'lg'

export type MacButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: MacButtonVariant
  size?: MacButtonSize
}

const variantClass: Record<MacButtonVariant, string> = {
  bordered: '',
  primary: 'mac-btn--primary',
  borderless: 'mac-btn--borderless',
}

const sizeClass: Record<MacButtonSize, string> = {
  sm: 'mac-btn--sm',
  md: '',
  lg: 'mac-btn--lg',
}

/** macOS 27-styled button primitive. Requires ancestor `.cnry[data-ui='macos27']`. */
export function MacButton({
  className,
  variant = 'bordered',
  size = 'md',
  type = 'button',
  ...props
}: MacButtonProps) {
  return (
    <button
      type={type}
      data-slot="mac-button"
      className={cn('mac-btn', variantClass[variant], sizeClass[size], className)}
      {...props}
    />
  )
}
