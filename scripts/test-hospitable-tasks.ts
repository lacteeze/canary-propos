/**
 * Smoke-test Hospitable /v2/tasks against HOSPITABLE_API_PAT.
 * Usage: npx tsx scripts/test-hospitable-tasks.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fetchAllProperties, fetchTasks } from '../src/lib/hospitable/client'
import { isOpenHospitableTask, mapHospitableTasks } from '../src/lib/hospitable/map-tasks'

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq)
      const value = trimmed.slice(eq + 1)
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local optional for CI
  }
}

async function main() {
  loadEnvLocal()
  if (!process.env.HOSPITABLE_API_PAT?.trim()) {
    console.error('HOSPITABLE_API_PAT is not set')
    process.exit(1)
  }

  const properties = await fetchAllProperties()
  console.log(`Properties: ${properties.length}`)

  const start = new Date()
  start.setDate(start.getDate() - 14)
  const end = new Date()
  end.setDate(end.getDate() + 120)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const { tasks, taskTypeLabels } = await fetchTasks({
    propertyIds: properties.map((p) => p.id),
    startDate,
    endDate,
  })
  console.log(`Raw tasks: ${tasks.length}`)
  console.log('Type labels:', taskTypeLabels)

  const mapped = mapHospitableTasks({
    tasks,
    taskTypeLabels,
    hospitableProperties: properties,
    canaryProperties: [],
  })
  const open = mapped.filter(isOpenHospitableTask)
  console.log(`Mapped: ${mapped.length} · open: ${open.length}`)
  for (const t of mapped.slice(0, 5)) {
    console.log(`- ${t.dueDate} · ${t.type} · ${t.status} · ${t.property.slice(0, 40)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
