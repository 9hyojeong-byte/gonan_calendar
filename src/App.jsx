import { useState, useEffect, useRef } from 'react'

// ── 디자인 토큰 ───────────────────────────────────────────────
const C = {
  bg:          '#fdfbf7',
  text:        '#2d2d2d',
  muted:       '#e5e0d8',
  accent:      '#ff4d4d',
  accentBlue:  '#2d5da1',
  border:      '#2d2d2d',
  white:       '#ffffff',
  yellow:      '#fff9c4',
  danger:      '#ff4d4d',
}

// 울퉁불퉁한 border-radius 모음
const R = {
  wobbly:   '255px 15px 225px 15px / 15px 225px 15px 255px',
  wobblyMd: '30px 8px 28px 6px / 6px 28px 8px 30px',
  wobblyLg: '40px 10px 36px 10px / 10px 36px 10px 40px',
  tag:      '8px 2px 8px 2px / 2px 8px 2px 8px',
}

// 하드 오프셋 그림자
const S = {
  base:  '4px 4px 0px 0px #2d2d2d',
  large: '6px 6px 0px 0px #2d2d2d',
  small: '3px 3px 0px 0px #2d2d2d',
  soft:  '3px 3px 0px 0px rgba(45,45,45,0.15)',
}

// ── PWA ──────────────────────────────────────────────────────
function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa_install_dismissed') === '1'
  )
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true

  useEffect(() => {
    if (isInstalled || dismissed) return
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isInstalled, dismissed])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') dismiss()
    else setPrompt(null)
  }
  const dismiss = () => {
    localStorage.setItem('pwa_install_dismissed', '1')
    setDismissed(true); setPrompt(null)
  }
  return { show: !isInstalled && !dismissed && (prompt || isIOS), isIOS, install, dismiss }
}

function InstallBanner({ isIOS, onInstall, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 9999,
      background: C.yellow, border: `3px solid ${C.border}`,
      borderRadius: R.wobblyMd, boxShadow: S.large,
      padding: '14px 16px', maxWidth: 456, margin: '0 auto',
      transform: 'rotate(-0.5deg)',
    }}>
      {/* 테이프 장식 */}
      <div style={{
        position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%) rotate(-2deg)',
        width: 56, height: 14, background: 'rgba(200,200,200,0.55)',
        borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28 }}>✈️</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>고난크루 앱 설치하기!</h4>
          <p style={{ fontSize: 13, color: '#555', margin: 0 }}>홈 화면에 추가하면 더 편리해요</p>
        </div>
        <button onClick={onDismiss} style={{ fontSize: 18, color: '#888', padding: 4 }}>✕</button>
      </div>
      {isIOS ? (
        <div style={{ marginTop: 10, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
          Safari 하단 <strong>공유(⬆️)</strong> → <strong>"홈 화면에 추가"</strong>
        </div>
      ) : (
        <button onClick={onInstall} className="btn-sketch" style={{
          marginTop: 12, width: '100%', padding: '11px 0',
          fontSize: 15, fontWeight: 700,
        }}>홈 화면에 추가하기 ✏️</button>
      )}
    </div>
  )
}

function useIsDesktop() {
  const [is, setIs] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const h = () => setIs(window.innerWidth >= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return is
}

// ── GAS ───────────────────────────────────────────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyLrN1CAXR9NYHYHTqD4UrCduN53QYoqAl3dmYIWf88FqQACJtQYpgfDMRSOpNpri_-kQ/exec'

function jsonpCall(params, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cb = '_gc' + Date.now()
    const url = new URL(GAS_URL)
    url.searchParams.set('callback', cb)
    url.searchParams.set('_t', Date.now())
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
    const script = document.createElement('script')
    script.src = url.toString()
    const timer = setTimeout(() => { cleanup(); reject(new Error('시간 초과')) }, timeoutMs)
    window[cb] = (data) => { cleanup(); resolve(data) }
    function cleanup() {
      clearTimeout(timer); delete window[cb]; script.parentNode?.removeChild(script)
    }
    script.onerror = () => { cleanup(); reject(new Error('네트워크 오류')) }
    document.head.appendChild(script)
  })
}

const gasGet  = ()     => jsonpCall({ action: 'list' })
const gasPost = (body) => jsonpCall(body)

// ── 유틸 ─────────────────────────────────────────────────────
const PALETTE = [
  '#ff4d4d', '#2d5da1', '#e67e22', '#27ae60',
  '#8e44ad', '#e91e8c', '#16a085', '#d35400',
]

function getEventColor(ev) {
  let h = 0
  for (const c of ev.id) h = (h * 31 + c.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function simpleHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return h.toString(36)
}
function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function todayStr() {
  const t = new Date()
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate())
}
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const DAYS = ['일', '월', '화', '수', '목', '금', '토']
  const dow = new Date(y, m - 1, d).getDay()
  return { y, m, d, dowKr: DAYS[dow] }
}
function eventCoversDate(ev, dateStr) {
  return ev.startDate <= dateStr && dateStr <= ev.endDate
}
function fmtRange(ev) {
  const s = formatDate(ev.startDate), e = formatDate(ev.endDate)
  if (ev.startDate === ev.endDate) return `${s.m}월 ${s.d}일 (${s.dowKr})`
  return `${s.m}월 ${s.d}일 (${s.dowKr}) ~ ${e.m}월 ${e.d}일 (${e.dowKr})`
}
function dayDiff(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

// URL을 감지해 링크로 변환
function linkify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{
          color: '#2d5da1', fontWeight: 700,
          textDecoration: 'underline',
          wordBreak: 'break-all',
        }}>{part}</a>
      : part
  )
}

