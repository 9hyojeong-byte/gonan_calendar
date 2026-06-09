import { useState, useEffect } from 'react'

// ── GAS 엔드포인트 ────────────────────────────────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyhrCRIJkD2BpW4p9GQYR1oS1GuEsAJ7ONijgQlb9Dzml3S5SSl1Fgi_d1kGJ5WYyrrMg/exec'

async function gasGet() {
  const res = await fetch(GAS_URL, { redirect: 'follow' })
  return res.json()
}

// Content-Type: text/plain → CORS preflight 없이 POST 가능
async function gasPost(body) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
    redirect: 'follow',
  })
  return res.json()
}

// ── 디자인 토큰 ───────────────────────────────────────────────
const C = {
  grad: 'linear-gradient(135deg, #2d6a4f 0%, #52b788 100%)',
  primary: '#2d6a4f',
  primaryDark: '#1b4332',
  primaryLight: '#d8f3dc',
  accent: '#52b788',
  text: '#1b2e23',
  textSub: '#4a6741',
  textMuted: '#7a9e7e',
  border: '#d8f3dc',
  bg: '#f0faf3',
  white: '#ffffff',
  danger: '#ef4444',
  dangerLight: '#fef2f2',
}

const PALETTE = [
  '#40916c', '#52b788', '#1a759f', '#e76f51',
  '#9b5de5', '#f4a261', '#2196f3', '#e91e63',
]

function getEventColor(ev) {
  let h = 0
  for (const c of ev.id) h = (h * 31 + c.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

// ── 유틸 ─────────────────────────────────────────────────────
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

const VIEW = { CALENDAR: 'calendar', DETAIL: 'detail', FORM: 'form' }
const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토']
const MAX_SLOTS = 3

// ── 헤더 ─────────────────────────────────────────────────────
function Header({ view, onBack, onAdd }) {
  const isCalendar = view === VIEW.CALENDAR
  return (
    <div style={{ background: C.grad, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{
          width: 38, height: 38, borderRadius: '50%',
          background: onBack ? 'rgba(255,255,255,0.2)' : 'transparent',
          color: C.white, fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: onBack ? 1 : 0, pointerEvents: onBack ? 'auto' : 'none',
        }}>←</button>
        {isCalendar ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, marginBottom: 2 }}>✈️ GONAN CREW</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.white, letterSpacing: '-0.5px' }}>여행 캘린더</div>
          </div>
        ) : (
          <span style={{ fontWeight: 700, fontSize: 17, color: C.white }}>
            {view === VIEW.DETAIL ? '여행 상세' : '일정 등록'}
          </span>
        )}
        <button onClick={onAdd} style={{
          width: 38, height: 38, borderRadius: '50%',
          background: onAdd ? 'rgba(255,255,255,0.25)' : 'transparent',
          color: C.white, fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: onAdd ? 1 : 0, pointerEvents: onAdd ? 'auto' : 'none',
        }}>+</button>
      </div>
    </div>
  )
}

