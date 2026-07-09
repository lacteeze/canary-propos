'use client'

import React from 'react'
import { MessageSquare, UserRound } from 'lucide-react'
import type { CanaryHospitableTask } from '@/lib/canary/types'
import {
  formatTaskDateTime,
  formatTaskRelativeStart,
  taskAssignmentBadge,
  taskSourceLine,
  taskStatusColor,
  taskTypeTitle,
  teammateInitials,
} from '@/lib/canary/task-detail'

interface TaskDetailDrawerProps {
  task: CanaryHospitableTask | null
  onClose: () => void
  short: (addr: string | null | undefined) => string
  onOpenProperty?: (address: string) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="cy-drawer-section-title">{children}</div>
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="cy-drawer-row">
      <span className="cy-drawer-row-label">{label}</span>
      <span className="cy-drawer-row-value">{value}</span>
    </div>
  )
}

export default function TaskDetailDrawer({ task, onClose, short, onOpenProperty }: TaskDetailDrawerProps) {
  React.useEffect(() => {
    if (!task) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [task, onClose])

  if (!task) return null

  const source = taskSourceLine(task)
  const relativeStart = formatTaskRelativeStart(task.startAt || task.dueDate)
  const assignmentBadge = taskAssignmentBadge(task)
  const hasSchedule = !!(task.startAt?.trim() || task.endAt?.trim() || task.dueDate?.trim())
  const hasGuest =
    (task.guestLabel && task.guestLabel !== '—') ||
    !!task.reservationCode?.trim() ||
    !!task.reservationId?.trim()
  const hasAssignee = !!task.teammate?.trim() || !!assignmentBadge
  const showProgress = !!task.progressStatus?.trim()
  const showAssignment = !!task.assignmentStatus?.trim()

  return (
    <>
      <div onClick={onClose} className="cy-modal-backdrop cy-task-modal-backdrop" aria-hidden="true" />
      <div className="cy-task-modal" role="dialog" aria-modal="true" aria-label="Task details">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div>
            <div className="cy-eyebrow" style={{ marginBottom: 4 }}>Task details</div>
            <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.02em', color: 'var(--purple-text)' }}>
              {taskTypeTitle(task)}
            </div>
            {source && (
              <div style={{ color: 'var(--dim)', fontSize: 13, marginTop: 6, lineHeight: 1.45 }}>{source}</div>
            )}
            {relativeStart && (
              <div style={{ color: 'var(--text)', fontSize: 13, marginTop: 8, fontWeight: 600 }}>{relativeStart}</div>
            )}
          </div>
          <button type="button" className="cy-btn" onClick={onClose} aria-label="Close task details">✕</button>
        </div>

        <div style={{ flex: 1, paddingBottom: 12 }}>
          {/* Property */}
          <div style={{ marginTop: 14 }}>
            <SectionTitle>Property</SectionTitle>
            <button
              type="button"
              className="cy-task-property-card cy-hov-border"
              onClick={() => onOpenProperty?.(task.property)}
              disabled={!onOpenProperty}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--elev)',
                cursor: onOpenProperty ? 'pointer' : 'default',
              }}
            >
              <div
                aria-hidden
                style={{
                  flex: 'none',
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  background: 'color-mix(in srgb, var(--purple) 22%, var(--panel))',
                  border: '1px solid color-mix(in srgb, var(--purple-text) 25%, var(--border))',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 15,
                  color: 'var(--purple-text)',
                }}
              >
                {short(task.property).slice(0, 2).toUpperCase() || '—'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {short(task.property)}
                </div>
                <div style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 2, lineHeight: 1.35 }}>{task.property}</div>
                {task.hospitablePropertyName && task.hospitablePropertyName !== task.property && (
                  <div style={{ color: 'var(--faint)', fontSize: 11.5, marginTop: 4 }}>{task.hospitablePropertyName}</div>
                )}
              </div>
            </button>
          </div>

          {/* Schedule */}
          {hasSchedule && (
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Schedule</SectionTitle>
              {task.startAt?.trim() ? (
                <FieldRow label="Starting at" value={formatTaskDateTime(task.startAt)} />
              ) : task.dueDate?.trim() ? (
                <FieldRow label="Due" value={formatTaskDateTime(`${task.dueDate}T12:00:00`)} />
              ) : null}
              {task.endAt?.trim() ? <FieldRow label="Ending at" value={formatTaskDateTime(task.endAt)} /> : null}
              {task.durationHours != null && task.durationHours > 0 ? (
                <FieldRow label="Duration" value={`${task.durationHours} hour${task.durationHours === 1 ? '' : 's'}`} />
              ) : null}
              {task.timezone?.trim() ? <FieldRow label="Timezone" value={task.timezone} /> : null}
            </div>
          )}

          {/* Assignee */}
          {hasAssignee && (
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Assigned to</SectionTitle>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 4px',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 99,
                    background: 'color-mix(in srgb, var(--accent) 18%, var(--elev))',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    color: 'var(--accent)',
                    flex: 'none',
                  }}
                >
                  {task.teammate ? teammateInitials(task.teammate) : <UserRound size={16} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 650, fontSize: 14 }}>{task.teammate || 'Unassigned'}</div>
                  {assignmentBadge && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 99,
                        background: 'color-mix(in srgb, var(--green) 12%, var(--elev))',
                        border: '1px solid color-mix(in srgb, var(--green) 35%, var(--border))',
                        color: taskStatusColor(assignmentBadge),
                      }}
                    >
                      {assignmentBadge === 'Accepted' ? 'Task accepted' : assignmentBadge}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <button type="button" className="cy-btn" disabled title="Hospitable messaging not integrated yet" style={{ opacity: 0.55 }}>
                  <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  Messages
                </button>
                <button type="button" className="cy-btn" disabled title="Teammate changes require Hospitable API write access" style={{ opacity: 0.55 }}>
                  Change teammate
                </button>
              </div>
            </div>
          )}

          {/* Guest / reservation */}
          {hasGuest && (
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Guest / reservation</SectionTitle>
              {task.guestLabel && task.guestLabel !== '—' ? (
                <FieldRow label="Guest" value={task.guestLabel} />
              ) : null}
              {task.reservationCode?.trim() ? (
                <FieldRow label="Reservation" value={task.reservationCode} />
              ) : null}
            </div>
          )}

          {/* Status */}
          {(showProgress || showAssignment || task.status) && (
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Status</SectionTitle>
              {showProgress ? <FieldRow label="Progress" value={task.progressStatus} /> : null}
              {showAssignment ? <FieldRow label="Assignment" value={task.assignmentStatus} /> : null}
              {!showProgress && !showAssignment && task.status ? (
                <FieldRow label="Status" value={task.status} />
              ) : null}
            </div>
          )}

          {/* Notes */}
          {task.note?.trim() ? (
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Notes</SectionTitle>
              <div
                style={{
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {task.note}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            marginTop: 'auto',
          }}
        >
          <button type="button" className="cy-btn-primary cy-accent-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  )
}
