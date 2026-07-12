// src/components/properties/PropertyPhotoUpload.tsx
// Upload listing (public when live) or private staff photos to org-assets + property_media.
'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  addPropertyMedia,
  deletePropertyMedia,
  listPropertyMedia,
  reorderPropertyMedia,
  setListingHeroPhoto,
  type PropertyMediaItem,
  type PropertyMediaVisibility,
} from '@/app/actions/property-media'

const MEDIA_DND_TYPE = 'application/x-canary-media-id'

function isExternalFileDrag(e: React.DragEvent) {
  return Array.from(e.dataTransfer.types).includes('Files')
}

function isMediaReorderDrag(e: React.DragEvent) {
  return Array.from(e.dataTransfer.types).includes(MEDIA_DND_TYPE)
}

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

interface PropertyPhotoUploadProps {
  propertyId: string
  orgId: string
  /** When set, only show/upload this visibility. Default: both sections. */
  visibility?: PropertyMediaVisibility
  /** Compact styling for Canary drawer */
  compact?: boolean
  /** Gallery styling for property detail modal (larger thumbnails, dark theme) */
  gallery?: boolean
  onChanged?: () => void
}

type DisplayItem = PropertyMediaItem & { url: string }

function isAcceptedImage(file: File): boolean {
  if (ACCEPTED_TYPES.has(file.type)) return true
  // Some browsers omit MIME for dropped files — fall back to extension.
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp'
}

