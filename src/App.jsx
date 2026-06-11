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
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

  useEffect(() => {
    if (isInstalled) return
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isInstalled])

  const install = async () => {
    if (prompt) {
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome !== 'accepted') setPrompt(null)
    }
    // prompt 없으면 → 호출부에서 수동 안내 처리
  }

  const isMobile = isIOS || /android/i.test(navigator.userAgent)
  const canInstall = isMobile
  // hasNativePrompt: true면 네이티브 다이얼로그 가능, false면 수동 안내 필요
  const hasNativePrompt = prompt !== null
  return { canInstall, isInstalled, isIOS, hasNativePrompt, install }
}

function InstallGuideModal({ isIOS, onClose }) {
  const steps = isIOS
    ? [
        { icon: '1️⃣', text: <>Safari 하단 공유 버튼 <strong>⬆️</strong> 을 탭해요</> },
        { icon: '2️⃣', text: <><strong>"홈 화면에 추가"</strong> 를 선택해요</> },
        { icon: '3️⃣', text: <>오른쪽 상단 <strong>"추가"</strong> 를 탭하면 완료!</> },
      ]
    : [
        { icon: '1️⃣', text: <>브라우저 우측 하단 <strong>메뉴(⋮)</strong> 를 탭해요</> },
        { icon: '2️⃣', text: <><strong>"현재 페이지 추가"</strong> 를 누른 다음, <strong>"홈 화면"</strong> 을 선택해요</> },
        { icon: '3️⃣', text: <>추가를 누르면 누르면 홈 화면에 아이콘이 생겨요!</> },
      ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(45,45,45,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: C.bg, borderTop: `3px solid ${C.border}`,
        borderRadius: '24px 24px 0 0', padding: '8px 20px 40px',
        boxShadow: '0 -4px 0px 0px #2d2d2d',
      }}>
        <div style={{ width: 40, height: 4, background: C.muted, borderRadius: 2, margin: '14px auto 18px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6, textAlign: 'center' }}>
          ⬇️ 홈 화면에 추가하기
        </h3>
        <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20 }}>
          {isIOS ? 'Safari에서 아래 순서로 진행해주세요' : '브라우저 메뉴에서 아래 순서로 진행해주세요'}
        </p>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: C.white, border: `2px solid ${C.border}`,
            borderRadius: R.wobblyMd, boxShadow: S.small,
            padding: '12px 14px', marginBottom: 10,
          }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <span style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{s.text}</span>
          </div>
        ))}
        <button onClick={onClose} className="btn-muted" style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
          닫기
        </button>
      </div>
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
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxdZ-akkzcyh5J06rt260Y98WezYCWBJHBV4wsXAZBAZP-Uehviv7PnzqNld1me4m4hyw/exec'

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
const gasSync = ()     => jsonpCall({ action: 'sync' })

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

const VIEW = { CALENDAR: 'calendar', DETAIL: 'detail' }
const DAYS_KR = ['월', '화', '수', '목', '금', '토', '일']
const MAX_SLOTS = 3

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1I-j29J_sau7mJpjfmXrsyvtK2Xe-NqGByOyW3YNzpNI/edit?gid=2140106036#gid=2140106036'

