type CopyIconProps = {
  size?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Flaticon copy/documents glyph from `/icons/copy.png`.
 * Masked with `currentColor` so bare icon buttons inherit parent color.
 */
export function CopyIcon({ size = 14, className, style }: CopyIconProps) {
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flex: 'none',
        backgroundColor: 'currentColor',
        maskImage: 'url(/icons/copy.png)',
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskImage: 'url(/icons/copy.png)',
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        ...style,
      }}
    />
  )
}