const VIEW = { CALENDAR: 'calendar', DETAIL: 'detail', FORM: 'form' }
const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토']
const MAX_SLOTS = 3

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1I-j29J_sau7mJpjfmXrsyvtK2Xe-NqGByOyW3YNzpNI/edit?gid=2140106036#gid=2140106036'

// ── 헤더 ─────────────────────────────────────────────────────
function Header({ view, onBack, onAdd, isDesktop }) {
  const isCalendar = view === VIEW.CALENDAR
  const tapCount = useRef(0)
  const tapTimer = useRef(null)

  function handleSecretTap() {
    tapCount.current += 1
    clearTimeout(tapTimer.current)
    if (tapCount.current >= 10) {
      tapCount.current = 0
      window.open(SHEET_URL, '_blank', 'noopener,noreferrer')
      return
    }
    tapTimer.current = setTimeout(() => { tapCount.current = 0 }, 2000)
  }

  return (
    <div style={{
      background: C.white,
      borderBottom: `3px dashed ${C.border}`,
      padding: isDesktop ? '12px 40px' : '10px 16px',
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: isDesktop ? 1200 : '100%', margin: '0 auto',
      }}>
        {/* 뒤로가기 + 히든 탭 영역 */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div onClick={handleSecretTap} style={{
            position: 'absolute', top: -10, left: -10,
            width: 48, height: 48, zIndex: 1,
          }} />
        <button onClick={onBack} style={{
          width: 38, height: 38,
          borderRadius: R.wobblyMd,
          border: onBack ? `3px solid ${C.border}` : 'none',
          background: onBack ? C.muted : 'transparent',
          boxShadow: onBack ? S.small : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700,
          opacity: onBack ? 1 : 0, pointerEvents: onBack ? 'auto' : 'none',
          flexShrink: 0, transition: 'transform 0.1s',
          position: 'relative', zIndex: 2,
        }} className={onBack ? 'btn-muted' : ''}>←</button>
        </div>

        {/* 타이틀 */}
        <div style={{ textAlign: 'center' }}>
          {isCalendar ? (
            <>
              <h1 style={{
                fontSize: isDesktop ? 24 : 20, fontWeight: 700,
                color: C.text, lineHeight: 1,
                transform: 'rotate(-1deg)', display: 'inline-block',
              }}>📆고난 캘린더🌄</h1>
            </>
          ) : (
            <h2 style={{ fontSize: isDesktop ? 20 : 17, fontWeight: 700, color: C.text }}>
              {view === VIEW.DETAIL ? '여행 상세 📋' : '일정 등록 ✍️'}
            </h2>
          )}
        </div>

        {/* 등록 버튼 */}
        <button onClick={onAdd} className="btn-sketch" style={{
          padding: isDesktop ? '8px 16px' : '7px 12px',
          fontSize: isDesktop ? 14 : 13, fontWeight: 700,
          opacity: onAdd ? 1 : 0, pointerEvents: onAdd ? 'auto' : 'none',
          flexShrink: 0,
        }}>
          {isDesktop ? '+ 새 여행' : '+'}
        </button>
      </div>
    </div>
  )
}

// ── 로딩 ─────────────────────────────────────────────────────
const TRAVEL_EMOJIS = ['🪵','🦇','🦉','🌼','🍐','🌈','🐻','🐦','🐗','🦌','🦆','🐸','🐐','🦢','🐺','🍋','🍈','🌑','🍑','🦅','🐨','🦙','🦈','🐚','🦑','🌕','🌻','🦡','🐕','🦎','🐒','🦜','🐖','🐏','🐜','🐛','🥥','🐟','🍁','🌋','🎐','🦍','🐹','🐆','🦞','🦚','🐧','🦝','🐓','🐑','💐','🍂','⛰️','🐭','🌱','🐍','☀️','🐡','🐱','🐿️','🐘','🦊','🦔','🦘','🌔','🦟','🐷','🦕','🦖','🐉','🍍','🐰','🌷','🐢','🐊','🐶','🦁','🐁','🌊','🦐','🐅','🐋','🐮','🍆','🌞','🐳','🐔','🐄','🐼','🐩']

function Spinner({ fullPage }) {
  const emoji = TRAVEL_EMOJIS[Math.floor(Math.random() * TRAVEL_EMOJIS.length)]
  const LOADING_MSGS = ['고난크루와 함께! 이번엔 어디로 갈까?', '벙주사랑🥰 고난사랑💞']
  const loadingMsg = LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)]
  const inner = (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <style>{`
        @keyframes _spin { to { transform: rotate(360deg) } }
        @keyframes _bounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        .sp-ring { animation: _spin 1s linear infinite !important; }
        .sp-emoji { animation: _bounce 0.8s ease-in-out infinite !important; }
      `}</style>
      <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 20px' }}>
        <div className="sp-ring" style={{
          width: 64, height: 64, borderRadius: '50%',
          border: '5px solid #c7d2fe',
          borderTopColor: '#4f46e5',
          borderRightColor: '#4f46e5',
        }} />
        <span className="sp-emoji" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
        }}>{emoji}</span>
      </div>
      <p style={{ fontSize: 15, color: '#888', fontFamily: "'Noto Sans KR', sans-serif", margin: 0 }}>
        {loadingMsg}
      </p>
    </div>
  )
  if (!fullPage) return inner
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{inner}</div>
  )
}

