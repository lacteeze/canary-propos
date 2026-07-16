'use client'

import { displayAccentStyle, fontDisplay } from '@/lib/landing/typography'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LandingHomesBrowse } from '@/components/landing/LandingHomesBrowse'
import {
  HERO_IMAGES,
  REVIEWS,
  SIGN_IN_LINKS,
  STAY_PHOTOS,
  answerFaqQuestion,
  getLandingCopy,
  type LandingLang,
  type LandingStay,
} from '@/lib/landing/content'
import { DEFAULT_STAYS_HREF } from '@/lib/hospitable/map-property-to-stay'
import type { BrowseListing } from '@/lib/listings/browse-types'
import { createClient } from '@/lib/supabase/client'
import './landing-styles.css'

interface LandingPageProps {
  listings: BrowseListing[]
  stays: LandingStay[]
  totalHomes: number
  staysHref: string
  staysCtaHref?: string
}

function isQuestion(text: string) {
  return (
    /\?/.test(text) ||
    /^(what|how|do|does|can|is|are|when|where|why|who|should|will|would|could|combien|quel|quelle|comment)\b/i.test(
      text.trim()
    )
  )
}

function matchListings(query: string, listings: BrowseListing[]) {
  const q = query.toLowerCase()
  const bedM = q.match(/(\d+)\s*(?:\+\s*)?(?:bedrooms?|bed|br|chambres?|ch\.?)\b/)
  const priceM = q.match(/under\s*\$?\s*([\d,]+)/) || q.match(/\$\s*([\d,]+)/)
  const wantsPets = /\bpet|dog|cat|animaux\b/.test(q)
  const free = q
    .replace(/(\d+)\s*(?:\+\s*)?(?:bedrooms?|bed|br|chambres?|ch\.?)\b/g, '')
    .replace(/under\s*\$?[\d,]+/g, '')
    .replace(/\b(pet|dog|cat|animaux)s?\s*(friendly|acceptés?)?\b/g, '')
    .replace(/\b(properties|property|homes?|houses?|apartments?|maisons?|in|st\.?\s*john'?s|nl|for|rent|the|a|with|sous)\b/g, '')
    .trim()

  return listings
    .filter((listing) => {
      if (bedM && !(listing.beds >= parseFloat(bedM[1]))) return false
      if (priceM && !(listing.rentN && listing.rentN <= parseFloat(priceM[1].replace(/,/g, '')))) return false
      if (wantsPets && !listing.petFriendly) return false
      if (free && !`${listing.shortAddress} ${listing.city}`.toLowerCase().includes(free)) return false
      return true
    })
    .slice(0, 6)
}

export function LandingPage({ listings, stays, totalHomes, staysHref, staysCtaHref = DEFAULT_STAYS_HREF }: LandingPageProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [lang, setLang] = useState<LandingLang>('en')
  const [langOpen, setLangOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [hdrSolid, setHdrSolid] = useState(false)
  const [revealP, setRevealP] = useState(0)
  const [heroIdx, setHeroIdx] = useState(0)
  const [heroPrev, setHeroPrev] = useState(-1)
  const [carIdx, setCarIdx] = useState(0)
  const [nlEmail, setNlEmail] = useState('')
  const [nlSent, setNlSent] = useState(false)

  const copy = useMemo(() => getLandingCopy(lang), [lang])
  const dark = theme === 'dark'
  const trimmedQ = q.trim()
  const question = trimmedQ ? isQuestion(trimmedQ) : false
  const results = trimmedQ && !question ? matchListings(trimmedQ, listings) : []
  const hasAnswer = Boolean(searchAnswer) && !searchBusy
  const hasResults = !searchBusy && !hasAnswer && trimmedQ && !question && results.length > 0
  const showSuggestions = !searchBusy && !hasAnswer && !hasResults

  const hdr = {
    hdrBg: hdrSolid ? (dark ? 'rgba(16,13,10,.9)' : 'rgba(253,251,246,.88)') : 'rgba(24,19,12,.18)',
    hdrBorder: hdrSolid ? 'var(--border)' : 'rgba(244,239,230,.14)',
    hdrText: hdrSolid ? 'var(--text)' : '#f4efe6',
    hdrDim: hdrSolid ? 'var(--dim)' : 'rgba(244,239,230,.75)',
    searchBg: hdrSolid ? 'var(--elev)' : 'rgba(244,239,230,.14)',
    searchBorder: hdrSolid ? 'var(--border)' : 'rgba(244,239,230,.3)',
  }

  const revealWords = copy.revealText.split(' ').map((word, index) => {
    const lit = Math.floor(revealP * copy.revealText.split(' ').length)
    return {
      word,
      color: index < lit ? 'var(--text)' : dark ? '#584f3e' : '#cfc4ae',
    }
  })

  const submitSearch = useCallback(async () => {
    const text = trimmedQ
    if (!text) {
      setPanelOpen(true)
      return
    }
    setPanelOpen(true)
    if (isQuestion(text)) {
      setSearchBusy(true)
      setSearchAnswer(null)
      await new Promise((resolve) => setTimeout(resolve, 350))
      setSearchAnswer(answerFaqQuestion(text, lang))
      setSearchBusy(false)
      return
    }
    setSearchAnswer(null)
  }, [lang, trimmedQ])

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('canary_land_theme')
      const savedLang = localStorage.getItem('canary_land_lang')
      if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme)
      if (savedLang === 'fr' || savedLang === 'en') setLang(savedLang)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setSignedIn(!!user)
    })
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const vh = window.innerHeight
      const el = document.getElementById('cl2-reveal')
      let progress = revealP
      if (el) {
        const rect = el.getBoundingClientRect()
        progress = Math.max(0, Math.min(1, (vh * 0.82 - rect.top) / (vh * 0.55)))
      }
      setHdrSolid(y > vh * 0.75)
      setRevealP(progress)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [revealP])

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroPrev(heroIdx)
      setHeroIdx((current) => (current + 1) % HERO_IMAGES.length)
    }, 15000)
    return () => clearInterval(timer)
  }, [heroIdx])

  useEffect(() => {
    const timer = setInterval(() => {
      setCarIdx((current) => (current + 1) % REVIEWS.length)
    }, 6500)
    return () => clearInterval(timer)
  }, [])

  const panelTitle = searchBusy
    ? copy.tPanelWait
    : hasAnswer
      ? copy.tPanelAnswer
      : hasResults
        ? copy.matches(results.length)
        : trimmedQ && !question
          ? copy.tPanelNone
          : copy.tPanelTry

  const searchBtnLabel = question ? copy.tAsk : copy.tSearch
  const review = REVIEWS[carIdx % REVIEWS.length]

  return (
    <div className={`cland2 ${dark ? 'cl2-dark' : ''}`} id="top" style={{ minHeight: '100vh', width: '100%', maxWidth: '100%', background: 'var(--bg)', color: 'var(--text)', fontFamily: "var(--font-instrument-sans), 'Instrument Sans', system-ui, sans-serif", fontSize: '15.5px', lineHeight: 1.55 }}>
      <header data-screen-label="Header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: hdr.hdrBg, borderBottom: `1px solid ${hdr.hdrBorder}`, backdropFilter: 'blur(14px)', transition: 'background .3s, border-color .3s' }}>
        <div style={{ maxWidth: 1380, margin: '0 auto', padding: '12px clamp(16px, 4vw, 26px)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <a href="#top" title="Canary Property Management — home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: hdr.hdrText, flex: 'none' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--yellow)', display: 'grid', placeItems: 'center', flex: 'none' }}>
              <Image src="/landing/logo-black.png" alt="Canary Property Management logo" width={26} height={26} style={{ objectFit: 'contain' }} />
            </span>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>Canary</span>
          </a>

          <nav aria-label="Main" className="cl2-nav" style={{ display: 'flex', gap: 2, flex: 'none' }}>
            {[
              { href: '#homes', label: copy.tNavHomes },
              { href: '#how', label: copy.tNavOwners },
              { href: '#how', label: copy.tNavHow },
              { href: '#faq', label: copy.tNavFaq },
            ].map((item) => (
              <a key={item.label} href={item.href} className="cl2-nav-link" style={{ textDecoration: 'none', color: hdr.hdrDim, fontWeight: 600, fontSize: '13.5px', padding: '7px 11px', borderRadius: 999 }}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="cl2-searchwrap" style={{ flex: '1 1 240px', minWidth: 200, maxWidth: 440, position: 'relative', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: hdr.searchBg, border: `1px solid ${hdr.searchBorder}`, borderRadius: 999, padding: '7px 8px 7px 14px', transition: 'background .3s, border-color .3s' }}>
              <span aria-hidden="true" style={{ color: hdr.hdrDim, fontSize: 14, flex: 'none' }}>⌕</span>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setSearchAnswer(null)
                  setPanelOpen(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitSearch()
                  if (e.key === 'Escape') setPanelOpen(false)
                }}
                onFocus={() => {
                  setPanelOpen(true)
                  setSignInOpen(false)
                }}
                placeholder={copy.tSearchPh}
                aria-label="Search"
                style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: '13.5px', padding: 0, color: hdr.hdrText }}
              />
              <button type="button" className="cl2-btn-yellow" onClick={() => void submitSearch()} style={{ flex: 'none', border: 'none', background: 'var(--yellow)', color: 'var(--yellow-text)', borderRadius: 999, padding: '5px 13px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                {searchBtnLabel}
              </button>
            </div>

            {panelOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, minWidth: 'min(480px, 90vw)', background: 'var(--elev)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 14, boxShadow: 'var(--shadow)', padding: 12, zIndex: 60 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{panelTitle}</span>
                  <button type="button" onClick={() => setPanelOpen(false)} aria-label="Close search" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 13, padding: '2px 6px' }}>✕</button>
                </div>
                {searchBusy && <div style={{ color: 'var(--dim)', fontSize: '13.5px', padding: '6px 4px' }}>{copy.tSearchBusy}</div>}
                {hasAnswer && (
                  <>
                    <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '2px 4px 6px' }}>{searchAnswer}</div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, color: 'var(--faint)', fontSize: 12 }}>
                      {copy.tAnswerFoot} <a href="mailto:info@canarypm.ca" style={{ color: 'var(--accent)' }}>{copy.tEmailUs}</a>.
                    </div>
                  </>
                )}
                {hasResults && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {results.map((result) => (
                      <Link key={result.id} href={result.href} className="cl2-search-result" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 9, textDecoration: 'none', color: 'inherit' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: 'var(--yellow)', flex: 'none' }} />
                        <span style={{ minWidth: 0, flex: 1, fontWeight: 600, fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.shortAddress}</span>
                        <span style={{ flex: 'none', color: 'var(--dim)', fontSize: '12.5px' }}>{result.beds} bd · {result.bathsLabel} ba</span>
                        <span style={{ flex: 'none', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{result.rentFormatted}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {showSuggestions && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {copy.suggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        type="button"
                        className="cl2-suggestion"
                        onClick={() => {
                          setQ(suggestion.q)
                          setSearchAnswer(null)
                          setPanelOpen(true)
                          if (suggestion.ask) void submitSearch()
                        }}
                        style={{ border: '1px solid var(--border)', background: 'var(--panel)', borderRadius: 9, padding: '8px 12px', fontSize: 13, fontWeight: 600, textAlign: 'left', cursor: 'pointer', color: 'var(--dim)' }}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button type="button" className="cl2-hdrctl" onClick={() => {
            const next = dark ? 'light' : 'dark'
            setTheme(next)
            try { localStorage.setItem('canary_land_theme', next) } catch { /* ignore */ }
          }} aria-label="Toggle dark mode" title="Toggle dark mode" style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', border: `1px solid ${hdr.searchBorder}`, background: hdr.searchBg, color: hdr.hdrText, cursor: 'pointer', fontSize: 15, display: 'grid', placeItems: 'center', lineHeight: 1 }}>
            {dark ? '☀' : '☾'}
          </button>

          <div className="cl2-hdrctl" style={{ position: 'relative', flex: 'none' }}>
            <button type="button" onClick={() => { setLangOpen(!langOpen); setSignInOpen(false); setPanelOpen(false) }} aria-label="Change language" title="Change language" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, borderRadius: 999, border: `1px solid ${hdr.searchBorder}`, background: hdr.searchBg, color: hdr.hdrText, cursor: 'pointer', fontWeight: 700, fontSize: '12.5px', padding: '0 12px' }}>
              <span aria-hidden="true" style={{ fontSize: 14 }}>🌐</span>{lang.toUpperCase()}
            </button>
            {langOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 160, background: 'var(--elev)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 14, boxShadow: 'var(--shadow)', padding: 8, zIndex: 60 }}>
                {(['en', 'fr'] as const).map((code) => (
                  <button key={code} type="button" className="cl2-lang-btn" onClick={() => { setLang(code); setLangOpen(false); try { localStorage.setItem('canary_land_lang', code) } catch { /* ignore */ } }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: lang === code ? 'var(--hover)' : 'transparent', borderRadius: 9, padding: '9px 10px', cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', textAlign: 'left', color: 'var(--text)' }}>
                    {code === 'en' ? 'English' : 'Français'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="cl2-hdr-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
            {signedIn ? (
              <Link
                href="/app"
                className="cl2-btn-yellow"
                style={{ border: 'none', background: 'var(--yellow)', color: 'var(--yellow-text)', borderRadius: 999, padding: '9px 18px', fontWeight: 700, fontSize: '13.5px', textDecoration: 'none', display: 'inline-block' }}
              >
                {copy.tOpenApp}
              </Link>
            ) : (
              <div style={{ position: 'relative', flex: 'none' }}>
                <button type="button" className="cl2-btn-yellow" onClick={() => { setSignInOpen(!signInOpen); setPanelOpen(false); setMobileOpen(false) }} style={{ border: 'none', background: 'var(--yellow)', color: 'var(--yellow-text)', borderRadius: 999, padding: '9px 18px', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                  {copy.tSignIn}
                </button>
                {signInOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 230, background: 'var(--elev)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 14, boxShadow: 'var(--shadow)', padding: 8, zIndex: 60 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', padding: '6px 10px 8px' }}>{copy.tPortalTitle}</div>
                    {SIGN_IN_LINKS.map((link) => (
                      <Link key={link.label} href={link.href} className="cl2-portal-link" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, textDecoration: 'none', color: 'inherit', fontWeight: 600, fontSize: '13.5px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: link.dot, flex: 'none' }} />{link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button type="button" className="cl2-burger" onClick={() => { setMobileOpen(!mobileOpen); setSignInOpen(false) }} aria-label="Menu" style={{ flex: 'none', width: 38, height: 38, borderRadius: 10, border: `1px solid ${hdr.searchBorder}`, background: hdr.searchBg, color: hdr.hdrText, cursor: 'pointer', placeItems: 'center', fontSize: 17, lineHeight: 1 }}>
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div style={{ borderTop: `1px solid ${hdr.hdrBorder}`, padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: hdr.searchBg, border: `1px solid ${hdr.searchBorder}`, borderRadius: 999, padding: '7px 8px 7px 14px' }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submitSearch()} placeholder={copy.tSearchPh} aria-label="Search" style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: 14, padding: 0, color: hdr.hdrText }} />
              <button type="button" onClick={() => void submitSearch()} style={{ flex: 'none', border: 'none', background: 'var(--yellow)', color: 'var(--yellow-text)', borderRadius: 999, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{searchBtnLabel}</button>
            </div>
            <nav aria-label="Mobile" style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { href: '#homes', label: copy.tNavHomes },
                { href: '#how', label: copy.tNavOwners },
                { href: '#how', label: copy.tNavHow },
                { href: '#faq', label: copy.tNavFaq },
              ].map((item) => (
                <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: hdr.hdrText, fontWeight: 700, fontSize: 16, padding: '11px 2px', borderBottom: `1px solid ${hdr.hdrBorder}` }}>
                  {item.label}
                </a>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => {
                const next = dark ? 'light' : 'dark'
                setTheme(next)
                try { localStorage.setItem('canary_land_theme', next) } catch { /* ignore */ }
              }}
              aria-label="Toggle dark mode"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '11px 2px',
                border: 'none',
                borderTop: `1px solid ${hdr.hdrBorder}`,
                background: 'transparent',
                color: hdr.hdrText,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 16,
                textAlign: 'left',
              }}
            >
              <span>{dark ? 'Light mode' : 'Dark mode'}</span>
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>{dark ? '☀' : '☾'}</span>
            </button>
          </div>
        )}
      </header>

      <section data-screen-label="Hero" style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden', background: 'var(--ink)', color: 'var(--ink-text)' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {HERO_IMAGES.map((src, index) => {
            const active = index === heroIdx || index === heroPrev
            return (
              <div
                key={src}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url('${src}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center 45%',
                  transform: active ? 'translateX(0%)' : 'translateX(102%)',
                  transition: 'transform 1.2s cubic-bezier(.7,.05,.2,1)',
                  zIndex: index === heroIdx ? 2 : index === heroPrev ? 1 : 0,
                  boxShadow: '-40px 0 70px rgba(0,0,0,.35)',
                }}
              />
            )
          })}
        </div>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(180deg, rgba(24,19,12,.52) 0%, rgba(24,19,12,.30) 38%, rgba(24,19,12,.44) 62%, rgba(24,19,12,.9) 100%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1380, width: '100%', margin: '0 auto', padding: '140px clamp(16px, 4vw, 26px) 46px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, animation: 'cl2fade .9s ease .2s both' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--yellow)', boxShadow: '0 0 0 4px rgba(240,196,69,.25)' }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px', letterSpacing: '.14em', color: 'rgba(244,239,230,.85)' }}>{copy.tHeroBadge}</span>
          </div>
          <h1 style={{ margin: '0 0 26px', fontSize: 'clamp(52px, 8.6vw, 124px)', fontWeight: 700, letterSpacing: '-.035em', lineHeight: 0.98, maxWidth: '14ch' }}>
            <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '.14em', marginBottom: '-.14em' }}><span style={{ display: 'block', animation: 'cl2up .9s cubic-bezier(.2,.7,.2,1) .15s both' }}>{copy.tHero1}</span></span>
            <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '.14em', marginBottom: '-.14em' }}><span style={{ display: 'block', animation: 'cl2up .9s cubic-bezier(.2,.7,.2,1) .3s both' }}><em style={{ ...displayAccentStyle, color: 'var(--yellow)' }}>{copy.tHero2}</em></span></span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 26, flexWrap: 'wrap', animation: 'cl2fade 1s ease .55s both' }}>
            <p style={{ margin: 0, fontSize: 'clamp(16px, 1.6vw, 20px)', lineHeight: 1.55, maxWidth: '46ch', color: 'rgba(244,239,230,.9)' }}>{copy.tHeroSub}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="#homes" className="cl2-btn-hero" style={{ whiteSpace: 'nowrap', textDecoration: 'none', background: 'var(--yellow)', color: 'var(--yellow-text)', borderRadius: 999, padding: '17px 30px', fontWeight: 700, fontSize: '16.5px', boxShadow: '0 10px 30px rgba(240,196,69,.35)' }}>{copy.tHeroCta1}</a>
              <a href="#how" className="cl2-btn-hero" style={{ whiteSpace: 'nowrap', textDecoration: 'none', background: 'rgba(244,239,230,.12)', border: '1px solid rgba(244,239,230,.4)', color: 'var(--ink-text)', borderRadius: 999, padding: '16px 30px', fontWeight: 700, fontSize: '16.5px', backdropFilter: 'blur(6px)' }}>{copy.tHeroCta2}</a>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap', borderTop: '1px solid rgba(244,239,230,.22)', marginTop: 38, paddingTop: 20, animation: 'cl2fade 1s ease .75s both' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 24, letterSpacing: '-.02em' }}>{totalHomes > 0 ? totalHomes : '—'}</span><span style={{ color: 'var(--ink-dim)', fontSize: 13 }}>{copy.tStatHomes}</span></div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 24, letterSpacing: '-.02em' }}>24/7</span><span style={{ color: 'var(--ink-dim)', fontSize: 13 }}>{copy.tStatSupport}</span></div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 24, letterSpacing: '-.02em' }}>{copy.tStatMonthNum}</span><span style={{ color: 'var(--ink-dim)', fontSize: 13 }}>{copy.tStatMonth}</span></div>
            <div aria-hidden="true" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-dim)', fontSize: '12.5px', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '.1em' }}>{copy.tScroll}<span style={{ display: 'inline-block', animation: 'cl2cue 1.8s ease-in-out infinite' }}>↓</span></div>
          </div>
        </div>
      </section>

      <section data-screen-label="Why Canary" style={{ maxWidth: 1380, margin: '0 auto', padding: '130px 26px 110px' }}>
        <div className="cl2-grid2" style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 220px) 1fr', gap: 30, alignItems: 'start' }}>
          <div className="cl2-sticky" style={{ position: 'sticky', top: 110, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--faint)', paddingTop: 10 }}>
            {copy.tWhyKicker}<br /><span aria-hidden="true" style={{ display: 'inline-block', width: 44, height: 2, background: 'var(--yellow)', marginTop: 10 }} />
          </div>
          <p id="cl2-reveal" style={{ margin: 0, fontSize: 'clamp(26px, 3.6vw, 52px)', fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.22, maxWidth: '24ch' }}>
            {revealWords.map((item, index) => (
              <span key={`${item.word}-${index}`} style={{ color: item.color, transition: 'color .35s ease' }}>{item.word} </span>
            ))}
          </p>
        </div>
      </section>

      <section data-screen-label="Rent Own Stay" className="cl2-big-section" style={{ background: 'var(--ink)', color: 'var(--ink-text)' }}>
        <div className="cl2-big-inner">
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--ink-dim)', marginBottom: 26 }}>{copy.tBigKicker}</div>
          {copy.bigRows.map((row) => (
            <a key={row.num} href={row.href} className="cl2-big-row">
              <span className="cl2-big-num">{row.num}</span>
              <span className="cl2-big-word"><span className="cl2-big-title">{row.word}</span><em>{row.tail}</em></span>
              <span className="cl2-big-sub">
                <span className="cl2-big-sub-text">{row.sub}</span>
                <span className="cl2-big-arrow" aria-hidden="true">→</span>
              </span>
            </a>
          ))}
          <div style={{ borderTop: '1px solid var(--ink-border)' }} />
        </div>
        <div aria-hidden="true" style={{ overflow: 'hidden', borderTop: '1px solid var(--ink-border)', padding: '16px 0', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-flex', gap: 0, animation: 'cl2marq 28s linear infinite', willChange: 'transform' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12.5px', letterSpacing: '.18em', color: 'var(--ink-dim)', paddingRight: 0 }}>{copy.marquee}{copy.marquee}</span>
          </div>
        </div>
      </section>

      <section id="homes" data-screen-label="Available homes" style={{ maxWidth: 1380, margin: '0 auto', padding: '96px clamp(16px, 4vw, 26px) 30px', width: '100%', minWidth: 0 }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--faint)', marginBottom: 14 }}>{copy.tHomesKicker}</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(30px, 4.4vw, 54px)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.05 }}>{copy.tHomes1} <em style={displayAccentStyle}>{copy.tHomes2}</em></h2>
        </div>
        <p style={{ margin: '0 0 26px', color: 'var(--dim)', maxWidth: '56ch' }}>{copy.tHomesIntro}</p>
        <LandingHomesBrowse
          listings={listings}
          staysHref={staysHref}
          copy={{
            tBed: copy.tBed,
            tBath: copy.tBath,
            tPark: copy.tPark,
            longTerm: copy.longTerm,
            midTerm: copy.midTerm,
          }}
        />
      </section>

      <section id="stays" data-screen-label="Short-term stays" style={{ background: 'var(--ink)', color: 'var(--ink-text)' }}>
        <div style={{ maxWidth: 1380, margin: '0 auto', padding: '70px clamp(16px, 4vw, 26px) 90px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--ink-dim)', marginBottom: 14 }}>{copy.tStaysKicker}</div>
              <h2 style={{ margin: 0, fontSize: 'clamp(30px, 4.4vw, 54px)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.05 }}>{copy.tStays1} <em style={displayAccentStyle}>{copy.tStays2}</em></h2>
            </div>
            <a href={staysCtaHref} target="_blank" rel="noopener noreferrer" className="cl2-btn-outline" style={{ color: 'var(--ink-text)', border: '1.5px solid rgba(244,239,230,.35)', borderRadius: 999, padding: '12px 22px', fontWeight: 700, textDecoration: 'none', fontSize: '14.5px', whiteSpace: 'nowrap' }}>{copy.tSeeAllStays}</a>
          </div>
          <p style={{ margin: '0 0 26px', color: 'var(--ink-dim)', maxWidth: '56ch' }}>{copy.tStaysIntro}</p>
          <div className="cl2-card-grid">
            {stays.map((stay, index) => (
              <a key={`${stay.short}-${index}`} href={stay.href} target="_blank" rel="noopener noreferrer" className="cl2-card" style={{ textDecoration: 'none', color: 'var(--text)', background: 'var(--elev)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ height: 190, backgroundImage: `url('${stay.photo}')`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                  <span className="cl2-str-pill">{copy.tBookDirect}</span>
                </div>
                <div style={{ padding: '15px 17px 17px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stay.short}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, fontSize: 13, color: 'var(--dim)' }}>
                    <span><b style={{ color: 'var(--text)', fontWeight: 700 }}>{stay.beds}</b> {copy.tBed}</span>
                    <span><b style={{ color: 'var(--text)', fontWeight: 700 }}>{stay.baths}</b> {copy.tBath}</span>
                    {stay.sleeps ? (
                      <span><b style={{ color: 'var(--text)', fontWeight: 700 }}>{stay.sleeps}</b> {copy.sleeps.trim()}</span>
                    ) : null}
                    {stay.extra ? <span>{stay.extra}</span> : null}
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{stay.town}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="how" data-screen-label="How it works" style={{ maxWidth: 1380, margin: '0 auto', padding: '100px clamp(16px, 4vw, 26px) 60px', width: '100%', minWidth: 0 }}>
        <div className="cl2-grid2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: 40, alignItems: 'start', minWidth: 0 }}>
          <div className="cl2-sticky" style={{ position: 'sticky', top: 100 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--faint)', marginBottom: 14 }}>{copy.tOwnKicker}</div>
            <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(30px, 4vw, 50px)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.05 }}>{copy.tOwn1}<br /><em style={displayAccentStyle}>{copy.tOwn2}</em></h2>
            <p style={{ margin: '0 0 22px', color: 'var(--dim)', maxWidth: '38ch' }}>{copy.tOwnSub}</p>
            <a href="mailto:info@canarypm.ca?subject=Management%20inquiry" className="cl2-btn-ink" style={{ display: 'inline-block', textDecoration: 'none', background: 'var(--ink)', color: 'var(--ink-text)', borderRadius: 999, padding: '15px 28px', fontWeight: 700, fontSize: '15.5px' }}>{copy.tOwnCta}</a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {copy.steps.map((step) => (
              <div key={step.num} className="cl2-step" style={{ background: 'var(--elev)', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 28px 26px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: fontDisplay, fontStyle: 'normal', fontWeight: 500, fontSize: 52, lineHeight: 1, color: 'var(--yellow)', flex: 'none', width: 74 }}>{step.num}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 6 }}>{step.title}</div>
                  <div style={{ color: 'var(--dim)', fontSize: '14.5px', maxWidth: '52ch' }}>{step.body}</div>
                </div>
              </div>
            ))}
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '.12em', color: 'var(--faint)', margin: '14px 0 -2px' }}>{copy.tFeeKicker}</div>
            <div className="cl2-services-grid">
              {copy.services.map((service) => (
                <div key={service.name} style={{ background: 'var(--ink)', color: 'var(--ink-text)', borderRadius: 16, padding: '18px 20px' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{service.name}</div>
                  <div style={{ color: 'var(--yellow)', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{service.price}</div>
                  <div style={{ color: 'var(--ink-dim)', fontSize: '12.5px', whiteSpace: 'pre-line' }}>{service.features}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--elev)', border: '1px solid var(--border)', borderRadius: 20, padding: 'clamp(18px, 4vw, 26px) clamp(16px, 4vw, 28px)', marginTop: 6, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '16.5px', marginBottom: 14 }}>{copy.tPlanIncl}</div>
              <div className="cl2-check-grid">
                {copy.checklist.map((item) => (
                  <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '13.5px', color: 'var(--dim)', lineHeight: 1.4 }}>
                    <span aria-hidden="true" style={{ flex: 'none', color: 'var(--green)', fontWeight: 700, marginTop: 1 }}>✓</span>{item}
                  </div>
                ))}
              </div>
            </div>
            <div className="cl2-fee-grid">
              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: '22px 24px' }}>
                <div style={{ fontWeight: 700, fontSize: '15.5px', marginBottom: 8 }}>{copy.tMaintTitle}</div>
                <div style={{ color: 'var(--dim)', fontSize: '13.5px', lineHeight: 1.55 }}>{copy.tMaintBody}</div>
              </div>
              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: '22px 24px' }}>
                <div style={{ fontWeight: 700, fontSize: '15.5px', marginBottom: 8 }}>{copy.tTermsTitle}</div>
                <div style={{ color: 'var(--dim)', fontSize: '13.5px', lineHeight: 1.55 }}>{copy.tTermsBody}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-screen-label="Reviews" style={{ maxWidth: 1380, margin: '0 auto', padding: '80px 26px 110px' }}>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 26, padding: 'clamp(30px, 5vw, 64px)', position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -40, right: 20, fontFamily: fontDisplay, fontStyle: 'normal', fontSize: 280, lineHeight: 1, color: 'var(--hover)', userSelect: 'none' }}>”</div>
          <div style={{ position: 'relative' }}>
            <div aria-hidden="true" style={{ color: 'var(--yellow)', fontSize: 17, letterSpacing: 3, marginBottom: 22 }}>★★★★★</div>
            <blockquote style={{ margin: '0 0 26px', fontSize: 'clamp(22px, 2.8vw, 36px)', fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.3, maxWidth: '30ch', minHeight: '2.6em' }}>&ldquo;{review.quote}&rdquo;</blockquote>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, color: 'var(--dim)', fontSize: '14.5px' }}>— {review.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {REVIEWS.map((_, index) => (
                  <button key={index} type="button" onClick={() => setCarIdx(index)} aria-label={`Go to review ${index + 1}`} style={{ border: `1px solid ${index === carIdx ? 'var(--ink)' : 'var(--border2)'}`, background: index === carIdx ? 'var(--ink)' : 'transparent', color: index === carIdx ? 'var(--ink-text)' : 'var(--dim)', width: 34, height: 34, borderRadius: '50%', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}>
                    {index + 1}
                  </button>
                ))}
                <button type="button" onClick={() => setCarIdx((current) => (current + 1) % REVIEWS.length)} aria-label="Next review" style={{ border: 'none', background: 'var(--ink)', color: 'var(--ink-text)', width: 34, height: 34, borderRadius: '50%', fontSize: 14, cursor: 'pointer' }}>→</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" data-screen-label="FAQ" style={{ maxWidth: 900, margin: '0 auto', padding: '0 26px 90px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px', letterSpacing: '.14em', color: 'var(--faint)', marginBottom: 14 }}>{copy.tFaqKicker}</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(28px, 3.6vw, 44px)', fontWeight: 700, letterSpacing: '-.03em' }}>{copy.tFaqH2}</h2>
        <p style={{ margin: '0 0 24px', color: 'var(--dim)' }}>{copy.tFaqSub} <a href="mailto:info@canarypm.ca" style={{ color: 'var(--accent)', fontWeight: 600 }}>{copy.tEmailUs}</a>.</p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {copy.faqs.map((faq) => (
            <details key={faq.q} style={{ borderTop: '1px solid var(--border)', padding: '0 4px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '16.5px', padding: '19px 0', listStylePosition: 'inside' }}>{faq.q}</summary>
              <p style={{ margin: 0, padding: '0 0 20px', color: 'var(--dim)', fontSize: 15, maxWidth: '70ch' }}>{faq.a}</p>
            </details>
          ))}
          <div style={{ borderTop: '1px solid var(--border)' }} />
        </div>
      </section>

      <footer id="contact" data-screen-label="Footer" style={{ background: 'var(--ink)', color: 'var(--ink-text)', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1380, margin: '0 auto', padding: '70px 26px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 26, flexWrap: 'wrap', borderBottom: '1px solid var(--ink-border)', paddingBottom: 44 }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 700, letterSpacing: '-.025em' }}>{copy.tNlH2}</h2>
              <p style={{ margin: 0, color: 'var(--ink-dim)', fontSize: '14.5px' }}>{copy.tNlSub}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: '0 1 460px', minWidth: 280 }}>
              <input value={nlEmail} onChange={(e) => { setNlEmail(e.target.value); setNlSent(false) }} onKeyDown={(e) => e.key === 'Enter' && /@/.test(nlEmail) && setNlSent(true)} placeholder="you@email.com" aria-label="Email for new-listing alerts" style={{ flex: 1, minWidth: 180, background: 'var(--ink2)', border: '1px solid var(--ink-border)', borderRadius: 999, padding: '14px 20px', outline: 'none', fontSize: '14.5px', color: 'var(--ink-text)' }} />
              <button type="button" onClick={() => /@/.test(nlEmail) && setNlSent(true)} style={{ flex: 'none', border: 'none', background: 'var(--yellow)', color: 'var(--yellow-text)', borderRadius: 999, padding: '14px 26px', fontWeight: 700, fontSize: '14.5px', cursor: 'pointer' }}>{nlSent ? copy.tNlSent : copy.tNlBtn}</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 28, padding: '40px 0 30px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--yellow)', display: 'grid', placeItems: 'center' }}>
                  <Image src="/landing/logo-black.png" alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
                </span>
                <span style={{ fontWeight: 700, fontSize: '15.5px' }}>Canary Property Management</span>
              </div>
              <p style={{ margin: 0, color: 'var(--ink-dim)', fontSize: '13.5px', maxWidth: '28ch' }}>{copy.tFooterBlurb}</p>
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 10 }}>{copy.tContact}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
                <a href="tel:+17092009626" style={{ color: 'var(--ink-text)', textDecoration: 'none', fontWeight: 600 }}>(709) 200-9626</a>
                <a href="mailto:info@canarypm.ca" style={{ color: 'var(--ink-text)', textDecoration: 'none', fontWeight: 600 }}>info@canarypm.ca</a>
                <span style={{ color: 'var(--ink-dim)' }}>St. John&apos;s, NL · Canada</span>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 10 }}>{copy.tHoursHead}</div>
              <div style={{ color: 'var(--ink-dim)', fontSize: 14 }}>{copy.tHours1}<br />{copy.tHours2}<br /><b style={{ color: 'var(--ink-text)' }}>{copy.tHours3}</b></div>
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 10 }}>{copy.tExplore}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
                <a href="#homes" style={{ color: 'var(--ink-text)', textDecoration: 'none', fontWeight: 600 }}>{copy.tLinkHomes}</a>
                <a href="https://airbnb.ca/p/canarypm" style={{ color: 'var(--ink-text)', textDecoration: 'none', fontWeight: 600 }}>{copy.tLinkStays}</a>
                <a href="#faq" style={{ color: 'var(--ink-text)', textDecoration: 'none', fontWeight: 600 }}>{copy.tLinkFaq}</a>
                <Link href="/login" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>{copy.tLinkPortal}</Link>
              </div>
            </div>
          </div>
        </div>
        <div aria-hidden="true" style={{ textAlign: 'center', lineHeight: 0.78, fontWeight: 700, letterSpacing: '-.04em', fontSize: 'clamp(90px, 17.5vw, 300px)', color: 'var(--ink2)', userSelect: 'none', transform: 'translateY(8%)' }}>CANARY</div>
        <div style={{ borderTop: '1px solid var(--ink-border)', padding: '14px 22px', textAlign: 'center', color: 'var(--ink-dim)', fontSize: '12.5px' }}>© 2026 Canary Property Management · St. John&apos;s, Newfoundland &amp; Labrador</div>
      </footer>
    </div>
  )
}