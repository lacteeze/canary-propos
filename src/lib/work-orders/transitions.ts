// src/lib/work-orders/transitions.ts
// Single source of truth for all valid work order state transitions.
// No state validation logic should live outside this file.

export type WorkOrderStatus =
  | 'draft'
  | 'submitted'
  | 'assigned'
  | 'in_progress'
  | 'pending_approval'
  | 'approved'
  | 'completed'
  | 'closed'

export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent'

export type AllowedRole = 'manager' | 'tenant' | 'employee' | 'vendor_token'

export type TransitionRule = {
  allowedFrom: WorkOrderStatus[]
  allowedRoles: AllowedRole[]
  requiredFields?: string[]
}

/**
 * TRANSITIONS — the single source of truth for the work order state machine.
 *
 * Each key is the TARGET state. The rule defines:
 * - allowedFrom: which states may precede this transition
 * - allowedRoles: which caller roles may trigger this transition
 * - requiredFields: (optional) fields that must be present in the update payload
 *
 * $500 gate is enforced in updateWorkOrderStatus server action — it substitutes
 * 'pending_approval' for 'assigned' when estimated_cost > 500. The TRANSITIONS
 * map itself does not encode the gate; the action layer applies it.
 */
export const TRANSITIONS: Record<WorkOrderStatus, TransitionRule> = {
  draft: {
    // draft is the initial state — created directly, not transitioned to
    allowedFrom: [],
    allowedRoles: ['manager', 'tenant', 'employee'],
  },
  submitted: {
    allowedFrom: ['draft'],
    allowedRoles: ['manager', 'tenant', 'employee'],
  },
  assigned: {
    allowedFrom: ['submitted', 'approved'],
    allowedRoles: ['manager'],
    requiredFields: ['assigned_vendor_id', 'estimated_cost'],
  },
  in_progress: {
    allowedFrom: ['assigned'],
    allowedRoles: ['manager', 'vendor_token'],
  },
  pending_approval: {
    allowedFrom: ['submitted'],
    allowedRoles: ['manager'],
    requiredFields: ['assigned_vendor_id', 'estimated_cost'],
  },
  approved: {
    allowedFrom: ['pending_approval'],
    allowedRoles: ['manager'],
  },
  completed: {
    allowedFrom: ['in_progress'],
    allowedRoles: ['manager', 'vendor_token'],
  },
  closed: {
    allowedFrom: ['completed', 'pending_approval'],
    allowedRoles: ['manager'],
  },
}

/**
 * validateTransition — checks whether a state transition is permitted.
 *
 * @param from - current work order status
 * @param to - desired target status
 * @param callerRoles - array of roles the caller holds (e.g. ctx.person.role)
 * @returns { valid: true } or { valid: false, error: string }
 */
export function validateTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  callerRoles: string[]
): { valid: true } | { valid: false; error: string } {
  const rule = TRANSITIONS[to]

  // Check that the current state is an allowed predecessor
  if (!rule.allowedFrom.includes(from)) {
    return {
      valid: false,
      error: `Cannot transition from '${from}' to '${to}'. Allowed predecessors: [${rule.allowedFrom.join(', ') || 'none'}].`,
    }
  }

  // Check that the caller has at least one of the allowed roles
  const hasRole = rule.allowedRoles.some((r) => callerRoles.includes(r))
  if (!hasRole) {
    return {
      valid: false,
      error: `Role(s) [${callerRoles.join(', ')}] not permitted to transition to '${to}'. Required role: [${rule.allowedRoles.join(' | ')}].`,
    }
  }

  return { valid: true }
}