// ── 어드민 모달 ───────────────────────────────────────────────
function AdminModal({ onClose }) {
  const [tab, setTab] = useState('menu') // 'menu' | 'help'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(45,45,45,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: C.bg, borderTop: `3px solid ${C.border}`,
        borderRadius: '24px 24px 0 0',
        padding: '8px 20px 40px',
        boxShadow: '0 -4px 0px 0px #2d2d2d',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        {/* 핸들 */}
        <div style={{ width: 40, height: 4, background: C.muted, borderRadius: 2, margin: '14px auto 18px' }} />

        {tab === 'menu' && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 16, textAlign: 'center' }}>
              🛠️ 도움말 & 관리
            </h3>

            {/* 도움말 */}
            <button
              onClick={() => setTab('help')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                background: C.yellow, border: `3px solid ${C.border}`,
                borderRadius: R.wobblyMd, boxShadow: S.base,
                padding: '14px 18px', marginBottom: 12,
                fontSize: 15, fontWeight: 700, color: C.text,
                textAlign: 'left', transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = S.small }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = S.base }}
            >
              <span style={{ fontSize: 24 }}>📖</span>
              <div>
                <div>도움말 보기</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: '#888', marginTop: 2 }}>캘린더 사용법 & 데이터 동기화 안내</div>
              </div>
            </button>

            {/* 구글시트 */}
            <button
              onClick={() => { window.open(SHEET_URL, '_blank', 'noopener,noreferrer'); onClose() }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                background: C.white, border: `3px solid ${C.border}`,
                borderRadius: R.wobblyMd, boxShadow: S.base,
                padding: '14px 18px', marginBottom: 20,
                fontSize: 15, fontWeight: 700, color: C.text,
                textAlign: 'left', transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = S.small }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = S.base }}
            >
              <span style={{ fontSize: 24 }}>📊</span>
              <div>
                <div>구글 시트 열기</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: '#888', marginTop: 2 }}>일정 데이터를 직접 확인·수정해요</div>
              </div>
            </button>

            <button onClick={onClose} className="btn-muted" style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700 }}>
              닫기
            </button>
          </>
        )}

        {tab === 'help' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <button
                onClick={() => setTab('menu')}
                style={{
                  width: 32, height: 32, borderRadius: R.wobblyMd,
                  border: `2px solid ${C.border}`, background: C.muted,
                  fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >←</button>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>📖 도움말</h3>
            </div>

            {[
              {
                emoji: '⏱️',
                title: '자동 데이터 수집',
                body: '소모임 대문 페이지의 [관심사] 게시글 최근 4개를 6시간마다 자동으로 가져와요. 별도로 새로고침하지 않아도 돼요.',
              },
              {
                emoji: '🔄',
                title: '스마트 업데이트',
                body: '게시글 제목이나 내용이 바뀌어도, 작성자 · 일정 시작일 · 일정 종료일이 동일하면 같은 일정으로 인식해서 자동으로 업데이트돼요. 중복 등록 걱정 없어요!',
              },
              {
                emoji: '📅',
                title: '날짜 선택',
                body: '캘린더에서 날짜를 탭하면 해당 날짜의 일정 목록이 아래에 펼쳐져요. 같은 날짜를 다시 탭하면 선택이 해제돼요.',
              },
              {
                emoji: '🎨',
                title: '일정 색상',
                body: '각 일정의 색상은 일정 ID를 기반으로 자동 배정돼요. 매번 같은 색으로 표시돼요.',
              },
              {
                emoji: '📌',
                title: '이벤트 바',
                body: '여러 날에 걸친 일정은 캘린더에서 가로 막대로 표시돼요. 해당 주 안에서 날짜 범위만큼 길게 이어져요. 같은 날 일정이 1개뿐이면 막대가 두 배 높이로 크게 표시돼요.',
              },
            ].map(({ emoji, title, body }) => (
              <div key={title} style={{
                background: C.white, border: `2px solid ${C.border}`,
                borderRadius: R.wobblyMd, boxShadow: S.small,
                padding: '13px 15px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accentBlue, marginBottom: 4 }}>
                  {emoji} {title}
                </div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{body}</div>
              </div>
            ))}

            <button onClick={onClose} className="btn-muted" style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
              닫기
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── 헤더 ─────────────────────────────────────────────────────
function Header({ view, onBack, isDesktop, canInstall, onInstall }) {
  const isCalendar = view === VIEW.CALENDAR
  const [showAdmin, setShowAdmin] = useState(false)

  return (
    <>
      <div style={{
        background: C.white,
        borderBottom: `3px dashed ${C.border}`,
        padding: isDesktop ? '12px 40px' : '10px 16px',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
      }}>
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          maxWidth: isDesktop ? 1200 : '100%', margin: '0 auto',
        }}>
          {/* 좌측: 뒤로가기 or 설치 버튼 */}
          <div style={{ flexShrink: 0 }}>
            {onBack ? (
              <button onClick={onBack} style={{
                width: 38, height: 38,
                borderRadius: R.wobblyMd,
                border: `3px solid ${C.border}`,
                background: C.muted, boxShadow: S.small,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700,
              }} className="btn-muted">←</button>
            ) : canInstall ? (
              <button onClick={onInstall} title="홈 화면에 추가" style={{
                width: 38, height: 38,
                borderRadius: R.wobblyMd,
                border: `3px solid ${C.border}`,
                background: C.muted, boxShadow: S.small,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }} className="btn-muted">⬇️</button>
            ) : (
              <div style={{ width: 38, height: 38 }} />
            )}
          </div>

          {/* 타이틀 — 절대 가운데 고정 */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            pointerEvents: 'none',
          }}>
            {isCalendar ? (
              <h1 style={{
                fontSize: isDesktop ? 24 : 20, fontWeight: 700,
                color: C.text, lineHeight: 1,
                transform: 'rotate(-1deg)', display: 'inline-block',
                margin: 0,
              }}>📆고난 캘린더🌄</h1>
            ) : (
              <h2 style={{ fontSize: isDesktop ? 20 : 17, fontWeight: 700, color: C.text, margin: 0 }}>
                여행 상세 📋
              </h2>
            )}
          </div>

          {/* 물음표 버튼 — 우측 끝 */}
          <button
            onClick={() => setShowAdmin(true)}
            style={{
              marginLeft: 'auto', width: 38, height: 38, flexShrink: 0,
              borderRadius: R.wobblyMd, border: `3px solid ${C.border}`,
              background: C.muted, boxShadow: S.small,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, fontWeight: 900, color: C.text,
              position: 'relative', zIndex: 2,
            }}
            className="btn-muted"
          >?</button>
        </div>
      </div>

      {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
    </>
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
        @keyframes _bounce { 0%,100% { transform: translate(calc(-50% + 4px),calc(-50% + 2px)) translateY(0) } 50% { transform: translate(calc(-50% + 4px),calc(-50% + 2px)) translateY(-6px) } }
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
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 26, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32,
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
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7  // 월요일=0 기준
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthStart = toDateStr(year, month, 1)
  const monthEnd = toDateStr(year, month, daysInMonth)
  const [showTitles, setShowTitles] = useState(() => {
    try { return localStorage.getItem('cal_showTitles') !== '0' } catch { return true }
  })

  const visibleEvents = events
    .filter(ev => ev.startDate <= monthEnd && ev.endDate >= monthStart)
    .sort((a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.id.localeCompare(b.id))

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ margin: isDesktop ? 0 : '16px', position: 'relative' }}>
      {/* 테이프 장식 — 캘린더 테두리 바깥 래퍼에서 렌더링해서 테두리 위에 표시 */}
      <div style={{
        position: 'absolute', top: -7, left: '30%',
        transform: 'rotate(-1.5deg)',
        width: 52, height: 14, background: 'rgba(200,200,200,0.5)',
        borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)', zIndex: 2,
      }} />
    <div style={{
      background: C.white,
      border: `3px solid ${C.border}`,
      borderRadius: R.wobblyLg,
      boxShadow: S.large,
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* 월 네비 + 토글 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '17px 16px 13px',
        borderBottom: `2px dashed ${C.muted}`,
      }}>
        {/* 이전/월타이틀/다음 — 바짝 붙인 그룹 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => onMonthChange(-1)} className="month-nav-btn" style={{
            width: 30, height: 30, borderRadius: R.wobblyMd,
            border: `2px solid ${C.border}`, background: C.muted,
            boxShadow: S.small,
            fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>‹</button>

          <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={onMonthClick}>
            <h2 style={{
              fontSize: 20, fontWeight: 700, color: C.text,
              display: 'inline-block', transform: 'rotate(-0.5deg)',
              textDecoration: 'underline dotted', textUnderlineOffset: 4,
              margin: 0,
            }}>
              {month + 1}월
            </h2>
            <span style={{ marginLeft: 5, fontSize: 13, color: '#888', fontFamily: "'Noto Sans KR', 'Patrick Hand', cursive" }}>{year}</span>
          </div>

          <button onClick={() => onMonthChange(1)} className="month-nav-btn" style={{
            width: 30, height: 30, borderRadius: R.wobblyMd,
            border: `2px solid ${C.border}`, background: C.muted,
            boxShadow: S.small,
            fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>›</button>
        </div>

        {/* 제목 보기 토글 — 우측 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, color: '#888', fontFamily: "'Noto Sans KR', sans-serif" }}>제목</span>
          <div
            onClick={() => {
              const next = !showTitles
              setShowTitles(next)
              try { localStorage.setItem('cal_showTitles', next ? '1' : '0') } catch {}
            }}
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: showTitles ? C.accentBlue : C.muted,
              border: `2px solid ${C.border}`,
              position: 'relative', cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: S.small,
            }}
          >
            <div style={{
              position: 'absolute', top: 1,
              left: showTitles ? 17 : 1,
              width: 14, height: 14, borderRadius: '50%',
              background: C.white, border: `1.5px solid ${C.border}`,
              transition: 'left 0.2s',
            }} />
          </div>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: C.muted, padding: '4px 0' }}>
        {DAYS_KR.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 12, fontWeight: 700,
            color: i === 6 ? C.accent : i === 5 ? C.accentBlue : '#555',
            padding: '5px 0', fontFamily: "'Noto Sans KR', 'Kalam', cursive",
          }}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 — 주(week) 단위로 렌더링해서 이벤트 바가 여러 칸에 걸치게 함 */}
      {(() => {
        const weeks = []
        for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
        const cellH  = isDesktop ? (showTitles ? 114 : 72)  : (showTitles ? 100 : 64)
        const barH   = isDesktop ? (showTitles ? 14  : 7)   : (showTitles ? 18  : 9)
        const barTop = isDesktop ? (showTitles ? 32  : 28)  : (showTitles ? 30  : 26)
        const barGap = isDesktop ? (showTitles ? 16  : 10)  : (showTitles ? 20  : 12)

        return (
          <div style={{ paddingBottom: 8 }}>
            {weeks.map((week, wIdx) => {
              // 이 주의 날짜 문자열 배열 (null = 패딩 칸)
              const weekDates = week.map((d) => d !== null ? toDateStr(year, month, d) : null)
              const weekStart = weekDates.find(Boolean)
              const weekEnd   = [...weekDates].reverse().find(Boolean)

              // 이 주에 걸치는 이벤트의 컬럼 범위 계산
              const weekEvItems = weekStart && weekEnd
                ? visibleEvents.map(ev => {
                    if (ev.startDate > weekEnd || ev.endDate < weekStart) return null
                    // startCol: 이벤트 시작이 이 주 이전이면 첫 번째 유효 칸
                    let startCol = weekDates.findIndex(d => d !== null && d >= ev.startDate)
                    if (startCol === -1) startCol = weekDates.findIndex(d => d !== null)
                    // endCol: 이벤트 끝이 이 주 이후면 마지막 유효 칸
                    let endCol = -1
                    for (let i = 6; i >= 0; i--) {
                      if (weekDates[i] !== null && weekDates[i] <= ev.endDate) { endCol = i; break }
                    }
                    if (endCol === -1) endCol = startCol
                    return { ev, startCol, endCol }
                  }).filter(Boolean)
                : []

              // 슬롯 배정 (겹치지 않게 greedy)
              const slotted = []
              for (const item of weekEvItems) {
                let slot = 0
                while (slotted.some(s =>
                  s.slot === slot && s.startCol <= item.endCol && s.endCol >= item.startCol
                )) slot++
                slotted.push({ ...item, slot })
              }

              return (
                <div key={wIdx} style={{ position: 'relative' }}>
                  {/* 날짜 숫자 레이어 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                    {week.map((d, dayIdx) => {
                      if (d === null) return <div key={`e-${wIdx}-${dayIdx}`} style={{ height: cellH }} />
                      const dateStr = toDateStr(year, month, d)
                      const isToday = dateStr === today
                      const isSel   = dateStr === selectedDate
                      const dow     = dayIdx // 월요일=0
                      const overflowCount = slotted.filter(s =>
                        s.slot >= MAX_SLOTS &&
                        s.ev.startDate <= dateStr && s.ev.endDate >= dateStr
                      ).length

                      return (
                        <div
                          key={dateStr}
                          onClick={() => onSelectDate(dateStr)}
                          className="day-cell-clickable"
                          style={{
                            height: cellH, position: 'relative', cursor: 'pointer',
                            background: isSel ? '#fffacd' : 'transparent',
                            transition: 'background 0.15s',
                          }}
                        >
                          {/* 오늘 날짜 — 셀 전체 빨간 테두리 (이벤트 바 아래) */}
                          {isToday && (
                            <div style={{
                              position: 'absolute', inset: '1px 2px',
                              border: `2px solid ${C.accent}`,
                              borderRadius: 6,
                              zIndex: 1, pointerEvents: 'none',
                            }} />
                          )}
                          <div style={{
                            position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                            width: 28, height: 28,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 2,
                            fontWeight: isToday ? 700 : isSel ? 800 : 400,
                            fontSize: 13,
                            color: isToday ? C.accent : isSel ? '#7a6000' : dow === 6 ? C.accent : dow === 5 ? C.accentBlue : C.text,
                            fontFamily: isToday || isSel ? "'Noto Sans KR', 'Kalam', cursive" : "'Noto Sans KR', 'Patrick Hand', cursive",
                          }}>{d}</div>

                          {overflowCount > 0 && (
                            <div style={{ position: 'absolute', bottom: 2, right: 3, fontSize: 9, color: '#888', fontWeight: 700 }}>
                              +{overflowCount}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* 이벤트 바 레이어 — absolute, 여러 칸에 걸쳐 표시 */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 3 }}>
                    {slotted.filter(s => s.slot < MAX_SLOTS).map(({ ev, startCol, endCol, slot }) => {
                      const isActualStart = weekDates[startCol] === ev.startDate
                      const isActualEnd   = weekDates[endCol]   === ev.endDate
                      const span = endCol - startCol + 1

                      // 이 이벤트의 시작 날짜에 일정이 1개뿐이면 2배 높이 + 2줄 텍스트
                      const startDateStr = isActualStart ? weekDates[startCol] : null
                      const eventsOnStartDate = startDateStr
                        ? slotted.filter(s => s.ev.startDate <= startDateStr && s.ev.endDate >= startDateStr).length
                        : 99
                      const isSolo = isActualStart && eventsOnStartDate === 1 && showTitles
                      const thisBarH = isSolo ? barH * 2 : barH

                      return (
                        <div key={ev.id} style={{
                          position: 'absolute',
                          top: barTop + slot * barGap,
                          height: thisBarH,
                          left:  `calc(${startCol / 7 * 100}% + ${isActualStart ? 4 : 2}px)`,
                          width: `calc(${span / 7 * 100}% - ${(isActualStart ? 4 : 2) + (isActualEnd ? 4 : 2)}px)`,
                          background: getEventColor(ev),
                          borderRadius: [
                            isActualStart ? 4 : 0,
                            isActualEnd   ? 4 : 0,
                            isActualEnd   ? 4 : 0,
                            isActualStart ? 4 : 0,
                          ].map(v => v + 'px').join(' '),
                          zIndex: 1,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: isSolo ? 'flex-start' : 'center',
                          paddingLeft: isActualStart ? 5 : 2,
                          paddingRight: 4,
                          paddingTop: isSolo ? 3 : 0,
                        }}>
                          {showTitles && (
                            isSolo ? (
                              <span style={{
                                fontSize: isDesktop ? 12 : 11, fontWeight: 700, color: '#fff',
                                lineHeight: 1.3,
                                fontFamily: "'Noto Sans KR', sans-serif",
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}>{ev.title}</span>
                            ) : (
                              <span style={{
                                fontSize: isDesktop ? 12 : 11, fontWeight: 700, color: '#fff',
                                whiteSpace: 'nowrap', overflow: 'hidden',
                                textOverflow: 'ellipsis', lineHeight: 1,
                                fontFamily: "'Noto Sans KR', sans-serif",
                              }}>{ev.title}</span>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
    </div>
  )
}

// ── 일정 목록 ────────────────────────────────────────────────
function EventList({ date, year, month, events, onSelect }) {
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
      {isMonthView && <p style={{ fontSize: 13, color: '#888' }}>소모임 게시글이 자동으로 반영돼요 ☁️</p>}
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
    </div>
  )
}

// ── 일정 상세 ────────────────────────────────────────────────
function EventDetail({ event }) {
  const nights = dayDiff(event.startDate, event.endDate)
  const color = getEventColor(event)

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

        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 0 }}>
          ✈️ {event.title}
        </h2>
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
        }}>📝 상세 정보</div>
        <p style={{
          fontSize: 15, color: event.content ? C.text : '#aaa',
          lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          margin: '0 0 16px', fontStyle: event.content ? 'normal' : 'italic',
        }}>
          {event.content || '상세 정보가 없어요.'}
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
          🔗 소모임에서 참석 신청하기
        </a>
      </div>
    </div>
  )
}

// ── 비밀번호 모달 ─────────────────────────────────────────────

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
  const [syncing, setSyncing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [view, setView] = useState(VIEW.CALENDAR)
  const [selectedEvent, setSelectedEvent] = useState(null)
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

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await gasSync()
      if (res.status === 'ok') {
        setEvents(res.data)
        showToast(`✅ ${res.upserted}개 일정을 불러왔어요!`)
      } else {
        showToast('❌ 불러오기 실패')
      }
    } catch {
      showToast('❌ 서버 연결 실패')
    } finally {
      setSyncing(false)
    }
  }

  const isDesktop = useIsDesktop()
  const { canInstall, isInstalled, isIOS, hasNativePrompt, install } = useInstallPrompt()
  const [showInstallGuide, setShowInstallGuide] = useState(false)

  const onBack = view === VIEW.DETAIL ? () => setView(VIEW.CALENDAR) : null

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
      <Header view={view} onBack={onBack} isDesktop={isDesktop} canInstall={canInstall}
        onInstall={
          isInstalled    ? () => showToast('✅ 이미 설치되어 있습니다!') :
          hasNativePrompt ? install :
          () => setShowInstallGuide(true)
        } />

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
                  <EventList date={selectedDate} year={year} month={month} events={events} onSelect={handleSelectEvent} />
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
                  <EventList date={selectedDate} year={year} month={month} events={events} onSelect={handleSelectEvent} />
                </div>
              </div>
            )}

            {view === VIEW.DETAIL && selectedEvent && (
              isDesktop ? (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px' }}>
                  <div style={desktopCardStyle}>
                    <EventDetail event={selectedEvent} />
                  </div>
                </div>
              ) : (
                <EventDetail event={selectedEvent} />
              )
            )}
          </>
        )}
      </div>

      {toast && <Toast msg={toast} />}
      {showInstallGuide && <InstallGuideModal isIOS={isIOS} onClose={() => setShowInstallGuide(false)} />}
    </div>
  )
}
