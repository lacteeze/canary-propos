'use client'

// Browse Google Drive folders/images and import (or link folder) for a property.

import React, { useEffect, useRef, useState, useTransition } from 'react'
import {
  importDriveFilesToProperty,
  linkPropertyDriveFolder,
  listDriveFolderItems,
  searchDriveFolderItems,
} from '@/app/actions/drive-photos'
import type { DriveListItem } from '@/lib/google-drive-types'
import type { PropertyMediaVisibility } from '@/app/actions/property-media'

type Mode = 'import' | 'link'

interface DriveImportModalProps {
  open: boolean
  onClose: () => void
  propertyId: string
  visibility: PropertyMediaVisibility
  mode: Mode
  themed?: boolean
  onImported?: () => void
  onLinked?: (folder: { id: string; name: string }) => void
}

type Crumb = { id: string; name: string }

const SEARCH_DEBOUNCE_MS = 350

function driveThumbnailSrc(fileId: string): string {
  return `/api/drive/thumbnail/${encodeURIComponent(fileId)}`
}

export function DriveImportModal({
  open,
  onClose,
  propertyId,
  visibility,
  mode,
  themed = false,
  onImported,
  onLinked,
}: DriveImportModalProps) {
  const [items, setItems] = useState<DriveListItem[]>([])
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: 'root', name: 'My Drive' }])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [unsupportedFileCount, setUnsupportedFileCount] = useState(0)
  const [totalChildCount, setTotalChildCount] = useState(0)
  const [brokenThumbs, setBrokenThumbs] = useState<Set<string>>(() => new Set())
  const [isPending, startTransition] = useTransition()
  const searchSeqRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentFolderId = crumbs[crumbs.length - 1]?.id ?? 'root'
  const isSearchMode = activeSearch.length > 0

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setError(null)
    setSearchInput('')
    setActiveSearch('')
    setUnsupportedFileCount(0)
    setTotalChildCount(0)
    setBrokenThumbs(new Set())
    setCrumbs([{ id: 'root', name: 'My Drive' }])
    void loadFolder('root')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = searchInput.trim()
    if (!trimmed) {
      const wasSearching = activeSearch.length > 0
      setActiveSearch('')
      if (wasSearching) {
        void loadFolder(currentFolderId)
      }
      return
    }

    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, open, mode])

  async function loadFolder(folderId: string) {
    setLoading(true)
    setError(null)
    setBrokenThumbs(new Set())
    const result = await listDriveFolderItems(folderId === 'root' ? null : folderId)
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      setItems([])
      setUnsupportedFileCount(0)
      setTotalChildCount(0)
      return
    }
    setItems(result.items)
    setUnsupportedFileCount(result.unsupportedFileCount)
    setTotalChildCount(result.totalChildCount)
  }

  async function runSearch(query: string) {
    const seq = ++searchSeqRef.current
    setSearching(true)
    setLoading(true)
    setError(null)
    setActiveSearch(query)
    setBrokenThumbs(new Set())

    const result = await searchDriveFolderItems({
      query,
      foldersOnly: mode === 'link',
    })

    if (seq !== searchSeqRef.current) return

    setSearching(false)
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      setItems([])
      setUnsupportedFileCount(0)
      setTotalChildCount(0)
      return
    }
    setItems(result.items)
    setUnsupportedFileCount(0)
    setTotalChildCount(result.items.length)
  }

  function clearSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    searchSeqRef.current += 1
    setSearchInput('')
    setActiveSearch('')
    setSearching(false)
    void loadFolder(currentFolderId)
  }

  function enterFolder(item: DriveListItem) {
    if (!item.isFolder) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    searchSeqRef.current += 1
    setSearchInput('')
    setActiveSearch('')
    setSearching(false)
    setSelected(new Set())
    setCrumbs((prev) => {
      // From search we may not know the full parent path — drop into folder under root.
      if (isSearchMode) return [{ id: 'root', name: 'My Drive' }, { id: item.id, name: item.name }]
      return [...prev, { id: item.id, name: item.name }]
    })
    void loadFolder(item.id)
  }

  function goToCrumb(index: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    searchSeqRef.current += 1
    setSearchInput('')
    setActiveSearch('')
    setSearching(false)
    const next = crumbs.slice(0, index + 1)
    setCrumbs(next)
    setSelected(new Set())
    void loadFolder(next[next.length - 1].id)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleImport() {
    const fileIds = [...selected]
    if (!fileIds.length) return
    startTransition(async () => {
      setError(null)
      const result = await importDriveFilesToProperty({
        propertyId,
        fileIds,
        visibility,
        replaceExisting: true,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      onImported?.()
      onClose()
    })
  }

  function handleLinkFolder() {
    const folder = crumbs[crumbs.length - 1]
    if (!folder || folder.id === 'root') {
      setError('Open a folder first, then link it.')
      return
    }
    startTransition(async () => {
      setError(null)
      const result = await linkPropertyDriveFolder({
        propertyId,
        folderId: folder.id,
        folderName: folder.name,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      onLinked?.({ id: folder.id, name: folder.name })
      onClose()
    })
  }

  if (!open) return null

  const folders = items.filter((i) => i.isFolder)
  const images = items.filter((i) => !i.isFolder)
  const busy = loading || isPending
  const emptyBrowse =
    !loading && !isSearchMode && folders.length === 0 && images.length === 0
  const emptySearch = !loading && isSearchMode && items.length === 0

  function emptyBrowseMessage(): string {
    if (totalChildCount === 0) {
      return 'This folder has no files or subfolders.'
    }
    if (unsupportedFileCount > 0) {
      return `This folder has ${unsupportedFileCount} file${unsupportedFileCount === 1 ? '' : 's'} but no supported images (JPEG, PNG, WebP, GIF, HEIC/HEIF, or shortcuts to those).`
    }
    return 'No supported images found in this folder.'
  }

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    background: 'rgba(0,0,0,.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  }

  const panel: React.CSSProperties = themed
    ? {
        width: 'min(720px, 100%)',
        maxHeight: 'min(80vh, 720px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--elev)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 24px 60px rgba(0,0,0,.45)',
      }
    : {
        width: 'min(720px, 100%)',
        maxHeight: 'min(80vh, 720px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        color: '#1c1917',
        border: '1px solid #e7e5e4',
        borderRadius: 12,
        boxShadow: '0 20px 50px rgba(0,0,0,.2)',
      }

  const btn: React.CSSProperties = themed
    ? {
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--text)',
        borderRadius: 8,
        padding: '7px 12px',
        fontWeight: 600,
        fontSize: 12.5,
        cursor: 'pointer',
      }
    : {
        border: '1px solid #d6d3d1',
        background: '#fff',
        color: '#44403c',
        borderRadius: 6,
        padding: '8px 12px',
        fontWeight: 500,
        fontSize: 13,
        cursor: 'pointer',
      }

  const primaryBtn: React.CSSProperties = themed
    ? { ...btn, background: 'var(--accent)', color: 'var(--bg, #0c0c0c)', borderColor: 'transparent' }
    : { ...btn, background: '#d97706', color: '#fff', borderColor: '#d97706' }

  const searchInputStyle: React.CSSProperties = themed
    ? {
        flex: 1,
        minWidth: 0,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--text)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
        outline: 'none',
      }
    : {
        flex: 1,
        minWidth: 0,
        border: '1px solid #d6d3d1',
        background: '#fff',
        color: '#1c1917',
        borderRadius: 6,
        padding: '8px 10px',
        fontSize: 13,
        outline: 'none',
      }

  return (
    <div
      style={overlay}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'link' ? 'Link Google Drive folder' : 'Import from Google Drive'}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div style={panel}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: themed ? '1px solid var(--border)' : '1px solid #e7e5e4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {mode === 'link' ? 'Link Drive folder' : 'Import from Drive'}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: themed ? 'var(--faint)' : '#78716c',
              }}
            >
              {mode === 'link'
                ? 'Search or navigate into a folder, then link it. Sync imports images here and in subfolders (up to 2 levels).'
                : `Search or multi-select images to add as ${visibility} photos.`}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} style={btn}>
            Close
          </button>
        </div>

        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            borderBottom: themed ? '1px solid var(--border)' : '1px solid #e7e5e4',
            fontSize: 12.5,
          }}
        >
          {crumbs.map((c, i) => (
            <React.Fragment key={`${c.id}-${i}`}>
              {i > 0 && <span style={{ opacity: 0.5 }}>/</span>}
              <button
                type="button"
                disabled={busy || (!isSearchMode && i === crumbs.length - 1)}
                onClick={() => goToCrumb(i)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: themed ? 'var(--accent)' : '#b45309',
                  cursor:
                    !isSearchMode && i === crumbs.length - 1 ? 'default' : 'pointer',
                  fontWeight:
                    !isSearchMode && i === crumbs.length - 1 ? 700 : 500,
                  padding: 0,
                  opacity: isSearchMode ? 0.65 : 1,
                }}
              >
                {c.name}
              </button>
            </React.Fragment>
          ))}
          {isSearchMode && (
            <>
              <span style={{ opacity: 0.5 }}>/</span>
              <span style={{ fontWeight: 700 }}>
                Search “{activeSearch}”
              </span>
            </>
          )}
        </div>

        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            borderBottom: themed ? '1px solid var(--border)' : '1px solid #e7e5e4',
          }}
        >
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={
              mode === 'link'
                ? 'Search folders by name…'
                : 'Search folders and images…'
            }
            disabled={isPending}
            aria-label={
              mode === 'link'
                ? 'Search Drive folders by name'
                : 'Search Drive folders and images by name'
            }
            style={searchInputStyle}
          />
          {(searchInput || isSearchMode) && (
            <button type="button" onClick={clearSearch} disabled={busy} style={btn}>
              Clear
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {loading ? (
            <p style={{ padding: 12, fontSize: 13, opacity: 0.7 }}>
              {searching || isSearchMode ? 'Searching…' : 'Loading…'}
            </p>
          ) : emptySearch ? (
            <p style={{ padding: 12, fontSize: 13, opacity: 0.7 }}>
              No {mode === 'link' ? 'folders' : 'folders or images'} matching “
              {activeSearch}”.
            </p>
          ) : emptyBrowse ? (
            <p style={{ padding: 12, fontSize: 13, opacity: 0.7 }}>
              {emptyBrowseMessage()}
            </p>
          ) : (
            <>
              {folders.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      opacity: 0.55,
                      marginBottom: 8,
                    }}
                  >
                    Folders
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        disabled={busy}
                        onClick={() => enterFolder(folder)}
                        style={{
                          ...btn,
                          textAlign: 'left',
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <span aria-hidden>📁</span>
                        <span>{folder.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    opacity: 0.55,
                    marginBottom: 8,
                  }}
                >
                  Images{images.length > 0 ? ` (${images.length})` : ''}
                  {mode === 'link' ? ' — preview' : ''}
                </div>
                {images.length === 0 ? (
                  <p style={{ fontSize: 13, opacity: 0.65 }}>
                    {isSearchMode
                      ? 'No matching images.'
                      : unsupportedFileCount > 0
                        ? `${unsupportedFileCount} other file${unsupportedFileCount === 1 ? '' : 's'} here, but none are supported images.`
                        : 'No images in this folder.'}
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {images.map((img) => {
                      const isSelected = selected.has(img.id)
                      const selectable = mode === 'import'
                      const showThumb = !brokenThumbs.has(img.id)
                      return (
                        <button
                          key={img.id}
                          type="button"
                          disabled={busy || !selectable}
                          onClick={() => {
                            if (selectable) toggleSelect(img.id)
                          }}
                          style={{
                            border:
                              selectable && isSelected
                                ? themed
                                  ? '1.5px solid var(--accent)'
                                  : '1.5px solid #d97706'
                                : themed
                                  ? '1px solid var(--border)'
                                  : '1px solid #e7e5e4',
                            borderRadius: 10,
                            padding: 8,
                            background: themed ? 'var(--bg)' : '#fafaf9',
                            cursor: selectable ? 'pointer' : 'default',
                            textAlign: 'left',
                            opacity: selectable ? 1 : 0.92,
                          }}
                        >
                          <div
                            style={{
                              aspectRatio: '4/3',
                              borderRadius: 6,
                              background: themed ? 'var(--elev)' : '#e7e5e4',
                              marginBottom: 6,
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 22,
                            }}
                          >
                            {showThumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={driveThumbnailSrc(img.id)}
                                alt=""
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                                onError={() => {
                                  setBrokenThumbs((prev) => {
                                    const next = new Set(prev)
                                    next.add(img.id)
                                    return next
                                  })
                                }}
                              />
                            ) : (
                              '🖼'
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={img.name}
                          >
                            {selectable && isSelected ? '✓ ' : ''}
                            {img.name}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {mode === 'link' && !isSearchMode && (
                <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.4, marginTop: 12 }}>
                  Current folder: <strong>{crumbs[crumbs.length - 1]?.name}</strong>
                  {currentFolderId === 'root'
                    ? ' — open a specific folder to link it.'
                    : images.length > 0
                      ? ` — ${images.length} image${images.length === 1 ? '' : 's'} here will sync (plus images in subfolders up to 2 levels).`
                      : ' — sync will also look for images in subfolders (up to 2 levels).'}
                </p>
              )}

              {mode === 'link' && isSearchMode && folders.length > 0 && (
                <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.4, marginTop: 8 }}>
                  Open a folder from the results, then link it.
                </p>
              )}
            </>
          )}
        </div>

        {error && (
          <div
            style={{
              margin: '0 16px 10px',
              padding: '8px 10px',
              borderRadius: 8,
              background: themed
                ? 'color-mix(in srgb, var(--red) 12%, transparent)'
                : '#fef2f2',
              color: themed ? 'var(--red)' : '#b91c1c',
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            padding: '12px 16px',
            borderTop: themed ? '1px solid var(--border)' : '1px solid #e7e5e4',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button type="button" onClick={onClose} disabled={busy} style={btn}>
            Cancel
          </button>
          {mode === 'import' ? (
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={handleImport}
              style={{
                ...primaryBtn,
                opacity: busy || selected.size === 0 ? 0.55 : 1,
              }}
            >
              {isPending
                ? 'Importing…'
                : `Import ${selected.size || ''}`.trim()}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || isSearchMode || currentFolderId === 'root'}
              onClick={handleLinkFolder}
              style={{
                ...primaryBtn,
                opacity: busy || isSearchMode || currentFolderId === 'root' ? 0.55 : 1,
              }}
            >
              {isPending ? 'Linking…' : 'Link this folder'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
