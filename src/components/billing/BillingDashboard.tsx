'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
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

export function BillingDashboard({
  initialYear,
  initialMonth,
}: {
  initialYear: number
  initialMonth: number
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Billing</h1>
          <p className="mt-1 text-sm text-stone-500">
            Portfolio balances, lease arrears, STR stays, and month close.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/payments"
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Payments table
          </Link>
          <Link
            href="/app?import=payments"
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Import payments CSV
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-stone-500">Year</span>
          <input
            type="number"
            className="w-24 rounded-md border border-stone-200 px-2 py-1.5"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-stone-500">Month</span>
          <select
            className="rounded-md border border-stone-200 px-2 py-1.5"
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
        <label className="text-sm min-w-[200px]">
          <span className="mb-1 block text-stone-500">Portfolio</span>
          <select
            className="w-full rounded-md border border-stone-200 px-2 py-1.5"
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
        <button
          type="button"
          disabled={pending}
          onClick={() => load()}
          className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
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
          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700"
        >
          Generate rent charges
        </button>
      </div>

      {msg ? <p className="mb-3 text-sm text-green-700">{msg}</p> : null}
      {err ? <p className="mb-3 text-sm text-red-700">{err}</p> : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Portfolio net</div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">{netLabel}</div>
          <div className="mt-1 text-xs text-stone-500">
            {summary?.alreadyClosed ? 'Month closed' : 'Open period'}
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Rent collected</div>
          <div className="mt-2 text-2xl font-semibold">{money(summary?.rentCollected ?? 0)}</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Expenses + fees</div>
          <div className="mt-2 text-2xl font-semibold">
            {money((summary?.totalExpenses ?? 0) + (summary?.managementFees ?? 0))}
          </div>
        </div>
      </div>

      {summary && portfolioId ? (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || summary.alreadyClosed}
            onClick={() => {
              startTransition(async () => {
                setMsg('')
                setErr('')
                const res = await closePortfolioMonth({ portfolioId, year, month })
                if (!res.success) setErr(res.error)
                else {
                  setMsg(
                    `Month closed — ${res.direction === 'collect' ? 'collect' : 'disburse'} ${money(res.net)}.`
                  )
                }
                load()
              })
            }}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Close month
          </button>
          <a
            href={`/api/statements/export?scope=portfolio&id=${portfolioId}&year=${year}&month=${month}&format=pdf`}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700"
          >
            PDF statement
          </a>
          <a
            href={`/api/statements/export?scope=portfolio&id=${portfolioId}&year=${year}&month=${month}&format=csv`}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700"
          >
            CSV statement
          </a>
        </div>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-stone-900">Property balances</h2>
        <div className="overflow-hidden rounded-xl border border-stone-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-2">Property</th>
                <th className="px-4 py-2">Rent</th>
                <th className="px-4 py-2">Expenses</th>
                <th className="px-4 py-2">STR net</th>
                <th className="px-4 py-2">Net</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(summary?.properties ?? []).map((p) => (
                <tr key={p.propertyId} className="border-t border-stone-100">
                  <td className="px-4 py-2">{p.propertyAddress}</td>
                  <td className="px-4 py-2">{money(p.rentCollected)}</td>
                  <td className="px-4 py-2">{money(p.totalExpenses)}</td>
                  <td className="px-4 py-2">{money(p.strNetToOwner)}</td>
                  <td className="px-4 py-2 font-medium">{money(p.net)}</td>
                  <td className="px-4 py-2 text-right">
                    <a
                      className="text-xs text-stone-600 underline"
                      href={`/api/statements/export?scope=property&id=${p.propertyId}&year=${year}&month=${month}&format=csv`}
                    >
                      CSV
                    </a>
                  </td>
                </tr>
              ))}
              {!summary?.properties?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                    No properties in this portfolio for the period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-stone-900">Lease balances (outstanding rent)</h2>
        <div className="overflow-hidden rounded-xl border border-stone-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-2">Property</th>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Balance</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(dash?.leaseBalances ?? []).map((l) => (
                <tr key={l.leaseId} className="border-t border-stone-100">
                  <td className="px-4 py-2">{l.property}</td>
                  <td className="px-4 py-2">{l.tenant}</td>
                  <td className="px-4 py-2 font-medium text-amber-800">{money(l.balance)}</td>
                  <td className="px-4 py-2 text-right">
                    <a
                      className="text-xs text-stone-600 underline"
                      href={`/api/statements/export?scope=lease&id=${l.leaseId}&year=${year}&month=${month}&format=csv`}
                    >
                      Statement CSV
                    </a>
                  </td>
                </tr>
              ))}
              {!dash?.leaseBalances?.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                    No outstanding lease balances (generate rent charges if needed).
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-stone-900">Project balances</h2>
        <div className="overflow-hidden rounded-xl border border-stone-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Property</th>
                <th className="px-4 py-2">Billed</th>
                <th className="px-4 py-2">Estimate</th>
              </tr>
            </thead>
            <tbody>
              {(dash?.projectBalances ?? []).map((p) => (
                <tr key={p.projectId} className="border-t border-stone-100">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2">{p.property}</td>
                  <td className="px-4 py-2">{money(p.billed)}</td>
                  <td className="px-4 py-2">{p.estimate != null ? money(p.estimate) : '—'}</td>
                </tr>
              ))}
              {!dash?.projectBalances?.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                    No open projects.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-1 text-base font-semibold text-stone-900">Import Hospitable stays CSV</h2>
        <p className="mb-4 text-sm text-stone-500">
          Columns: reservation_code, property / address or hospitable_property_id, check_out, gross_amount.
          Cleaning and management fees use defaults below unless provided per row.
        </p>
        <div className="mb-3 flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Default cleaning fee ($)</span>
            <input
              className="w-28 rounded-md border border-stone-200 px-2 py-1.5"
              value={cleaningFlat}
              onChange={(e) => setCleaningFlat(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Default mgmt fee (%)</span>
            <input
              className="w-28 rounded-md border border-stone-200 px-2 py-1.5"
              value={mgmtPct}
              onChange={(e) => setMgmtPct(e.target.value)}
            />
          </label>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
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
