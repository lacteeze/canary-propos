'use client'

// Browse Google Drive folders/images and import (or link folder) for a property.

import React, { useEffect, useState, useTransition } from 'react'
import {
  importDriveFilesToProperty,
  linkPropertyDriveFolder,
  listDriveFolderItems,
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
  const [isPending, startTransition] = useTransition()

  const currentFolderId = crumbs[crumbs.length - 1]?.id ?? 'root'

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setError(null)
    setCrumbs([{ id: 'root', name: 'My Drive' }])
    void loadFolder('root')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function loadFolder(folderId: string) {
    setLoading(true)
    setError(null)
    const result = await listDriveFolderItems(folderId === 'root' ? null : folderId)
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      setItems([])
      return
    }
    setItems(result.items)
  }

  function enterFolder(item: DriveListItem) {
    if (!item.isFolder) return
    setSelected(new Set())
    setCrumbs((prev) => [...prev, { id: item.id, name: item.name }])
    void loadFolder(item.id)
  }

  function goToCrumb(index: number) {
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
                ? 'Navigate into a folder, then link it for non-recursive photo sync.'
                : `Multi-select images to add as ${visibility} photos.`}
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
                disabled={busy || i === crumbs.length - 1}
                onClick={() => goToCrumb(i)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: themed ? 'var(--accent)' : '#b45309',
                  cursor: i === crumbs.length - 1 ? 'default' : 'pointer',
                  fontWeight: i === crumbs.length - 1 ? 700 : 500,
                  padding: 0,
                }}
              >
                {c.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {loading ? (
            <p style={{ padding: 12, fontSize: 13, opacity: 0.7 }}>Loading…</p>
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

              {mode === 'import' && (
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
                    Images
                  </div>
                  {images.length === 0 ? (
                    <p style={{ fontSize: 13, opacity: 0.65 }}>No images in this folder.</p>
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
                        return (
                          <button
                            key={img.id}
                            type="button"
                            disabled={busy}
                            onClick={() => toggleSelect(img.id)}
                            style={{
                              border: isSelected
                                ? themed
                                  ? '1.5px solid var(--accent)'
                                  : '1.5px solid #d97706'
                                : themed
                                  ? '1px solid var(--border)'
                                  : '1px solid #e7e5e4',
                              borderRadius: 10,
                              padding: 8,
                              background: themed ? 'var(--bg)' : '#fafaf9',
                              cursor: 'pointer',
                              textAlign: 'left',
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
                              {img.thumbnailLink ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={img.thumbnailLink}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  referrerPolicy="no-referrer"
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
                              {isSelected ? '✓ ' : ''}
                              {img.name}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {mode === 'link' && (
                <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.4 }}>
                  Current folder: <strong>{crumbs[crumbs.length - 1]?.name}</strong>
                  {currentFolderId === 'root'
                    ? ' — open a specific folder to link it.'
                    : ' — only image files directly in this folder will sync (not subfolders).'}
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
              disabled={busy || currentFolderId === 'root'}
              onClick={handleLinkFolder}
              style={{
                ...primaryBtn,
                opacity: busy || currentFolderId === 'root' ? 0.55 : 1,
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