// ── 로딩 스피너 ───────────────────────────────────────────────
function Spinner({ fullPage }) {
  const inner = (
    <div style={{ textAlign: 'center', color: C.textMuted, padding: 40 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${C.primaryLight}`,
        borderTopColor: C.primary,
        animation: 'spin 0.8s linear infinite',
        margin: '0 auto 12px',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ fontSize: 13 }}>불러오는 중...</div>
    </div>
  )
  if (!fullPage) return inner
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      {inner}
    </div>
  )
}

// ── 캘린더 ───────────────────────────────────────────────────
function Calendar({ year, month, events, selectedDate, onSelectDate, onMonthChange }) {
  const today = todayStr()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthStart = toDateStr(year, month, 1)
  const monthEnd = toDateStr(year, month, daysInMonth)

  const visibleEvents = events
    .filter(ev => ev.startDate <= monthEnd && ev.endDate >= monthStart)
    .sort((a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.id.localeCompare(b.id))

  function getSlottedEvents(dateStr) {
    return visibleEvents.filter(ev => eventCoversDate(ev, dateStr))
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{
      margin: '12px 16px 0', borderRadius: 20,
      background: C.white, boxShadow: '0 4px 20px rgba(45,106,79,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 8px 10px' }}>
        <button onClick={() => onMonthChange(-1)} style={{
          width: 36, height: 36, borderRadius: '50%', background: C.bg,
          color: C.textSub, fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 20, color: C.text }}>{month + 1}월</span>
          <span style={{ marginLeft: 6, fontSize: 14, color: C.textMuted }}>{year}</span>
        </div>
        <button onClick={() => onMonthChange(1)} style={{
          width: 36, height: 36, borderRadius: '50%', background: C.bg,
          color: C.textSub, fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 4px' }}>
        {DAYS_KR.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 700,
            color: i === 0 ? '#f43f5e' : i === 6 ? C.primary : C.textMuted,
            padding: '6px 0',
          }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', paddingBottom: 16 }}>
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e-${idx}`} style={{ height: 62 }} />
          const dateStr = toDateStr(year, month, d)
          const slottedEvs = getSlottedEvents(dateStr)
          const hasEvents = slottedEvs.length > 0
          const isToday = dateStr === today
          const isSel = dateStr === selectedDate
          const dow = (firstDay + d - 1) % 7
          const overflowCount = Math.max(0, slottedEvs.length - MAX_SLOTS)

          return (
            <div key={dateStr} onClick={() => hasEvents && onSelectDate(dateStr)} style={{
              height: 62, position: 'relative',
              cursor: hasEvents ? 'pointer' : 'default',
            }}>
              <div style={{
                position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
                background: isSel ? C.primary : isToday ? C.primaryLight : 'transparent',
                fontWeight: isSel || isToday ? 800 : 400,
                fontSize: 13,
                color: isSel ? C.white : dow === 0 ? '#f43f5e' : dow === 6 ? C.primary : C.text,
              }}>{d}</div>

              {slottedEvs.slice(0, MAX_SLOTS).map((ev, slotIdx) => {
                const isActualStart = dateStr === ev.startDate
                const isActualEnd = dateStr === ev.endDate
                const isRowStart = dow === 0
                const isRowEnd = dow === 6
                const leftRound = isActualStart
                const rightRound = isActualEnd
                const leftInset = leftRound ? 5 : isRowStart ? 2 : 0
                const rightInset = rightRound ? 5 : isRowEnd ? 2 : 0
                const br = [
                  leftRound ? 5 : isRowStart ? 3 : 0,
                  rightRound ? 5 : isRowEnd ? 3 : 0,
                  rightRound ? 5 : isRowEnd ? 3 : 0,
                  leftRound ? 5 : isRowStart ? 3 : 0,
                ].map(v => v + 'px').join(' ')

                return (
                  <div key={ev.id} style={{
                    position: 'absolute',
                    top: 36 + slotIdx * 8, height: 6,
                    left: leftInset, right: rightInset,
                    background: getEventColor(ev),
                    borderRadius: br, opacity: 0.9, zIndex: 1,
                  }} />
                )
              })}

              {overflowCount > 0 && (
                <div style={{
                  position: 'absolute', bottom: 2, right: 3,
                  fontSize: 9, color: C.textMuted, fontWeight: 700,
                }}>+{overflowCount}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 일정 목록 ────────────────────────────────────────────────
function EventList({ date, events, onSelect }) {
  const filtered = events
    .filter(ev => eventCoversDate(ev, date))
    .sort((a, b) => a.startDate < b.startDate ? -1 : 1)

  if (!date || filtered.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: C.textMuted }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
      <div style={{ fontWeight: 600, marginBottom: 6, color: C.textSub }}>아직 여행 일정이 없어요</div>
      <div style={{ fontSize: 13 }}>우상단 + 버튼으로 첫 여행을 등록해보세요!</div>
    </div>
  )

  const { m, d, dowKr } = formatDate(date)

  return (
    <div style={{ padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          background: C.grad, color: C.white, borderRadius: 12,
          padding: '6px 14px', fontSize: 13, fontWeight: 700,
        }}>{m}월 {d}일 ({dowKr})</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>일정 {filtered.length}개</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(ev => {
          const nights = dayDiff(ev.startDate, ev.endDate)
          return (
            <button key={ev.id} onClick={() => onSelect(ev)} style={{
              width: '100%', textAlign: 'left', background: C.white,
              border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(45,106,79,0.08)',
            }}>
              <div style={{ height: 5, background: getEventColor(ev) }} />
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 15 }}>✈️</span>
                      <span style={{
                        fontWeight: 700, fontSize: 15, color: C.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{ev.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📅 {fmtRange(ev)}</span>
                      {nights > 0 && (
                        <span style={{
                          background: C.primaryLight, color: C.primary,
                          borderRadius: 6, padding: '1px 6px', fontSize: 11, fontWeight: 700,
                        }}>{nights}박 {nights + 1}일</span>
                      )}
                    </div>
                    {ev.content && (
                      <div style={{
                        marginTop: 6, fontSize: 13, color: C.textSub, lineHeight: 1.5,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>{ev.content}</div>
                    )}
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: C.bg,
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: C.primary, fontSize: 14,
                  }}>›</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 일정 상세 ────────────────────────────────────────────────
function EventDetail({ event, onEdit, onDelete }) {
  const nights = dayDiff(event.startDate, event.endDate)
  return (
    <div style={{ flex: 1 }}>
      <div style={{ background: C.grad, padding: '24px 24px 32px', marginTop: -1 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
          📅 {fmtRange(event)}
          {nights > 0 && (
            <span style={{
              marginLeft: 8, background: 'rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700,
            }}>{nights}박 {nights + 1}일</span>
          )}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.white, lineHeight: 1.3, letterSpacing: '-0.5px' }}>
          {event.title}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          등록: {new Date(event.createdAt).toLocaleDateString('ko-KR')}
        </div>
      </div>

      <div style={{ padding: '20px 20px 100px' }}>
        <div style={{
          background: C.white, borderRadius: 20, padding: '20px', marginTop: -16,
          boxShadow: '0 4px 24px rgba(45,106,79,0.12)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
            여행 내용
          </div>
          <div style={{
            fontSize: 15, color: event.content ? C.text : C.textMuted,
            lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: 80,
          }}>
            {event.content || '등록된 내용이 없습니다.'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={onEdit} style={{
            flex: 1, padding: '15px', borderRadius: 16, fontSize: 15, fontWeight: 700,
            background: C.primaryLight, color: C.primary, border: `1.5px solid ${C.primary}20`,
          }}>✏️ 수정</button>
          <button onClick={onDelete} style={{
            flex: 1, padding: '15px', borderRadius: 16, fontSize: 15, fontWeight: 700,
            background: C.dangerLight, color: C.danger, border: `1.5px solid ${C.danger}20`,
          }}>🗑️ 삭제</button>
        </div>
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
    if (!pw.trim()) { setErr('비밀번호를 입력해주세요.'); return }
    onConfirm(pw.trim())
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(30,75,50,0.5)',
        display: 'flex', alignItems: 'flex-end', zIndex: 100, backdropFilter: 'blur(4px)',
      }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        background: C.white, borderRadius: '24px 24px 0 0', padding: '8px 0 0',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '12px auto 20px' }} />
        <div style={{ padding: '0 24px 40px' }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 20 }}>🔒 등록 시 설정한 비밀번호를 입력하세요.</div>
          <form onSubmit={handleSubmit}>
            <input
              type="password" autoFocus value={pw}
              onChange={e => { setPw(e.target.value); setErr('') }}
              placeholder="비밀번호"
              disabled={loading}
              style={{
                width: '100%', padding: '15px 16px', borderRadius: 14, fontSize: 15,
                border: `1.5px solid ${err ? C.danger : C.border}`,
                outline: 'none', background: C.bg, marginBottom: 6, boxSizing: 'border-box',
              }}
            />
            {err && <div style={{ color: C.danger, fontSize: 12, marginBottom: 10 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" onClick={onCancel} disabled={loading} style={{
                flex: 1, padding: 15, borderRadius: 14, fontSize: 15, fontWeight: 600,
                background: C.bg, color: C.textSub, opacity: loading ? 0.5 : 1,
              }}>취소</button>
              <button type="submit" disabled={loading} style={{
                flex: 2, padding: 15, borderRadius: 14, fontSize: 15, fontWeight: 800,
                background: C.grad, color: C.white, border: 'none',
                opacity: loading ? 0.7 : 1,
              }}>{loading ? '처리 중...' : '확인'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── 폼 필드 래퍼 (컴포넌트 외부 정의 필수) ──────────────────
function FormField({ label, error, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 700,
        color: C.primary, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
      }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 5 }}>{hint}</div>}
      {error && <div style={{ color: C.danger, fontSize: 12, marginTop: 5 }}>{error}</div>}
    </div>
  )
}

function inputCss(hasErr) {
  return {
    width: '100%', padding: '15px 16px', borderRadius: 14, fontSize: 15,
    border: `1.5px solid ${hasErr ? C.danger : C.border}`,
    outline: 'none', background: C.bg, boxSizing: 'border-box',
  }
}

// ── 등록/수정 폼 ──────────────────────────────────────────────
function EventForm({ initialDate, editEvent, onSave, onCancel, submitting }) {
  const [startDate, setStartDate] = useState(editEvent?.startDate || initialDate || todayStr())
  const [endDate, setEndDate] = useState(editEvent?.endDate || initialDate || todayStr())
  const [title, setTitle] = useState(editEvent?.title || '')
  const [content, setContent] = useState(editEvent?.content || '')
  const [pw, setPw] = useState('')
  const [errors, setErrors] = useState({})

  function handleStartDate(val) {
    setStartDate(val)
    if (val > endDate) setEndDate(val)
    setErrors(v => ({ ...v, startDate: null }))
  }

  function validate() {
    const e = {}
    if (!title.trim()) e.title = '여행 제목을 입력해주세요.'
    if (!startDate) e.startDate = '시작 날짜를 선택해주세요.'
    if (!endDate) e.endDate = '종료 날짜를 선택해주세요.'
    if (endDate < startDate) e.endDate = '종료 날짜는 시작 날짜 이후여야 합니다.'
    if (!editEvent && !pw.trim()) e.pw = '비밀번호를 입력해주세요.'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (editEvent) {
      onSave({ ...editEvent, startDate, endDate, title: title.trim(), content: content.trim() })
    } else {
      onSave({
        id: Date.now().toString(),
        startDate, endDate,
        title: title.trim(), content: content.trim(),
        pwHash: simpleHash(pw.trim()),
        createdAt: new Date().toISOString(),
      })
    }
  }

  const nights = startDate && endDate ? dayDiff(startDate, endDate) : 0

  return (
    <div style={{ flex: 1 }}>
      <div style={{ background: C.grad, padding: '24px', display: 'flex', alignItems: 'center', gap: 12, marginTop: -1 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>✈️</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>
            {editEvent ? '여행 일정 수정' : '새 여행 등록'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            {editEvent ? '내용을 수정하세요' : '고난크루의 새 여행을 공유하세요'}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px 20px 100px' }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block', fontSize: 12, fontWeight: 700,
            color: C.primary, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
          }}>📅 여행 날짜</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>시작</div>
              <input type="date" value={startDate} onChange={e => handleStartDate(e.target.value)} style={inputCss(errors.startDate)} />
            </div>
            <div style={{ paddingTop: 26, color: C.textMuted, fontWeight: 700, fontSize: 16 }}>~</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>종료</div>
              <input type="date" value={endDate} min={startDate}
                onChange={e => { setEndDate(e.target.value); setErrors(v => ({ ...v, endDate: null })) }}
                style={inputCss(errors.endDate)} />
            </div>
          </div>
          {errors.startDate && <div style={{ color: C.danger, fontSize: 12, marginTop: 5 }}>{errors.startDate}</div>}
          {errors.endDate && <div style={{ color: C.danger, fontSize: 12, marginTop: 5 }}>{errors.endDate}</div>}
          {nights > 0 && (
            <div style={{
              marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: C.primaryLight, borderRadius: 10, padding: '6px 12px',
            }}>
              <span style={{ fontSize: 14 }}>🌙</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{nights}박 {nights + 1}일</span>
            </div>
          )}
        </div>

        <FormField label="🗺️ 여행 제목" error={errors.title}>
          <input type="text" value={title}
            onChange={e => { setTitle(e.target.value); setErrors(v => ({ ...v, title: null })) }}
            placeholder="예) 제주도 3박 4일" style={inputCss(errors.title)} />
        </FormField>

        <FormField label="📝 여행 내용" error={null}>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={"장소, 숙소, 준비물 등\n자유롭게 적어주세요 🏖️"}
            rows={5} style={{ ...inputCss(false), resize: 'vertical', lineHeight: 1.7 }} />
        </FormField>

        {!editEvent && (
          <FormField label="🔒 비밀번호" error={errors.pw} hint="이 비밀번호로만 수정·삭제할 수 있습니다.">
            <input type="password" value={pw}
              onChange={e => { setPw(e.target.value); setErrors(v => ({ ...v, pw: null })) }}
              placeholder="수정·삭제 시 사용할 비밀번호" style={inputCss(errors.pw)} />
          </FormField>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button type="button" onClick={onCancel} disabled={submitting} style={{
            flex: 1, padding: '16px', borderRadius: 16, fontSize: 15, fontWeight: 600,
            background: C.bg, color: C.textSub, opacity: submitting ? 0.5 : 1,
          }}>취소</button>
          <button type="submit" disabled={submitting} style={{
            flex: 2, padding: '16px', borderRadius: 16, fontSize: 15, fontWeight: 800,
            background: C.grad, color: C.white, border: 'none', opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? '저장 중...' : editEvent ? '✅ 수정 완료' : '🚀 여행 등록'}
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
      position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(27,67,50,0.9)', color: C.white,
      padding: '11px 22px', borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 200,
      whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(45,106,79,0.35)',
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

  // 앱 시작 시 GAS에서 전체 이벤트 로드
  useEffect(() => {
    gasGet()
      .then(res => {
        if (res.status === 'ok') setEvents(res.data)
        else showToast('❌ 데이터를 불러오지 못했습니다.')
      })
      .catch(() => showToast('❌ 서버 연결에 실패했습니다.'))
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

  async function handleSaveEvent(ev) {
    setSubmitting(true)
    try {
      if (editingEvent) {
        const res = await gasPost({ action: 'update', ...ev })
        if (res.status === 'unauthorized') { showToast('🔒 비밀번호가 올바르지 않습니다.'); return }
        if (res.status !== 'updated') { showToast('❌ 수정에 실패했습니다.'); return }
        setEvents(prev => prev.map(e => e.id === ev.id ? ev : e))
        setSelectedEvent(ev)
        setView(VIEW.DETAIL)
        showToast('✅ 일정이 수정되었습니다.')
      } else {
        const res = await gasPost({ action: 'create', ...ev })
        if (res.status !== 'created') { showToast('❌ 등록에 실패했습니다.'); return }
        setEvents(prev => [...prev, ev])
        setSelectedDate(ev.startDate)
        const [y, m] = ev.startDate.split('-').map(Number)
        setYear(y); setMonth(m - 1)
        setView(VIEW.CALENDAR)
        showToast('🚀 여행 일정이 등록되었습니다!')
      }
    } catch {
      showToast('❌ 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
      setEditingEvent(null)
    }
  }

  async function handlePwConfirm(pw) {
    const hash = simpleHash(pw)
    // 클라이언트 1차 검증
    if (hash !== selectedEvent.pwHash) {
      showToast('🔒 비밀번호가 올바르지 않습니다.')
      setPwModal(null); return
    }
    if (pwModal.action === 'edit') {
      setEditingEvent(selectedEvent); setPwModal(null); setView(VIEW.FORM)
      return
    }
    // 삭제: 서버에서 2차 검증 후 삭제
    setSubmitting(true)
    try {
      const res = await gasPost({ action: 'delete', id: selectedEvent.id, pwHash: hash })
      if (res.status === 'unauthorized') { showToast('🔒 비밀번호가 올바르지 않습니다.'); return }
      if (res.status !== 'deleted') { showToast('❌ 삭제에 실패했습니다.'); return }
      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id))
      setSelectedEvent(null); setView(VIEW.CALENDAR)
      showToast('🗑️ 일정이 삭제되었습니다.')
    } catch {
      showToast('❌ 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
      setPwModal(null)
    }
  }

  const onBack = view === VIEW.DETAIL
    ? () => setView(VIEW.CALENDAR)
    : view === VIEW.FORM
    ? () => { if (editingEvent) { setView(VIEW.DETAIL); setEditingEvent(null) } else setView(VIEW.CALENDAR) }
    : null
  const onAdd = view === VIEW.CALENDAR ? handleAddClick : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', background: C.bg }}>
      <Header view={view} onBack={onBack} onAdd={onAdd} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Spinner fullPage />
        ) : (
          <>
            {view === VIEW.CALENDAR && (
              <>
                <Calendar
                  year={year} month={month} events={events}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  onMonthChange={handleMonthChange}
                />
                <div style={{ marginTop: 20 }}>
                  <EventList date={selectedDate} events={events} onSelect={handleSelectEvent} />
                </div>
              </>
            )}
            {view === VIEW.DETAIL && selectedEvent && (
              <EventDetail
                event={selectedEvent}
                onEdit={() => setPwModal({ action: 'edit' })}
                onDelete={() => setPwModal({ action: 'delete' })}
              />
            )}
            {view === VIEW.FORM && (
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
    </div>
  )
}
