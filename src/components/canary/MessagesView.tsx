'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getOrCreateDirectThread,
  getOrCreatePropertyThread,
  getThreadMessages,
  listChatThreads,
  listStaffForDm,
  sendChatMessage,
  type ChatMessage,
  type ChatThread,
} from '@/app/actions/chat'

const MONO = "var(--font-instrument-sans), 'Instrument Sans', system-ui, sans-serif"

interface MessagesViewProps {
  initialThreadId?: string | null
  onCloseDrawer?: () => void
}

export default function MessagesView({ initialThreadId }: MessagesViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewDm, setShowNewDm] = useState(false)
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const refreshThreads = useCallback(async () => {
    const t = await listChatThreads()
    setThreads(t)
    return t
  }, [])

  const loadMessages = useCallback(async (threadId: string) => {
    const msgs = await getThreadMessages(threadId)
    setMessages(msgs)
  }, [])

  useEffect(() => {
    refreshThreads().finally(() => setLoading(false))
    listStaffForDm().then(setStaff)
  }, [refreshThreads])

  useEffect(() => {
    if (initialThreadId) {
      setActiveThreadId(initialThreadId)
      setMobileShowChat(true)
    }
  }, [initialThreadId])

  useEffect(() => {
    if (activeThreadId) loadMessages(activeThreadId)
  }, [activeThreadId, loadMessages])

  const selectThread = (id: string) => {
    setActiveThreadId(id)
    setMobileShowChat(true)
  }

  const handleSend = () => {
    if (!activeThreadId || !input.trim()) return
    const body = input.trim()
    setInput('')
    startTransition(async () => {
      const res = await sendChatMessage(activeThreadId, body)
      if (res.success) {
        await loadMessages(activeThreadId)
        await refreshThreads()
        router.refresh()
      }
    })
  }

  const startDm = (personId: string) => {
    startTransition(async () => {
      const res = await getOrCreateDirectThread(personId)
      if (res.success && res.data) {
        setShowNewDm(false)
        const t = await refreshThreads()
        setActiveThreadId(res.data.threadId)
        setMobileShowChat(true)
        if (!t.find((x) => x.id === res.data!.threadId)) {
          await refreshThreads()
        }
      }
    })
  }

  const activeThread = threads.find((t) => t.id === activeThreadId)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', minHeight: 400, gap: 0, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--panel)' }}>
      {/* Thread list */}
      <div
        style={{
          flex: '0 0 280px',
          borderRight: '1px solid var(--border)',
          display: mobileShowChat ? 'none' : 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
        className="cnry-messages-list"
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Messages</span>
          <button
            type="button"
            onClick={() => setShowNewDm(true)}
            className="cy-accent-btn"
            style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 8, padding: '5px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            + DM
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div style={{ padding: 16, color: 'var(--dim)', fontSize: 13 }}>Loading…</div>}
          {!loading && !threads.length && (
            <div style={{ padding: 16, color: 'var(--dim)', fontSize: 13 }}>No conversations yet. Open a property detail to start a property chat, or send a direct message.</div>
          )}
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              className="cy-hov"
              onClick={() => selectThread(t.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: activeThreadId === t.id ? 'var(--elev)' : 'transparent',
                cursor: 'pointer',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontFamily: MONO, color: 'var(--faint)', textTransform: 'uppercase' }}>
                  {t.type === 'property' ? '🏠' : '💬'}
                </span>
                <span style={{ fontWeight: 650, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              </div>
              {t.lastMessagePreview && (
                <div style={{ color: 'var(--dim)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastMessagePreview}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Message pane */}
      <div
        style={{
          flex: 1,
          display: activeThreadId ? 'flex' : 'none',
          flexDirection: 'column',
          minWidth: 0,
        }}
        className="cnry-messages-pane"
      >
        {activeThread && (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="cnry-mobile-back"
                onClick={() => setMobileShowChat(false)}
                style={{ display: 'none', border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: 'var(--dim)' }}
              >
                ←
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{activeThread.title}</div>
                <div style={{ color: 'var(--faint)', fontSize: 12, fontFamily: MONO }}>
                  {activeThread.type === 'property' ? 'Property chat' : 'Direct message'}
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.isOwn ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: m.isOwn ? 'var(--accent)' : 'var(--elev)',
                    color: m.isOwn ? 'var(--accent-text)' : 'var(--text)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    border: m.isOwn ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {!m.isOwn && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: 0.8 }}>{m.authorName}</div>}
                  <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                  <div style={{ fontSize: 10, fontFamily: MONO, marginTop: 4, opacity: 0.6 }}>
                    {new Date(m.createdAt).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              {!messages.length && <div style={{ color: 'var(--dim)', textAlign: 'center', marginTop: 40 }}>No messages yet — say hello!</div>}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Type a message…"
                style={{ flex: 1, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', outline: 'none' }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="cy-accent-btn"
                style={{ border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', opacity: input.trim() ? 1 : 0.5 }}
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>

      {!activeThreadId && !loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)' }} className="cnry-messages-empty">
          Select a conversation
        </div>
      )}

      {/* New DM modal */}
      {showNewDm && (
        <>
          <div onClick={() => setShowNewDm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,6,.55)', zIndex: 80 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(360px,94vw)', background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 14, zIndex: 81, padding: 20, boxShadow: 'var(--shadow)' }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>New direct message</div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {staff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="cy-hov"
                  onClick={() => startDm(s.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: '10px 8px', borderRadius: 8, fontWeight: 600 }}
                >
                  {s.name}
                </button>
              ))}
              {!staff.length && <div style={{ color: 'var(--dim)', fontSize: 13 }}>No other staff members found.</div>}
            </div>
            <button type="button" onClick={() => setShowNewDm(false)} style={{ marginTop: 12, border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'var(--dim)' }}>Cancel</button>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 720px) {
          .cnry-messages-list { flex: 1 !important; display: flex !important; }
          .cnry-messages-pane { display: flex !important; }
          .cnry-messages-list:has(+ .cnry-messages-pane[style*="flex: 1"]) { }
          .cnry-messages-pane .cnry-mobile-back { display: block !important; }
          .cnry-messages-empty { display: none !important; }
        }
        @media (max-width: 720px) {
          .cnry-messages-list { display: ${mobileShowChat ? 'none' : 'flex'} !important; }
          .cnry-messages-pane { display: ${mobileShowChat && activeThreadId ? 'flex' : 'none'} !important; flex: 1 !important; }
        }
      `}</style>
    </div>
  )
}