// ── 캘린더 ───────────────────────────────────────────────────
function Calendar({ year, month, events, selectedDate, onSelectDate, onMonthChange, onMonthClick, isDesktop }) {
  const today = todayStr()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthStart = toDateStr(year, month, 1)
  const monthEnd = toDateStr(year, month, daysInMonth)

  const visibleEvents = events
    .filter(ev => ev.startDate <= monthEnd && ev.endDate >= monthStart)
    .sort((a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.id.localeCompare(b.id))

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{
      margin: isDesktop ? 0 : '16px',
      background: C.white,
      border: `3px solid ${C.border}`,
      borderRadius: R.wobblyLg,
      boxShadow: S.large,
      position: 'relative',
    }}>
      {/* 테이프 장식 */}
      <div style={{
        position: 'absolute', top: -7, left: '30%',
        transform: 'rotate(-1.5deg)',
        width: 52, height: 14, background: 'rgba(200,200,200,0.5)',
        borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)', zIndex: 1,
      }} />

      {/* 월 네비 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 16px 12px',
        borderBottom: `2px dashed ${C.muted}`,
      }}>
        <button onClick={() => onMonthChange(-1)} className="month-nav-btn" style={{
          width: 36, height: 36, borderRadius: R.wobblyMd,
          border: `3px solid ${C.border}`, background: C.muted,
          boxShadow: S.small,
          fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>‹</button>

        <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={onMonthClick}>
          <h2 style={{
            fontSize: 22, fontWeight: 700, color: C.text,
            display: 'inline-block', transform: 'rotate(-0.5deg)',
            textDecoration: 'underline dotted', textUnderlineOffset: 4,
          }}>
            {month + 1}월
          </h2>
          <span style={{ marginLeft: 6, fontSize: 14, color: '#888', fontFamily: "'Noto Sans KR', 'Patrick Hand', cursive" }}>{year}</span>
        </div>

        <button onClick={() => onMonthChange(1)} className="month-nav-btn" style={{
          width: 36, height: 36, borderRadius: R.wobblyMd,
          border: `3px solid ${C.border}`, background: C.muted,
          boxShadow: S.small,
          fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: C.muted, padding: '4px 0' }}>
        {DAYS_KR.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 12, fontWeight: 700,
            color: i === 0 ? C.accent : i === 6 ? C.accentBlue : '#555',
            padding: '5px 0', fontFamily: "'Noto Sans KR', 'Kalam', cursive",
          }}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', paddingBottom: 8 }}>
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e-${idx}`} style={{ height: isDesktop ? 70 : 62 }} />
          const dateStr = toDateStr(year, month, d)
          const slottedEvs = visibleEvents.filter(ev => eventCoversDate(ev, dateStr))
          const hasEvents = slottedEvs.length > 0
          const isToday = dateStr === today
          const isSel = dateStr === selectedDate
          const dow = (firstDay + d - 1) % 7
          const overflowCount = Math.max(0, slottedEvs.length - MAX_SLOTS)

          return (
            <div
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className="day-cell-clickable"
              style={{ height: isDesktop ? 76 : 68, position: 'relative', cursor: 'pointer' }}
            >
              <div style={{
                position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 28,
                borderRadius: isSel ? R.tag : isToday ? '50%' : 'none',
                border: isToday ? `2px solid ${C.accent}` : isSel ? `2px solid ${C.accentBlue}` : 'none',
                background: isSel ? C.accentBlue : isToday ? C.accent : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
                fontWeight: isSel || isToday ? 700 : 400,
                fontSize: 13,
                color: isSel || isToday ? '#fff' : dow === 0 ? C.accent : dow === 6 ? C.accentBlue : C.text,
                fontFamily: isToday || isSel ? "'Noto Sans KR', 'Kalam', cursive" : "'Noto Sans KR', 'Patrick Hand', cursive",
              }}>{d}</div>

              {slottedEvs.slice(0, MAX_SLOTS).map((ev, slotIdx) => {
                const isActualStart = dateStr === ev.startDate
                const isActualEnd = dateStr === ev.endDate
                const isRowStart = dow === 0
                const isRowEnd = dow === 6
                return (
                  <div key={ev.id} style={{
                    position: 'absolute',
                    top: 34 + slotIdx * 11, height: 10,
                    left: isActualStart ? 3 : isRowStart ? 1 : 0,
                    right: isActualEnd ? 3 : isRowEnd ? 1 : 0,
                    background: getEventColor(ev),
                    borderRadius: [
                      isActualStart ? 3 : 0,
                      isActualEnd ? 3 : 0,
                      isActualEnd ? 3 : 0,
                      isActualStart ? 3 : 0,
                    ].map(v => v + 'px').join(' '),
                    zIndex: 1,
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center',
                    paddingLeft: isActualStart ? 4 : 2,
                    paddingRight: 2,
                  }}>
                    {isActualStart && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, color: '#fff',
                        whiteSpace: 'nowrap', overflow: 'hidden',
                        textOverflow: 'ellipsis', lineHeight: 1,
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}>{ev.title}</span>
                    )}
                  </div>
                )
              })}

              {overflowCount > 0 && (
                <div style={{ position: 'absolute', bottom: 2, right: 3, fontSize: 9, color: '#888', fontWeight: 700 }}>
                  +{overflowCount}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 일정 목록 ────────────────────────────────────────────────
function EventList({ date, year, month, events, onSelect, onAdd }) {
  // 날짜 선택 없으면 해당 월 전체 일정 표시
  const isMonthView = !date
  const monthStart = isMonthView ? toDateStr(year, month, 1) : null
  const monthEnd   = isMonthView ? toDateStr(year, month, new Date(year, month + 1, 0).getDate()) : null

  const filtered = events
    .filter(ev => isMonthView
      ? ev.startDate <= monthEnd && ev.endDate >= monthStart
      : eventCoversDate(ev, date))
    .sort((a, b) => a.startDate < b.startDate ? -1 : 1)

  if (filtered.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 12, animation: 'bounce-gentle 3s ease-in-out infinite' }}>🗺️</div>
      <p style={{ fontWeight: 700, fontSize: 16, color: '#555', fontFamily: "'Noto Sans KR', 'Kalam', cursive" }}>
        {isMonthView ? '이 달엔 일정이 없어요!' : '이 날엔 일정이 없어요!'}
      </p>
      {isMonthView && <p style={{ fontSize: 13, color: '#888' }}>+ 버튼으로 새 여행을 기록하세요</p>}
      {date && onAdd && (
        <button onClick={onAdd} className="btn-sketch-blue" style={{
          marginTop: 16, padding: '10px 24px', fontSize: 14, fontWeight: 700,
        }}>+ 일정 등록하기</button>
      )}
    </div>
  )

  const labelText = isMonthView
    ? `${year}년 ${month + 1}월`
    : (() => { const { m, d, dowKr } = formatDate(date); return `${m}월 ${d}일 (${dowKr})` })()

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      {/* 날짜/월 라벨 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          background: isMonthView ? C.accentBlue : C.accent, color: '#fff',
          border: `2px solid ${C.border}`, borderRadius: R.tag,
          boxShadow: S.small,
          padding: '4px 12px', fontSize: 13, fontWeight: 700,
          fontFamily: "'Noto Sans KR', 'Kalam', cursive",
          transform: 'rotate(-1deg)',
        }}>{labelText}</div>
        <span style={{ fontSize: 12, color: '#888' }}>✏️ {filtered.length}개</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.map((ev, i) => {

          const nights = dayDiff(ev.startDate, ev.endDate)
          const color = getEventColor(ev)
          const rot = i % 3 === 0 ? '-1deg' : i % 3 === 1 ? '0.5deg' : '-0.5deg'
          return (
            <button
              key={ev.id}
              onClick={() => onSelect(ev)}
              className="event-card-sketch"
              style={{
                width: '100%', textAlign: 'left',
                background: C.yellow,
                border: `3px solid ${C.border}`,
                borderRadius: R.wobblyMd,
                boxShadow: S.base,
                padding: '12px 14px',
                transform: `rotate(${rot})`,
                position: 'relative',
              }}
            >
              {/* 핀 */}
              <div style={{
                position: 'absolute', top: -8, left: 20,
                width: 14, height: 14, borderRadius: '50%',
                background: color, border: `2px solid ${C.border}`,
                boxShadow: '2px 2px 0px #2d2d2d',
              }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 2 }}>
                <div style={{ flex: 1 }}>
                  {/* 날짜 — 첫 줄, 눈에 띄게 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      background: color, color: '#fff',
                      border: `2px solid ${C.border}`, borderRadius: R.tag,
                      padding: '2px 8px', fontSize: 12, fontWeight: 800,
                      boxShadow: '2px 2px 0px #2d2d2d', letterSpacing: 0.3,
                    }}>📅 {fmtRange(ev)}</span>
                    {nights > 0 && (
                      <span style={{
                        background: C.white, border: `1px solid ${C.border}`,
                        borderRadius: R.tag, padding: '2px 7px', fontSize: 11, fontWeight: 700,
                      }}>{nights}박 {nights + 1}일</span>
                    )}
                  </div>
                  {ev.leader && (
                    <div style={{ fontSize: 11, color: C.accentBlue, fontWeight: 700, marginBottom: 3 }}>
                      👤 {ev.leader}
                    </div>
                  )}
                  <div style={{
                    fontFamily: "'Noto Sans KR', 'Kalam', cursive", fontWeight: 700,
                    fontSize: 15, color: C.text, marginBottom: 4,
                  }}>✈️ {ev.title}</div>
                  {ev.content && (
                    <div style={{
                      marginTop: 5, fontSize: 12, color: '#666', lineHeight: 1.5,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>{ev.content}</div>
                  )}
                </div>
                <span style={{ fontSize: 18, color: '#aaa' }}>›</span>
              </div>
            </button>
          )
        })}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="btn-sketch-blue" style={{
          marginTop: 20, width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 700,
        }}>+ 일정 등록하기</button>
      )}
    </div>
  )
}

// ── 일정 상세 ────────────────────────────────────────────────
function EventDetail({ event, onEdit, onDelete, onUpdateParticipants, updatingParticipants }) {
  const nights = dayDiff(event.startDate, event.endDate)
  const color = getEventColor(event)
  const [editingParticipants, setEditingParticipants] = useState(false)
  const [participantsVal, setParticipantsVal] = useState(event.participants || '')

  function handleSaveParticipants() {
    onUpdateParticipants(participantsVal.trim())
    setEditingParticipants(false)
  }

  return (
    <div style={{ flex: 1, padding: '20px 16px 100px' }}>
      {/* 타이틀 카드 */}
      <div style={{
        background: C.yellow, border: `3px solid ${C.border}`,
        borderRadius: R.wobblyLg, boxShadow: S.large,
        padding: '24px 20px', marginBottom: 20,
        position: 'relative', transform: 'rotate(-0.5deg)',
      }}>
        {/* 핀 */}
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          width: 18, height: 18, borderRadius: '50%',
          background: color, border: `3px solid ${C.border}`,
          boxShadow: '2px 2px 0px #2d2d2d',
        }} />

        {event.leader && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: color, color: '#fff',
            border: `2px solid ${C.border}`, borderRadius: R.tag,
            boxShadow: S.small, padding: '3px 10px',
            fontSize: 12, fontWeight: 700, marginBottom: 8,
          }}>
            👤 {event.leader}
          </div>
        )}

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: C.white, border: `2px solid ${C.border}`,
          borderRadius: R.tag, boxShadow: S.small,
          padding: '3px 10px', marginBottom: 10, fontSize: 12,
          marginLeft: event.leader ? 6 : 0,
          fontFamily: "'Noto Sans KR', 'Patrick Hand', cursive",
        }}>
          📅 {fmtRange(event)}
          {nights > 0 && <span style={{ fontWeight: 700, color: C.accentBlue }}>· {nights}박 {nights + 1}일</span>}
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 8 }}>
          ✈️ {event.title}
        </h2>
        <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
          등록: {new Date(event.createdAt).toLocaleDateString('ko-KR')}
        </p>
      </div>

      {/* 내용 카드 */}
      <div style={{
        background: C.white, border: `3px solid ${C.border}`,
        borderRadius: R.wobblyMd, boxShadow: S.base,
        padding: '18px 18px', marginBottom: 16,
        transform: 'rotate(0.5deg)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.accentBlue,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 10, fontFamily: "'Noto Sans KR', 'Kalam', cursive",
          borderBottom: `2px dashed ${C.muted}`, paddingBottom: 6,
        }}>📝 여행 내용</div>
        <p style={{
          fontSize: 15, color: event.content ? C.text : '#aaa',
          lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          minHeight: 80, margin: '0 0 16px', fontStyle: event.content ? 'normal' : 'italic',
        }}>
          {event.content ? linkify(event.content) : '내용이 없어요. 메모를 남겨보세요 :)'}
        </p>
        <a
          href="https://www.somoim.co.kr/ee346172-8bf3-11ec-88c3-0ada976e8c451"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: C.accentBlue, color: '#fff',
            border: `3px solid ${C.border}`, borderRadius: R.wobblyMd,
            boxShadow: S.base,
            padding: '12px 0', width: '100%',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = S.small }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = S.base }}
        >
          🔗 소모임 바로가기
        </a>
      </div>

      {/* 수정/삭제 버튼 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={onEdit} className="btn-sketch-blue" style={{
          flex: 1, padding: '13px', fontSize: 14, fontWeight: 700,
        }}>✏️ 수정</button>
        <button onClick={onDelete} className="btn-danger-sketch" style={{
          flex: 1, padding: '13px', fontSize: 14, fontWeight: 700,
        }}>🗑️ 삭제</button>
      </div>

      {/* 참석자 카드 — 비밀번호 없이 누구나 수정 */}
      <div style={{
        background: C.white, border: `3px solid ${C.border}`,
        borderRadius: R.wobblyMd, boxShadow: S.base,
        padding: '16px 18px',
        transform: 'rotate(-0.3deg)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `2px dashed ${C.muted}`, paddingBottom: 8, marginBottom: 12,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.accentBlue,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            fontFamily: "'Noto Sans KR', 'Kalam', cursive",
          }}>🧑‍🤝‍🧑 참석자</div>
          {!editingParticipants && (
            <button
              onClick={() => { setParticipantsVal(event.participants || ''); setEditingParticipants(true) }}
              style={{
                fontSize: 11, color: C.accentBlue, fontWeight: 700,
                border: `2px solid ${C.accentBlue}`, borderRadius: R.tag,
                padding: '2px 8px', background: 'transparent',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.accentBlue; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.accentBlue }}
            >✏️ 수정</button>
          )}
        </div>

        {editingParticipants ? (
          <div>
            <textarea
              autoFocus
              value={participantsVal}
              onChange={e => setParticipantsVal(e.target.value)}
              placeholder="참석자 이름을 자유롭게 적어주세요 (예: 최술사, 이고고, 박여행)"
              rows={3}
              style={{ ...inputCss(false), resize: 'vertical', lineHeight: 1.6, fontSize: 14 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setEditingParticipants(false)}
                className="btn-muted"
                style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700 }}
              >취소</button>
              <button
                onClick={handleSaveParticipants}
                disabled={updatingParticipants}
                className="btn-sketch"
                style={{ flex: 2, padding: '10px', fontSize: 13, fontWeight: 700, opacity: updatingParticipants ? 0.7 : 1 }}
              >{updatingParticipants ? '저장 중...' : '✅ 저장'}</button>
            </div>
          </div>
        ) : (
          <p style={{
            fontSize: 14, color: event.participants ? C.text : '#aaa',
            lineHeight: 1.8, margin: 0,
            fontStyle: event.participants ? 'normal' : 'italic',
            whiteSpace: 'pre-wrap',
          }}>
            {event.participants || '아직 참석자가 없어요. 수정 버튼으로 추가해보세요!'}
          </p>
        )}
      </div>
    </div>
  )
}