export function PropertyPhotoUpload({
  propertyId,
  orgId,
  visibility,
  compact = false,
  gallery = false,
  onChanged,
}: PropertyPhotoUploadProps) {
  const themed = compact || gallery
  const [items, setItems] = useState<DisplayItem[]>([])
  const [uploading, setUploading] = useState<PropertyMediaVisibility | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<PropertyMediaVisibility | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listingInputRef = useRef<HTMLInputElement>(null)
  const privateInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef<Record<PropertyMediaVisibility, number>>({
    listing: 0,
    private: 0,
  })
  const reorderDragRef = useRef<{
    id: string
    visibility: PropertyMediaVisibility
  } | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function refresh() {
    const result = await listPropertyMedia(propertyId)
    if (!result.success) {
      setError(result.error)
      return
    }
    const filtered = visibility
      ? result.items.filter((i) => i.visibility === visibility)
      : result.items

    const withUrls = await Promise.all(
      filtered.map(async (item) => {
        const { data } = await supabase.storage
          .from('org-assets')
          .createSignedUrl(item.storagePath, 3600)
        return { ...item, url: data?.signedUrl ?? '' }
      })
    )
    setItems(withUrls.filter((i) => i.url))
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, visibility])

  async function uploadOneFile(file: File, target: PropertyMediaVisibility) {
    const folder = target === 'listing' ? 'photos' : 'private-photos'
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${orgId}/properties/${propertyId}/${folder}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('org-assets')
      .upload(path, file, { upsert: false, contentType: file.type || undefined })

    if (uploadError) {
      throw new Error(`${file.name}: ${uploadError.message}`)
    }

    const result = await addPropertyMedia({
      propertyId,
      storagePath: path,
      visibility: target,
    })

    if (!result.success) {
      throw new Error(`${file.name}: ${result.error}`)
    }
  }

  async function handleUploadFiles(
    fileList: FileList | File[] | null | undefined,
    target: PropertyMediaVisibility
  ) {
    const files = Array.from(fileList ?? [])
    if (!files.length) return

    setUploading(target)
    setError(null)
    setUploadProgress(null)

    const valid: File[] = []
    const skipMessages: string[] = []

    for (const file of files) {
      if (!isAcceptedImage(file)) {
        skipMessages.push(`${file.name}: must be JPEG, PNG, or WebP`)
        continue
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        skipMessages.push(`${file.name}: exceeds 20 MB`)
        continue
      }
      valid.push(file)
    }

    if (!valid.length) {
      setError(skipMessages.join(' · ') || 'No valid images selected.')
      setUploading(null)
      if (listingInputRef.current) listingInputRef.current.value = ''
      if (privateInputRef.current) privateInputRef.current.value = ''
      return
    }

    const failMessages: string[] = [...skipMessages]
    let uploaded = 0

    try {
      for (let i = 0; i < valid.length; i++) {
        const file = valid[i]
        setUploadProgress(
          valid.length === 1
            ? 'Uploading…'
            : `Uploading ${i + 1} of ${valid.length}…`
        )
        try {
          await uploadOneFile(file, target)
          uploaded += 1
        } catch (err) {
          const message =
            err instanceof Error ? err.message : `${file.name}: upload failed`
          failMessages.push(message)
          console.error('[PropertyPhotoUpload]', err)
        }
      }

      if (uploaded > 0) {
        await refresh()
        onChanged?.()
      }

      if (failMessages.length) {
        const summary =
          uploaded > 0
            ? `Uploaded ${uploaded} of ${valid.length}. ${failMessages.join(' · ')}`
            : failMessages.join(' · ')
        setError(summary)
      }
    } catch (err) {
      setError('An unexpected error occurred during upload.')
      console.error('[PropertyPhotoUpload]', err)
    } finally {
      setUploading(null)
      setUploadProgress(null)
      if (listingInputRef.current) listingInputRef.current.value = ''
      if (privateInputRef.current) privateInputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    const result = await deletePropertyMedia(id)
    if (!result.success) {
      setError(result.error)
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== id))
    onChanged?.()
  }

  async function handleSetHero(mediaId: string) {
    if (reordering || uploading) return
    setError(null)
    setReordering(true)
    try {
      const result = await setListingHeroPhoto({ propertyId, mediaId })
      if (!result.success) {
        setError(result.error)
        return
      }
      setItems((prev) => {
        const listing = prev.filter((i) => i.visibility === 'listing')
        const others = prev.filter((i) => i.visibility !== 'listing')
        const hero = listing.find((i) => i.id === mediaId)
        if (!hero) return prev
        const rest = listing.filter((i) => i.id !== mediaId)
        const nextListing = [hero, ...rest].map((item, index) => ({
          ...item,
          sortOrder: index,
        }))
        return [...nextListing, ...others]
      })
      onChanged?.()
    } finally {
      setReordering(false)
    }
  }

  function clearReorderDrag() {
    reorderDragRef.current = null
    setDraggingId(null)
    setDropTargetId(null)
  }

  async function commitReorder(
    targetVisibility: PropertyMediaVisibility,
    fromId: string,
    toId: string
  ) {
    if (fromId === toId || reordering || uploading) return

    const sectionItems = items.filter((i) => i.visibility === targetVisibility)
    const fromIndex = sectionItems.findIndex((i) => i.id === fromId)
    const toIndex = sectionItems.findIndex((i) => i.id === toId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

    const nextSection = [...sectionItems]
    const [moved] = nextSection.splice(fromIndex, 1)
    nextSection.splice(toIndex, 0, moved)
    const orderedIds = nextSection.map((i) => i.id)
    const withOrder = nextSection.map((item, index) => ({
      ...item,
      sortOrder: index,
    }))

    setItems((prev) => {
      const other = prev.filter((i) => i.visibility !== targetVisibility)
      return targetVisibility === 'listing'
        ? [...withOrder, ...other]
        : [...other, ...withOrder]
    })

    setReordering(true)
    setError(null)
    const result = await reorderPropertyMedia({
      propertyId,
      visibility: targetVisibility,
      orderedIds,
    })
    setReordering(false)

    if (!result.success) {
      setError(result.error)
      await refresh()
      return
    }

    onChanged?.()
  }

  const listingItems = items.filter((i) => i.visibility === 'listing')
  const privateItems = items.filter((i) => i.visibility === 'private')
  const showListing = !visibility || visibility === 'listing'
  const showPrivate = !visibility || visibility === 'private'

  const sectionStyle: React.CSSProperties = gallery
    ? { marginBottom: 20 }
    : compact
      ? { marginBottom: 14 }
      : { marginBottom: 20 }

  const labelStyle: React.CSSProperties = themed
    ? {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: gallery ? 10.5 : 10,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'var(--dim)',
        marginBottom: 8,
      }
    : { fontSize: 13, fontWeight: 600, color: '#44403c', marginBottom: 8 }

  const hintStyle: React.CSSProperties = themed
    ? { fontSize: 12, color: 'var(--faint)', marginBottom: 8, lineHeight: 1.35 }
    : { fontSize: 12, color: '#a8a29e', marginBottom: 8 }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gallery
      ? 'repeat(auto-fill, minmax(112px, 1fr))'
      : compact
        ? 'repeat(auto-fill, minmax(96px, 1fr))'
        : 'repeat(3, 1fr)',
    gap: gallery ? 10 : compact ? 8 : 12,
    marginBottom: 10,
  }

  const btnStyle: React.CSSProperties = themed
    ? {
        border: '1px solid var(--border)',
        background: 'var(--elev)',
        color: 'var(--text)',
        borderRadius: 8,
        padding: '7px 12px',
        fontWeight: 600,
        fontSize: 12.5,
        cursor: 'pointer',
        display: 'inline-flex',
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 6,
        border: '1px solid #d6d3d1',
        padding: '8px 16px',
        fontSize: 14,
        fontWeight: 500,
        color: '#44403c',
        cursor: 'pointer',
      }

  function renderGrid(list: DisplayItem[], sectionVisibility: PropertyMediaVisibility) {
    if (!list.length) return null
    const busy = !!uploading || reordering

    return (
      <div style={gridStyle}>
        {list.map((item, index) => {
          const isDragging = draggingId === item.id
          const isDropTarget =
            dropTargetId === item.id && draggingId !== null && draggingId !== item.id

          return (
            <div
              key={item.id}
              draggable={!busy}
              onDragStart={(e) => {
                if (busy) {
                  e.preventDefault()
                  return
                }
                e.stopPropagation()
                reorderDragRef.current = {
                  id: item.id,
                  visibility: sectionVisibility,
                }
                e.dataTransfer.setData(MEDIA_DND_TYPE, item.id)
                e.dataTransfer.setData('text/plain', item.id)
                e.dataTransfer.effectAllowed = 'move'
                setDraggingId(item.id)
                setDropTargetId(null)
              }}
              onDragEnd={() => {
                clearReorderDrag()
              }}
              onDragOver={(e) => {
                if (!isMediaReorderDrag(e) || isExternalFileDrag(e)) return
                const drag = reorderDragRef.current
                if (!drag || drag.visibility !== sectionVisibility) return
                e.preventDefault()
                e.stopPropagation()
                e.dataTransfer.dropEffect = 'move'
                if (dropTargetId !== item.id) setDropTargetId(item.id)
              }}
              onDragLeave={(e) => {
                if (!isMediaReorderDrag(e)) return
                const related = e.relatedTarget as Node | null
                if (related && e.currentTarget.contains(related)) return
                setDropTargetId((prev) => (prev === item.id ? null : prev))
              }}
              onDrop={(e) => {
                if (!isMediaReorderDrag(e) || isExternalFileDrag(e)) return
                e.preventDefault()
                e.stopPropagation()
                const drag = reorderDragRef.current
                const fromId =
                  drag?.id ??
                  (e.dataTransfer.getData(MEDIA_DND_TYPE) ||
                    e.dataTransfer.getData('text/plain'))
                clearReorderDrag()
                if (!fromId || drag?.visibility !== sectionVisibility) return
                void commitReorder(sectionVisibility, fromId, item.id)
              }}
              title={
                sectionVisibility === 'listing' && index === 0
                  ? 'Hero photo for the public listing page · drag to reorder'
                  : sectionVisibility === 'listing'
                    ? 'Drag to reorder · use Set hero to make this the listing hero'
                    : 'Drag to reorder'
              }
              style={{
                position: 'relative',
                aspectRatio: '4 / 3',
                overflow: 'hidden',
                borderRadius: themed ? (gallery ? 10 : 8) : 10,
                background: themed ? 'var(--elev)' : '#f5f5f4',
                border: isDropTarget
                  ? themed
                    ? '1.5px solid var(--accent)'
                    : '1.5px solid #d97706'
                  : themed
                    ? '1px solid var(--border)'
                    : '1px solid transparent',
                opacity: isDragging ? 0.4 : 1,
                cursor: busy ? 'default' : 'grab',
                boxShadow: isDropTarget
                  ? themed
                    ? '0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent)'
                    : '0 0 0 2px rgba(217, 119, 6, 0.25)'
                  : undefined,
                transition: 'opacity 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.visibility === 'listing' ? 'Listing photo' : 'Private photo'}
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />
              {sectionVisibility === 'listing' && index === 0 && (
                <span
                  style={{
                    position: 'absolute',
                    left: 4,
                    bottom: 4,
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '.04em',
                    textTransform: 'uppercase',
                    background: 'rgba(0,0,0,.6)',
                    color: '#fff',
                    pointerEvents: 'none',
                  }}
                >
                  Hero
                </span>
              )}
              {sectionVisibility === 'listing' && index > 0 && (
                <button
                  type="button"
                  title="Use as hero photo on the public listing page"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleSetHero(item.id)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: 4,
                    bottom: 4,
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 7px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '.03em',
                    textTransform: 'uppercase',
                    background: 'rgba(0,0,0,.7)',
                    color: '#fff',
                    cursor: busy ? 'wait' : 'pointer',
                  }}
                >
                  Set hero
                </button>
              )}
              <button
                type="button"
                title="Remove photo"
                onClick={() => void handleDelete(item.id)}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  border: 'none',
                  borderRadius: 6,
                  width: 24,
                  height: 24,
                  background: 'rgba(0,0,0,.55)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  function renderUpload(
    target: PropertyMediaVisibility,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) {
    const busy = uploading === target
    const isDragTarget = dragOver === target
    const disabled = !!uploading

    const dropZoneStyle: React.CSSProperties = themed
      ? {
          marginTop: 2,
          border: `1.5px dashed ${isDragTarget ? 'var(--accent)' : 'var(--border2)'}`,
          borderRadius: 12,
          padding: '14px 12px',
          background: isDragTarget
            ? 'color-mix(in srgb, var(--accent) 14%, var(--elev))'
            : 'var(--elev)',
          transition: 'border-color 120ms ease, background 120ms ease',
          opacity: disabled && !busy ? 0.55 : 1,
        }
      : {
          marginTop: 2,
          border: `1.5px dashed ${isDragTarget ? '#d97706' : '#d6d3d1'}`,
          borderRadius: 10,
          padding: '14px 12px',
          background: isDragTarget ? '#fffbeb' : '#fafaf9',
          transition: 'border-color 120ms ease, background 120ms ease',
          opacity: disabled && !busy ? 0.55 : 1,
        }

    return (
      <div
        onDragEnter={(e) => {
          if (!isExternalFileDrag(e) || isMediaReorderDrag(e)) return
          e.preventDefault()
          e.stopPropagation()
          if (disabled) return
          dragDepthRef.current[target] += 1
          setDragOver(target)
        }}
        onDragOver={(e) => {
          if (!isExternalFileDrag(e) || isMediaReorderDrag(e)) return
          e.preventDefault()
          e.stopPropagation()
          if (disabled) return
          e.dataTransfer.dropEffect = 'copy'
          if (dragOver !== target) setDragOver(target)
        }}
        onDragLeave={(e) => {
          if (!isExternalFileDrag(e) || isMediaReorderDrag(e)) return
          e.preventDefault()
          e.stopPropagation()
          dragDepthRef.current[target] = Math.max(0, dragDepthRef.current[target] - 1)
          if (dragDepthRef.current[target] === 0) {
            setDragOver((prev) => (prev === target ? null : prev))
          }
        }}
        onDrop={(e) => {
          if (isMediaReorderDrag(e) || !isExternalFileDrag(e)) {
            // Thumbnail reorder drops belong to the grid, not the upload zone.
            if (isMediaReorderDrag(e)) {
              e.preventDefault()
              e.stopPropagation()
            }
            dragDepthRef.current[target] = 0
            setDragOver(null)
            return
          }
          e.preventDefault()
          e.stopPropagation()
          dragDepthRef.current[target] = 0
          setDragOver(null)
          if (disabled) return
          void handleUploadFiles(e.dataTransfer.files, target)
        }}
        style={dropZoneStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ cursor: busy ? 'wait' : disabled ? 'not-allowed' : 'pointer' }}>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={disabled}
              className="sr-only"
              onChange={(e) => void handleUploadFiles(e.target.files, target)}
            />
            <span style={{ ...btnStyle, opacity: busy ? 0.55 : 1 }}>
              {busy
                ? uploadProgress ?? 'Uploading…'
                : 'Upload photos'}
            </span>
          </label>
          <span style={{ ...hintStyle, marginBottom: 0 }}>
            {isDragTarget
              ? 'Drop to upload'
              : 'Drag & drop or browse · JPEG, PNG, or WebP · max 20 MB · full resolution'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {showListing && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Listing photos</div>
          <div style={hintStyle}>
            Shown on the landing page and public listing when this property has a live listing.
            First photo is the hero on the listing page — click Set hero on any photo, or drag to reorder.
          </div>
          {renderGrid(listingItems, 'listing')}
          {!listingItems.length && (
            <div style={{ ...hintStyle, marginBottom: 10 }}>No listing photos yet.</div>
          )}
          {renderUpload('listing', listingInputRef)}
        </div>
      )}

      {showPrivate && (
        <div style={sectionStyle}>
          <div style={labelStyle}>{themed ? '🔒 Private photos' : 'Private photos (staff only)'}</div>
          <div style={hintStyle}>
            Inspections, historical, and pre-renovation photos. Never shown on public listings.
            Drag thumbnails to reorder.
          </div>
          {renderGrid(privateItems, 'private')}
          {!privateItems.length && (
            <div style={{ ...hintStyle, marginBottom: 10 }}>No private photos yet.</div>
          )}
          {renderUpload('private', privateInputRef)}
        </div>
      )}

      {error && (
        <p
          style={
            themed
              ? {
                  marginTop: 8,
                  borderRadius: 8,
                  padding: '8px 10px',
                  background: 'color-mix(in srgb, var(--red) 12%, transparent)',
                  color: 'var(--red)',
                  fontSize: 12.5,
                }
              : {
                  marginTop: 8,
                  borderRadius: 6,
                  padding: '8px 12px',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 14,
                }
          }
        >
          {error}
        </p>
      )}
    </div>
  )
}
