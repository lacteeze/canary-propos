'use client'

// Bulk CSV import view for the CanaryApp (managers/admins only).
// Pick a dataset → download its template → upload a filled CSV →
// preview + validate → import, with per-row error reporting.
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { importCsv, type ImportResult } from '@/app/actions/import'
import {
  IMPORT_ORDER,
  IMPORT_SPECS,
  buildTemplateCsv,
  parseCsvForDataset,
  type ImportDataset,
} from '@/lib/canary/import-specs'

const MONO = "'IBM Plex Mono', monospace"

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 10px',
  marginTop: 4,
}

function downloadTemplate(dataset: ImportDataset) {
  const csv = buildTemplateCsv(dataset)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `canary-${dataset}-template.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function CanaryImport() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dataset, setDataset] = useState<ImportDataset>('people')
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [showColumns, setShowColumns] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const spec = IMPORT_SPECS[dataset]

  const preview = useMemo(() => {
    if (!csvText.trim()) return null
    return parseCsvForDataset(dataset, csvText)
  }, [dataset, csvText])

  const pickDataset = (key: ImportDataset) => {
    setDataset(key)
    setCsvText('')
    setFileName('')
    setResult(null)
    setShowColumns(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onFile = useCallback((file: File | undefined | null) => {
    if (!file) return
    setResult(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result ?? ''))
    reader.readAsText(file)
  }, [])

  const runImport = useCallback(async () => {
    if (!csvText.trim() || busy) return
    setBusy(true)
    setResult(null)
    try {
      const res = await importCsv(dataset, csvText)
      setResult(res)
      if (res.success && res.inserted > 0) router.refresh()
    } catch {
      setResult({ success: false, error: 'Import failed unexpectedly — please try again.' })
    } finally {
      setBusy(false)
    }
  }, [dataset, csvText, busy, router])

  const previewCols = spec.columns.map((c) => c.key)
  const canImport = !!preview && preview.records.length > 0 && preview.missingRequired.length === 0

  return (
    <section>
      <div style={{ color: 'var(--dim)', fontSize: '13.5px', marginBottom: 14, maxWidth: 720 }}>
        Import data in bulk from CSV files. Download the template for a dataset, fill it in a
        spreadsheet, then upload it here. For a fresh setup, import in this order:{' '}
        <b style={{ color: 'var(--text)' }}>{IMPORT_ORDER.map((k) => IMPORT_SPECS[k].label).join(' → ')}</b>{' '}
        so references (owners, properties, tenants) resolve.
      </div>

      {/* dataset picker */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 16 }}>
        {IMPORT_ORDER.map((key, idx) => {
          const s = IMPORT_SPECS[key]
          const active = key === dataset
          return (
            <button
              key={key}
              className="cy-hov-card"
              onClick={() => pickDataset(key)}
              style={{
                textAlign: 'left',
                background: active ? 'var(--elev)' : 'var(--panel)',
                border: `1px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
                borderRadius: 14,
                padding: '13px 14px',
                cursor: 'pointer',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: active ? 'var(--accent)' : 'var(--faint)' }}>{idx + 1}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: active ? 'var(--accent)' : 'var(--text)' }}>{s.label}</span>
              </div>
              <div style={{ color: 'var(--dim)', fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
                {s.columns.filter((c) => c.required).map((c) => c.key).join(', ')}
                {s.columns.some((c) => !c.required) ? ' + optional' : ''}
              </div>
            </button>
          )
        })}
      </div>

      {/* selected dataset panel */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{spec.label}</div>
            <div style={{ color: 'var(--dim)', fontSize: '13px', marginTop: 4, lineHeight: 1.5 }}>{spec.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flex: 'none', flexWrap: 'wrap' }}>
            <button
              className="cy-hov"
              onClick={() => setShowColumns((v) => !v)}
              style={{ border: '1px solid var(--border)', background: 'var(--elev)', color: 'var(--text)', borderRadius: 9, padding: '9px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              {showColumns ? 'Hide columns' : 'View columns'}
            </button>
            <button
              onClick={() => downloadTemplate(dataset)}
              style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 9, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              ⤓ Download template
            </button>
          </div>
        </div>

        {showColumns && (
          <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {spec.columns.map((c) => (
              <div key={c.key} style={{ display: 'flex', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MONO, fontWeight: 600, minWidth: 170 }}>{c.key}</span>
                <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', padding: '2px 7px', borderRadius: 5, background: c.required ? 'var(--accent)' : 'var(--elev)', color: c.required ? 'var(--accent-text)' : 'var(--dim)', border: c.required ? 'none' : '1px solid var(--border)' }}>
                  {c.required ? 'REQUIRED' : 'OPTIONAL'}
                </span>
                <span style={{ color: 'var(--dim)', flex: 1, minWidth: 180 }}>{c.note || '—'}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>{c.example}</span>
              </div>
            ))}
          </div>
        )}

        {/* upload */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}
          style={{ marginTop: 16, border: '1.5px dashed var(--border2)', borderRadius: 12, padding: '22px 16px', textAlign: 'center', background: 'var(--elev)' }}
        >
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
          <div style={{ fontWeight: 650, fontSize: 14 }}>
            {fileName ? fileName : 'Drop your filled CSV here'}
          </div>
          <div style={{ color: 'var(--dim)', fontSize: 12.5, margin: '4px 0 10px' }}>
            {fileName ? `${preview?.records.length ?? 0} data row${(preview?.records.length ?? 0) === 1 ? '' : 's'} detected` : 'or'}
          </div>
          <button
            className="cy-hov"
            onClick={() => fileRef.current?.click()}
            style={{ border: '1px solid var(--border2)', background: 'var(--panel)', color: 'var(--text)', borderRadius: 9, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {fileName ? 'Choose a different file' : 'Browse files'}
          </button>
        </div>

        {/* preview + validation */}
        {preview && (
          <div style={{ marginTop: 14 }}>
            {preview.missingRequired.length > 0 && (
              <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>
                Missing required column{preview.missingRequired.length > 1 ? 's' : ''}:{' '}
                <b style={{ fontFamily: MONO }}>{preview.missingRequired.join(', ')}</b> — download the template for the expected header.
              </div>
            )}
            {preview.unknownColumns.length > 0 && (
              <div style={{ color: 'var(--amber)', fontSize: 13, marginBottom: 10 }}>
                Ignoring unrecognized column{preview.unknownColumns.length > 1 ? 's' : ''}:{' '}
                <span style={{ fontFamily: MONO }}>{preview.unknownColumns.join(', ')}</span>
              </div>
            )}
            {preview.records.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {previewCols.map((c) => (
                        <th key={c} style={{ textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid var(--border)', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', whiteSpace: 'nowrap' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.records.slice(0, 5).map((rec, i) => (
                      <tr key={i}>
                        {previewCols.map((c) => (
                          <td key={c} style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', color: rec[c] ? 'var(--text)' : 'var(--faint)' }}>{rec[c] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.records.length > 5 && (
                  <div style={{ padding: '8px 12px', color: 'var(--dim)', fontSize: 12.5 }}>+ {preview.records.length - 5} more row{preview.records.length - 5 === 1 ? '' : 's'}</div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <button
                onClick={runImport}
                disabled={!canImport || busy}
                style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: canImport && !busy ? 'pointer' : 'default', opacity: canImport && !busy ? 1 : 0.5 }}
              >
                {busy ? 'Importing…' : `Import ${preview.records.length} row${preview.records.length === 1 ? '' : 's'}`}
              </button>
              {busy && <span style={{ color: 'var(--dim)', fontSize: 13 }}>Validating and inserting — large files can take a moment.</span>}
            </div>
          </div>
        )}

        {/* results */}
        {result && (
          <div style={{ marginTop: 14 }}>
            {!result.success ? (
              <div style={{ color: 'var(--red)', fontSize: 13.5 }}>{result.error}</div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>{result.inserted} imported</span>
                  {result.skipped > 0 && <span style={{ color: 'var(--dim)' }}>{result.skipped} skipped (already exist)</span>}
                  {result.errors.length > 0 && <span style={{ color: 'var(--red)', fontWeight: 700 }}>{result.errors.length} failed</span>}
                </div>
                {result.errors.length > 0 && (
                  <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
                    {result.errors.map((e, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                        <span style={{ fontFamily: MONO, color: 'var(--red)', flex: 'none' }}>Line {e.line}</span>
                        <span style={{ color: 'var(--dim)' }}>{e.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 8 }}>
                    Fix the listed lines in your file and re-upload — rows that imported successfully are skipped as duplicates on the next run.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
