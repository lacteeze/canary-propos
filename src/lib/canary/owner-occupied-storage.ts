import type { CanaryOwnerOccupiedBlock } from './types'
import {
  STR_DEFAULT_CHECK_IN_HOUR,
  STR_DEFAULT_CHECK_IN_MINUTE,
  STR_DEFAULT_CHECK_OUT_HOUR,
  STR_DEFAULT_CHECK_OUT_MINUTE,
  resolveTimestampFromFields,
} from './timeline-times'

const STORAGE_PREFIX = 'canary_owner_occupied'

function storageKey(userKey?: string | null): string {
  const user = (userKey || 'anon').trim() || 'anon'
  return `${STORAGE_PREFIX}_${user}`
}

function isValidBlock(v: unknown): v is CanaryOwnerOccupiedBlock {
  if (!v || typeof v !== 'object') return false
  const b = v as CanaryOwnerOccupiedBlock
  return (
    typeof b.id === 'string' &&
    typeof b.property === 'string' &&
    typeof b.start === 'string' &&
    typeof b.end === 'string' &&
    b.source === 'local'
  )
}

export function loadLocalOwnerOccupiedBlocks(userKey?: string | null): CanaryOwnerOccupiedBlock[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(userKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidBlock)
  } catch {
    return []
  }
}

function persistLocal(blocks: CanaryOwnerOccupiedBlock[], userKey?: string | null): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userKey), JSON.stringify(blocks))
  } catch {
    // Quota / private mode
  }
}

function withTimestamps(
  start: string,
  end: string,
  checkInAt?: string,
  checkOutAt?: string
): Pick<CanaryOwnerOccupiedBlock, 'checkInAt' | 'checkOutAt'> {
  return {
    checkInAt:
      checkInAt ??
      resolveTimestampFromFields([], start, STR_DEFAULT_CHECK_IN_HOUR, STR_DEFAULT_CHECK_IN_MINUTE),
    checkOutAt:
      checkOutAt ??
      resolveTimestampFromFields([], end, STR_DEFAULT_CHECK_OUT_HOUR, STR_DEFAULT_CHECK_OUT_MINUTE),
  }
}

export function createLocalOwnerOccupiedBlock(
  input: {
    property: string
    propertyId?: string
    start: string
    end: string
    notes?: string
  },
  userKey?: string | null
): CanaryOwnerOccupiedBlock {
  const existing = loadLocalOwnerOccupiedBlocks(userKey)
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `local:${crypto.randomUUID()}`
      : `local:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const block: CanaryOwnerOccupiedBlock = {
    id,
    property: input.property,
    propertyId: input.propertyId,
    start: input.start,
    end: input.end,
    ...withTimestamps(input.start, input.end),
    notes: input.notes?.trim() ?? '',
    source: 'local',
  }
  persistLocal([...existing, block], userKey)
  return block
}

export function deleteLocalOwnerOccupiedBlock(id: string, userKey?: string | null): void {
  const existing = loadLocalOwnerOccupiedBlocks(userKey)
  persistLocal(existing.filter((b) => b.id !== id), userKey)
}
