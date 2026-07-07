// src/lib/canary/audit.ts
// Shared audit-log writer for entity mutations.
import type { SupabaseClient } from '@supabase/supabase-js'

export async function writeAuditEntries(
  supabase: SupabaseClient,
  orgId: string,
  tableName: string,
  recordId: string,
  changedBy: string,
  changes: { field: string; oldValue: string | null; newValue: string | null }[]
): Promise<void> {
  const rows = changes
    .filter((c) => c.oldValue !== c.newValue)
    .map((c) => ({
      org_id: orgId,
      table_name: tableName,
      record_id: recordId,
      field_name: c.field,
      old_value: c.oldValue,
      new_value: c.newValue,
      changed_by: changedBy,
    }))
  if (!rows.length) return
  const { error } = await supabase.from('audit_log').insert(rows)
  if (error) console.error('[writeAuditEntries]', error)
}

export function str(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v)
}