// ── 비밀번호 모달 ─────────────────────────────────────────────
function PwModal({ title, onConfirm, onCancel, loading }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!pw.trim()) { setErr('비밀번호를 입력해주세요!'); return }
    onConfirm(pw.trim())
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(45,45,45,0.4)',
        display: 'flex', alignItems: 'flex-end', zIndex: 100,
      }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        background: C.bg, borderTop: `3px solid ${C.border}`,
        borderRadius: '24px 24px 0 0',
        padding: '8px 24px 40px',
        boxShadow: '0 -4px 0px 0px #2d2d2d',
      }}>
        <div style={{ width: 40, height: 4, background: C.muted, borderRadius: 2, margin: '14px auto 20px' }} />
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: C.text }}>{title}</h3>
        <p style={{ fontSize: 13, color: '#777', marginBottom: 18, marginTop: 0 }}>🔒 등록 시 설정한 비밀번호를 입력하세요.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password" autoFocus value={pw}
            onChange={e => { setPw(e.target.value); setErr('') }}
            placeholder="비밀번호를 적어주세요..."
            disabled={loading}
            style={{
              width: '100%', padding: '14px 16px', fontSize: 15,
              border: `3px solid ${err ? C.accent : C.border}`,
              borderRadius: R.wobblyMd, background: C.white,
              boxShadow: err ? S.small : 'none',
              marginBottom: 6, boxSizing: 'border-box', outline: 'none',
            }}
          />
          {err && <p style={{ color: C.accent, fontSize: 12, margin: '0 0 10px', fontStyle: 'italic' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" onClick={onCancel} disabled={loading} className="btn-muted" style={{
              flex: 1, padding: 14, fontSize: 15, fontWeight: 700, opacity: loading ? 0.5 : 1,
            }}>취소</button>
            <button type="submit" disabled={loading} className="btn-sketch" style={{
              flex: 2, padding: 14, fontSize: 15, fontWeight: 700, opacity: loading ? 0.7 : 1,
            }}>{loading ? '처리 중... ✏️' : '확인 ✓'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 폼 필드 ───────────────────────────────────────────────────
function FormField({ label, error, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block', fontSize: 13, fontWeight: 700,
        color: C.accentBlue, marginBottom: 7,
        fontFamily: "'Noto Sans KR', 'Kalam', cursive",
      }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 12, color: '#888', marginTop: 5, margin: '5px 0 0', fontStyle: 'italic' }}>{hint}</p>}
      {error && <p style={{ color: C.accent, fontSize: 12, marginTop: 5, margin: '5px 0 0', fontStyle: 'italic' }}>{error}</p>}
    </div>
  )
}

