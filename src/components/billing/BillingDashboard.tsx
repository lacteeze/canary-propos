'use client'

import { useCallback, useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react'
import {
  closePortfolioMonth,
  generateChargesForMonth,
  getBillingDashboard,
  importHospitableStaysCsv,
} from '@/app/actions/billing'

function money(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? ''
    })
    return row
  })
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQ = !inQ
      }
    } else if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

type Dash = Awaited<ReturnType<typeof getBillingDashboard>>

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  marginBottom: 6,
}

const fieldStyle: CSSProperties = {
  width: '100%',
  background: 'var(--elev)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 10px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
}

const panelStyle: CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '16px 18px',
}

const tableWrapStyle: CSSProperties = {
  overflow: 'hidden',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--panel)',
}

const thStyle: CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  background: 'var(--elev)',
  borderBottom: '1px solid var(--border)',
}

const tdStyle: CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  color: 'var(--text)',
  borderTop: '1px solid var(--border)',
}

export function BillingDashboard({
  initialYear,
  initialMonth,
  onOpenPayments,
  onImportPayments,
}: {
  initialYear: number
  initialMonth: number
  /** Prefer in-app navigation over old /payments manager shell */
  onOpenPayments?: () => void
  onImportPayments?: () => void
}) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [portfolioId, setPortfolioId] = useState<string>('')
  const [dash, setDash] = useState<Dash | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [pending, startTransition] = useTransition()
  const [cleaningFlat, setCleaningFlat] = useState('150')
  const [mgmtPct, setMgmtPct] = useState('20')

  const load = useCallback(() => {
    startTransition(async () => {
      setErr('')
      const data = await getBillingDashboard({
        year,
        month,
        portfolioId: portfolioId || null,
      })
      setDash(data)
      if (!portfolioId && data.portfolios[0]) {
        setPortfolioId(data.portfolios[0].id)
      }
    })
  }, [year, month, portfolioId])

  useEffect(() => {
    load()
  }, [load])

  const summary = dash?.portfolioSummary
  const netLabel = useMemo(() => {
    if (!summary) return '—'
    if (summary.direction === 'collect') return `Collect ${money(Math.abs(summary.net))}`
    if (summary.direction === 'disburse') return `Disburse ${money(summary.net)}`
    return 'Balanced'
  }, [summary])

  const netColor =
    summary?.direction === 'collect'
      ? 'var(--red)'
      : summary?.direction === 'disburse'
        ? 'var(--green)'
        : 'var(--text)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Billing</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--dim)', lineHeight: 1.45 }}>
            Portfolio balances, lease arrears, STR stays, and month close.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {onOpenPayments ? (
            <button type="button" className="cy-btn-ghost" onClick={onOpenPayments}>
              Payments ledger
            </button>
          ) : null}
          {onImportPayments ? (
            <button type="button" className="cy-btn-ghost" onClick={onImportPayments}>
              Import payments CSV
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ ...panelStyle, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        <label style={{ fontSize: 13 }}>
          <span style={labelStyle}>Year</span>
          <input
            type="number"
            style={{ ...fieldStyle, width: 96 }}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          <span style={labelStyle}>Month</span>
          <select
            style={{ ...fieldStyle, width: 88 }}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, minWidth: 200, flex: '1 1 200px' }}>
          <span style={labelStyle}>Portfolio</span>
          <select
            style={fieldStyle}
            value={portfolioId}
            onChange={(e) => setPortfolioId(e.target.value)}
          >
            {(dash?.portfolios ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="cy-btn-primary cy-accent-btn" disabled={pending} onClick={() => load()}>
          Refresh
        </button>
        <button
          type="button"
          className="cy-btn-ghost"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              setMsg('')
              setErr('')
              const res = await generateChargesForMonth(year, month)
              if (!res.success) setErr(res.error)
              else setMsg(`Rent charges: ${res.created ?? 0} created, ${res.skipped ?? 0} skipped.`)
              load()
            })
          }}
        >
          Generate rent charges
        </button>
      </div>

      {msg ? <p style={{ margin: 0, fontSize: 13, color: 'var(--green)' }}>{msg}</p> : null}
      {err ? <p style={{ margin: 0, fontSize: 13, color: 'var(--red)' }}>{err}</p> : null}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div style={panelStyle}>
          <div style={labelStyle}>Portfolio net</div>
          <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: netColor }}>{netLabel}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--dim)' }}>
            {summary?.alreadyClosed ? 'Month closed' : 'Open period'}
          </div>
        </div>
        <div style={panelStyle}>
          <div style={labelStyle}>Rent collected</div>
          <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {money(summary?.rentCollected ?? 0)}
          </div>
        </div>
        <div style={panelStyle}>
          <div style={labelStyle}>Expenses + fees</div>
          <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {money((summary?.totalExpenses ?? 0) + (summary?.managementFees ?? 0))}
          </div>
        </div>
      </div>

      {summary && portfolioId ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="cy-btn-primary cy-accent-btn"
            disabled={pending || summary.alreadyClosed}
            onClick={() => {
              startTransition(async () => {
                setMsg('')
                setErr('')
                const res = await closePortfolioMonth({ portfolioId, year, month })
                if (!res.success) setErr(res.error)
                else {
                  setMsg(
                    `Month closed — ${res.direction === 'collect' ? 'collect' : 'disburse'} ${money(res.net)}.`,
                  )
                }
                load()
              })
            }}
          >
            Close month
          </button>
          <a
            href={`/api/statements/export?scope=portfolio&id=${portfolioId}&year=${year}&month=${month}&format=pdf`}
            className="cy-btn-ghost"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            PDF statement
          </a>
          <a
            href={`/api/statements/export?scope=portfolio&id=${portfolioId}&year=${year}&month=${month}&format=csv`}
            className="cy-btn-ghost"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            CSV statement
          </a>
        </div>
      ) : null}

      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          Property balances
        </h3>
        <div style={tableWrapStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={thStyle}>Property</th>
                <th style={thStyle}>Rent</th>
                <th style={thStyle}>Expenses</th>
                <th style={thStyle}>STR net</th>
                <th style={thStyle}>Net</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {(summary?.properties ?? []).map((p) => (
                <tr key={p.propertyId}>
                  <td style={tdStyle}>{p.propertyAddress}</td>
                  <td style={tdStyle}>{money(p.rentCollected)}</td>
                  <td style={tdStyle}>{money(p.totalExpenses)}</td>
                  <td style={tdStyle}>{money(p.strNetToOwner)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{money(p.net)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <a
                      className="cy-btn-ghost"
                      style={{ fontSize: 12, textDecoration: 'none', padding: '4px 8px' }}
                      href={`/api/statements/export?scope=property&id=${p.propertyId}&year=${year}&month=${month}&format=csv`}
                    >
                      CSV
                    </a>
                  </td>
                </tr>
              ))}
              {!summary?.properties?.length ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--dim)', padding: 28 }}>
                    No properties in this portfolio for the period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          Lease balances (outstanding rent)
        </h3>
        <div style={tableWrapStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={thStyle}>Property</th>
                <th style={thStyle}>Tenant</th>
                <th style={thStyle}>Balance</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {(dash?.leaseBalances ?? []).map((l) => (
                <tr key={l.leaseId}>
                  <td style={tdStyle}>{l.property}</td>
                  <td style={tdStyle}>{l.tenant}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--amber)' }}>{money(l.balance)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <a
                      className="cy-btn-ghost"
                      style={{ fontSize: 12, textDecoration: 'none', padding: '4px 8px' }}
                      href={`/api/statements/export?scope=lease&id=${l.leaseId}&year=${year}&month=${month}&format=csv`}
                    >
                      Statement CSV
                    </a>
                  </td>
                </tr>
              ))}
              {!dash?.leaseBalances?.length ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--dim)', padding: 28 }}>
                    No outstanding lease balances (generate rent charges if needed).
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          Project balances
        </h3>
        <div style={tableWrapStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={thStyle}>Project</th>
                <th style={thStyle}>Property</th>
                <th style={thStyle}>Billed</th>
                <th style={thStyle}>Estimate</th>
              </tr>
            </thead>
            <tbody>
              {(dash?.projectBalances ?? []).map((p) => (
                <tr key={p.projectId}>
                  <td style={tdStyle}>{p.name}</td>
                  <td style={tdStyle}>{p.property}</td>
                  <td style={tdStyle}>{money(p.billed)}</td>
                  <td style={tdStyle}>{p.estimate != null ? money(p.estimate) : '—'}</td>
                </tr>
              ))}
              {!dash?.projectBalances?.length ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--dim)', padding: 28 }}>
                    No open projects.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={panelStyle}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          Import Hospitable stays CSV
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--dim)', lineHeight: 1.45 }}>
          Columns: reservation_code, property / address or hospitable_property_id, check_out, gross_amount.
          Cleaning and management fees use defaults below unless provided per row.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>
            <span style={labelStyle}>Default cleaning fee ($)</span>
            <input
              style={{ ...fieldStyle, width: 120 }}
              value={cleaningFlat}
              onChange={(e) => setCleaningFlat(e.target.value)}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            <span style={labelStyle}>Default mgmt fee (%)</span>
            <input
              style={{ ...fieldStyle, width: 120 }}
              value={mgmtPct}
              onChange={(e) => setMgmtPct(e.target.value)}
            />
          </label>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          style={{ fontSize: 13, color: 'var(--dim)' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            startTransition(async () => {
              setMsg('')
              setErr('')
              const text = await file.text()
              const rows = parseCsv(text)
              const res = await importHospitableStaysCsv(rows, {
                cleaningFeeFlat: Number(cleaningFlat) || 0,
                managementFeePercent: Number(mgmtPct) || 0,
              })
              if (!res.success) setErr(res.error)
              else {
                setMsg(`Imported ${res.imported} stays (${res.skipped} skipped).`)
                if (res.errors.length) setErr(res.errors.slice(0, 3).join(' · '))
              }
              load()
            })
          }}
        />
      </section>
    </div>
  )
}