function inputCss(hasErr) {
  return {
    width: '100%', padding: '13px 15px', fontSize: 15,
    border: `3px solid ${hasErr ? C.accent : C.border}`,
    borderRadius: R.wobblyMd,
    background: C.white,
    boxSizing: 'border-box', color: C.text,
    outline: 'none',
    boxShadow: hasErr ? S.small : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }
}

// ── 등록/수정 폼 ──────────────────────────────────────────────
function addOneDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
}

function EventForm({ initialDate, editEvent, onSave, onCancel, submitting }) {
  const defaultStart = editEvent?.startDate || initialDate || todayStr()
  const defaultEnd   = editEvent?.endDate   || (initialDate ? addOneDay(initialDate) : todayStr())
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [leader, setLeader] = useState(editEvent?.leader || '')
  const [title, setTitle] = useState(editEvent?.title || '')
  const [content, setContent] = useState(editEvent?.content || '')
  const [participants, setParticipants] = useState(editEvent?.participants || '')
  const [pw, setPw] = useState('')
  const [errors, setErrors] = useState({})

  function handleStartDate(val) {
    setStartDate(val)
    if (val > endDate) setEndDate(val)
    setErrors(v => ({ ...v, startDate: null }))
  }

  function validate() {
    const e = {}
    if (!leader.trim()) e.leader = '리딩(주최자)을 입력해주세요!'
    if (!title.trim()) e.title = '여행 제목을 써주세요!'
    if (!startDate) e.startDate = '시작 날짜를 골라주세요.'
    if (!endDate) e.endDate = '종료 날짜를 골라주세요.'
    if (endDate < startDate) e.endDate = '종료 날짜가 시작 날짜보다 빨라요!'
    if (!editEvent && !pw.trim()) e.pw = '비밀번호를 설정해주세요.'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (editEvent) {
      onSave({ ...editEvent, startDate, endDate, leader: leader.trim(), title: title.trim(), content: content.trim(), participants: participants.trim() })
    } else {
      onSave({
        id: Date.now().toString(), startDate, endDate,
        leader: leader.trim(), title: title.trim(), content: content.trim(),
        participants: participants.trim(),
        pwHash: simpleHash(pw.trim()),
        createdAt: new Date().toISOString(),
      })
    }
  }

  const nights = startDate && endDate ? dayDiff(startDate, endDate) : 0

  return (
    <div style={{ flex: 1, padding: '20px 16px 100px' }}>
      {/* 폼 헤더 카드 */}
      <div style={{
        background: C.yellow, border: `3px solid ${C.border}`,
        borderRadius: R.wobblyLg, boxShadow: S.base,
        padding: '16px 18px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 12,
        transform: 'rotate(-0.5deg)',
      }}>
        <span style={{ fontSize: 32 }}>✈️</span>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 2 }}>
            {editEvent ? '여행 일정 수정' : '새 여행 등록!'}
          </h2>
          <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
            {editEvent ? '내용을 고쳐보세요 ✏️' : '고난크루의 새 여행을 기록하세요 🗺️'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 날짜 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block', fontSize: 13, fontWeight: 700,
            color: C.accentBlue, marginBottom: 7, fontFamily: "'Noto Sans KR', 'Kalam', cursive",
          }}>📅 여행 날짜</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 700 }}>시작</div>
              <input type="date" value={startDate} onChange={e => handleStartDate(e.target.value)} style={inputCss(errors.startDate)} />
            </div>
            <div style={{ paddingTop: 26, color: '#aaa', fontWeight: 700, fontSize: 18 }}>~</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 700 }}>종료</div>
              <input type="date" value={endDate} min={startDate}
                onChange={e => { setEndDate(e.target.value); setErrors(v => ({ ...v, endDate: null })) }}
                style={inputCss(errors.endDate)} />
            </div>
          </div>
          {errors.startDate && <p style={{ color: C.accent, fontSize: 12, margin: '5px 0 0', fontStyle: 'italic' }}>{errors.startDate}</p>}
          {errors.endDate && <p style={{ color: C.accent, fontSize: 12, margin: '5px 0 0', fontStyle: 'italic' }}>{errors.endDate}</p>}
          {nights > 0 && (
            <div style={{
              marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: C.accentBlue, color: '#fff',
              border: `2px solid ${C.border}`, borderRadius: R.tag,
              boxShadow: S.small, padding: '4px 12px',
              transform: 'rotate(-1deg)',
            }}>
              <span>🌙</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Noto Sans KR', 'Kalam', cursive" }}>{nights}박 {nights + 1}일</span>
            </div>
          )}
        </div>

        <FormField label="👤 리딩 (주최자)" error={errors.leader}>
          <input type="text" value={leader}
            onChange={e => { setLeader(e.target.value); setErrors(v => ({ ...v, leader: null })) }}
            placeholder="예) 김벙주" style={inputCss(errors.leader)} />
        </FormField>

        <FormField label="🗺️ 여행 제목" error={errors.title}>
          <input type="text" value={title}
            onChange={e => { setTitle(e.target.value); setErrors(v => ({ ...v, title: null })) }}
            placeholder="예) 제주도 3박 4일" style={inputCss(errors.title)} />
        </FormField>

        <FormField label="📝 여행 내용">
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={"장소, 숙소, 준비물 등\n자유롭게 적어주세요 🏖️"}
            rows={5} style={{ ...inputCss(false), resize: 'vertical', lineHeight: 1.7 }} />
        </FormField>

        <FormField label="🧑‍🤝‍🧑 참석자" hint="나중에 누구든 자유롭게 수정할 수 있어요.">
          <textarea value={participants} onChange={e => setParticipants(e.target.value)}
            placeholder={"참석자 이름을 적어주세요\n예) 김벙주, 이고고, 박여행"}
            rows={3} style={{ ...inputCss(false), resize: 'vertical', lineHeight: 1.7 }} />
        </FormField>

        {!editEvent && (
          <FormField label="🔒 비밀번호" error={errors.pw} hint="이 비밀번호로만 수정·삭제할 수 있어요.">
            <input type="password" value={pw}
              onChange={e => { setPw(e.target.value); setErrors(v => ({ ...v, pw: null })) }}
              placeholder="나만의 비밀 암호..." style={inputCss(errors.pw)} />
          </FormField>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button type="button" onClick={onCancel} disabled={submitting} className="btn-muted" style={{
            flex: 1, padding: '14px', fontSize: 15, fontWeight: 700, opacity: submitting ? 0.5 : 1,
          }}>취소</button>
          <button type="submit" disabled={submitting} className="btn-sketch" style={{
            flex: 2, padding: '14px', fontSize: 15, fontWeight: 700, opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? '저장 중... ✏️' : editEvent ? '✅ 수정 완료!' : '🚀 여행 등록!'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── 토스트 ───────────────────────────────────────────────────
function Toast({ msg }) {
  return (
    <div style={{
      position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%) rotate(-1deg)',
      background: C.yellow, color: C.text,
      border: `3px solid ${C.border}`, borderRadius: R.wobblyMd,
      boxShadow: S.base,
      padding: '10px 20px', fontSize: 14, fontWeight: 700, zIndex: 200,
      whiteSpace: 'nowrap', fontFamily: "'Noto Sans KR', 'Kalam', cursive",
    }}>{msg}</div>
  )
}

// ── 메인 앱 ──────────────────────────────────────────────────
export default function App() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [view, setView] = useState(VIEW.CALENDAR)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [pwModal, setPwModal] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    gasGet()
      .then(res => {
        if (res.status === 'ok') setEvents(res.data)
        else showToast('❌ 데이터를 불러오지 못했어요')
      })
      .catch(() => showToast('❌ 서버 연결 실패'))
      .finally(() => setLoading(false))
  }, [])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500) }

  function handleMonthChange(delta) {
    let m = month + delta, y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y); setSelectedDate(null)
  }

  function handleSelectDate(date) { setSelectedDate(prev => prev === date ? null : date) }
  function handleSelectEvent(ev) { setSelectedEvent(ev); setView(VIEW.DETAIL) }
  function handleAddClick() { setEditingEvent(null); setView(VIEW.FORM) }
  function handleAddFromDate() { setEditingEvent(null); setView(VIEW.FORM) }

  async function handleSaveEvent(ev) {
    setSubmitting(true)
    try {
      if (editingEvent) {
        const res = await gasPost({ action: 'update', ...ev })
        if (res.status === 'unauthorized') { showToast('🔒 비밀번호가 틀렸어요!'); return }
        if (res.status !== 'updated') { showToast('❌ 수정 실패'); return }
        setEvents(prev => prev.map(e => e.id === ev.id ? ev : e))
        setSelectedEvent(ev); setView(VIEW.DETAIL)
        showToast('✅ 수정됐어요!')
      } else {
        const res = await gasPost({ action: 'create', ...ev })
        if (res.status !== 'created') { showToast('❌ 등록 실패'); return }
        setEvents(prev => [...prev, ev])
        setSelectedDate(ev.startDate)
        const [y, m] = ev.startDate.split('-').map(Number)
        setYear(y); setMonth(m - 1); setView(VIEW.CALENDAR)
        showToast('🚀 여행 등록 완료!')
      }
    } catch {
      showToast('❌ 오류가 발생했어요')
    } finally {
      setSubmitting(false); setEditingEvent(null)
    }
  }

  async function handlePwConfirm(pw) {
    const hash = simpleHash(pw)
    if (hash !== selectedEvent.pwHash) {
      showToast('🔒 비밀번호가 틀렸어요!')
      setPwModal(null); return
    }
    if (pwModal.action === 'edit') {
      setEditingEvent(selectedEvent); setPwModal(null); setView(VIEW.FORM); return
    }
    setSubmitting(true)
    try {
      const res = await gasPost({ action: 'delete', id: selectedEvent.id, pwHash: hash })
      if (res.status === 'unauthorized') { showToast('🔒 비밀번호가 틀렸어요!'); return }
      if (res.status !== 'deleted') { showToast('❌ 삭제 실패'); return }
      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id))
      setSelectedEvent(null); setView(VIEW.CALENDAR)
      showToast('🗑️ 삭제됐어요!')
    } catch {
      showToast('❌ 오류가 발생했어요')
    } finally {
      setSubmitting(false); setPwModal(null)
    }
  }

  async function handleUpdateParticipants(participants) {
    setSubmitting(true)
    console.log('[updateParticipants] 시작, id:', selectedEvent.id, 'participants:', participants)
    try {
      const res = await gasPost({ action: 'updateParticipants', id: selectedEvent.id, participants })
      console.log('[updateParticipants] res:', JSON.stringify(res))
      if (res.status !== 'updated') { showToast('❌ 참석자 저장 실패'); return }
      const updated = { ...selectedEvent, participants }
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? updated : e))
      setSelectedEvent(updated)
      showToast('✅ 참석자가 저장됐어요!')
    } catch(err) {
      console.log('[updateParticipants] catch error:', err?.message)
      showToast('❌ 오류가 발생했어요')
    } finally {
      setSubmitting(false)
    }
  }

  const isDesktop = useIsDesktop()
  const { show: showInstall, isIOS, install, dismiss: dismissInstall } = useInstallPrompt()

  const onBack = view === VIEW.DETAIL
    ? () => setView(VIEW.CALENDAR)
    : view === VIEW.FORM
    ? () => { if (editingEvent) { setView(VIEW.DETAIL); setEditingEvent(null) } else setView(VIEW.CALENDAR) }
    : null
  const onAdd = view === VIEW.CALENDAR ? handleAddClick : null

  const desktopCardStyle = {
    maxWidth: 680, margin: '32px auto', width: '100%',
    background: C.white,
    border: `3px solid ${C.border}`,
    borderRadius: R.wobblyLg,
    boxShadow: S.large,
    overflow: 'hidden',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      <Header view={view} onBack={onBack} onAdd={onAdd} isDesktop={isDesktop} />

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: isDesktop ? 64 : 60 }}>
        {loading ? (
          <Spinner fullPage />
        ) : (
          <>
            {view === VIEW.CALENDAR && !isDesktop && (
              <>
                <Calendar
                  year={year} month={month} events={events}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  onMonthChange={handleMonthChange}
                  onMonthClick={() => setSelectedDate(null)}
                  isDesktop={false}
                />
                <div style={{ marginTop: 8 }}>
                  <EventList date={selectedDate} year={year} month={month} events={events} onSelect={handleSelectEvent} onAdd={selectedDate ? handleAddFromDate : null} />
                </div>
              </>
            )}

            {view === VIEW.CALENDAR && isDesktop && (
              <div style={{
                maxWidth: 1200, margin: '0 auto', padding: '32px 40px 60px',
                display: 'grid', gridTemplateColumns: '1fr 400px', gap: 28, alignItems: 'start',
              }}>
                <Calendar
                  year={year} month={month} events={events}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  onMonthChange={handleMonthChange}
                  onMonthClick={() => setSelectedDate(null)}
                  isDesktop={true}
                />
                <div style={{
                  background: C.white, border: `3px solid ${C.border}`,
                  borderRadius: R.wobblyLg, boxShadow: S.large,
                  minHeight: 480, overflow: 'hidden',
                  transform: 'rotate(0.5deg)',
                }}>
                  <div style={{
                    background: C.yellow, padding: '14px 18px',
                    borderBottom: `2px dashed ${C.border}`,
                  }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>
                      {selectedDate ? (() => {
                        const { m, d, dowKr } = formatDate(selectedDate)
                        const cnt = events.filter(ev => eventCoversDate(ev, selectedDate)).length
                        return `📋 ${m}월 ${d}일 (${dowKr}) · ${cnt}개`
                      })() : `📋 ${year}년 ${month + 1}월 전체`}
                    </h3>
                  </div>
                  <EventList date={selectedDate} year={year} month={month} events={events} onSelect={handleSelectEvent} onAdd={selectedDate ? handleAddFromDate : null} />
                </div>
              </div>
            )}

            {view === VIEW.DETAIL && selectedEvent && (
              isDesktop ? (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px' }}>
                  <div style={desktopCardStyle}>
                    <EventDetail
                      event={selectedEvent}
                      onEdit={() => setPwModal({ action: 'edit' })}
                      onDelete={() => setPwModal({ action: 'delete' })}
                      onUpdateParticipants={handleUpdateParticipants}
                      updatingParticipants={submitting}
                    />
                  </div>
                </div>
              ) : (
                <EventDetail
                  event={selectedEvent}
                  onEdit={() => setPwModal({ action: 'edit' })}
                  onDelete={() => setPwModal({ action: 'delete' })}
                />
              )
            )}

            {view === VIEW.FORM && (
              isDesktop ? (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px' }}>
                  <div style={desktopCardStyle}>
                    <EventForm
                      initialDate={selectedDate}
                      editEvent={editingEvent}
                      onSave={handleSaveEvent}
                      submitting={submitting}
                      onCancel={() => {
                        if (editingEvent) { setView(VIEW.DETAIL); setEditingEvent(null) }
                        else setView(VIEW.CALENDAR)
                      }}
                    />
                  </div>
                </div>
              ) : (
                <EventForm
                  initialDate={selectedDate}
                  editEvent={editingEvent}
                  onSave={handleSaveEvent}
                  submitting={submitting}
                  onCancel={() => {
                    if (editingEvent) { setView(VIEW.DETAIL); setEditingEvent(null) }
                    else setView(VIEW.CALENDAR)
                  }}
                />
              )
            )}
          </>
        )}
      </div>

      {pwModal && (
        <PwModal
          title={pwModal.action === 'edit' ? '✏️ 일정 수정' : '🗑️ 일정 삭제'}
          onConfirm={handlePwConfirm}
          onCancel={() => setPwModal(null)}
          loading={submitting}
        />
      )}
      {toast && <Toast msg={toast} />}
      {showInstall && (
        <InstallBanner isIOS={isIOS} onInstall={install} onDismiss={dismissInstall} />
      )}
    </div>
  )
}
