// ============================================================
//  고난크루 소모임 캘린더 싱크 — Google Apps Script
//  소모임 게시글 스크래핑 → 구글 스프레드시트 저장 → .ics 서빙
//
//  ※ 이 파일은 기존 GAS.gs 와 별도의 독립된 GAS 프로젝트로 배포하세요.
//     (같은 프로젝트에 넣으면 doGet 함수가 충돌합니다)
//
//  사용 방법:
//    1. 구글 스프레드시트 새로 만들기 → URL에서 ID 복사
//    2. 아래 SOMOIM_SPREADSHEET_ID 에 붙여넣기
//    3. Apps Script 편집기에 이 코드 붙여넣기
//    4. setupTrigger() 한 번 실행 → 6시간마다 자동 싱크 등록
//    5. 배포 > 새 배포 > 웹 앱 / 액세스: 모든 사람
//    6. 배포 URL = Apple/Google Calendar 구독 주소
//
//  구독 URL 예시:
//    https://script.google.com/macros/s/[배포ID]/exec
// ============================================================

const SOMOIM_SHEET_NAME = 'somoim_events'
const GROUP_URL = 'https://www.somoim.co.kr/ee346172-8bf3-11ec-88c3-0ada976e8c451'

// ── 시트 초기화 ──────────────────────────────────────────────
function initSomoimSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()  // 시트에서 열었으면 자동 연결
  let sheet = ss.getSheetByName(SOMOIM_SHEET_NAME)
  if (!sheet) {
    sheet = ss.insertSheet(SOMOIM_SHEET_NAME)
    sheet.appendRow([
      'id', 'title', 'dtstart', 'dtend', 'author',
      'location', 'meeting_point', 'date_raw',
      'posted_at_label', 'source', 'group_url', 'updated_at',
    ])
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#d8f3dc')
    sheet.setFrozenRows(1)
    sheet.setColumnWidths(1, 12, 150)
  }
  return sheet
}

// ── SHA-256 해시 앞 16자 ─────────────────────────────────────
function sha256Hex16(str) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    str,
    Utilities.Charset.UTF_8
  )
  return bytes
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2))
    .join('')
    .slice(0, 16)
}

// ── HTML 엔티티 디코딩 ───────────────────────────────────────
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(+n) })
}

// ── 한국어 날짜 범위 파싱 ────────────────────────────────────
//  "7월 4일~5일" / "8/8~8/9(1박2일)" / "2026년 7월 4일 ~ 5일" / "6/14"
var RANGE_RE = /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*[\/월]\s*(\d{1,2})\s*일?\s*[~∼–-]\s*(?:(\d{1,2})\s*[\/월]\s*)?(\d{1,2})\s*일?/
var SINGLE_RE = /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*[\/월]\s*(\d{1,2})\s*일?/

function fmtDate(y, m, d) {
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0')
}

function parseKoreanDateRange(raw) {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600000)
  const ty = kst.getUTCFullYear()
  const tm = kst.getUTCMonth() + 1
  const td = kst.getUTCDate()

  function resolveYear(explicit, m, d) {
    if (explicit) return +explicit
    const diff = (Date.UTC(ty, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000
    return diff < -7 ? ty + 1 : ty
  }

  const r = raw.match(RANGE_RE)
  if (r) {
    const sm = +r[2], sd = +r[3]
    const em = r[4] ? +r[4] : sm
    const ed = +r[5]
    const y = resolveYear(r[1], sm, sd)
    const ey = em < sm ? y + 1 : y
    return { start: fmtDate(y, sm, sd), end: fmtDate(ey, em, ed) }
  }

  const s = raw.match(SINGLE_RE)
  if (s) {
    const sm = +s[2], sd = +s[3]
    const y = resolveYear(s[1], sm, sd)
    return { start: fmtDate(y, sm, sd), end: null }
  }

  return null
}

// ── 본문 양식 필드 추출 ──────────────────────────────────────
//  "1. 일시: ..." / "3.접선장소/시간 : ..."
function extractField(body, labels) {
  const pattern = new RegExp(
    '\\d?\\s*\\.?\\s*(?:' + labels.join('|') + ')\\s*[:：]\\s*([^\\n]+)'
  )
  const m = body.match(pattern)
  return m ? m[1].trim() : null
}

// ── 소모임 게시판 스크래핑 ───────────────────────────────────
function scrapeBoardEvents() {
  const res = UrlFetchApp.fetch(GROUP_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
    muteHttpExceptions: true,
  })

  if (res.getResponseCode() !== 200) {
    throw new Error('somoim fetch failed: ' + res.getResponseCode())
  }

  const html = res.getContentText('UTF-8')
  const events = []

  // 게시글 카드 패턴 (실측 HTML 구조 기준)
  // ※ 구분자 문자(∙ U+2219)는 인코딩 불일치 방지를 위해 [^<] 로 처리
  const CARD_RE = new RegExp(
    '<p class="text-\\[15px\\] font-bold">([^<]+)</p>' +
    '<p class="text-\\[13px\\][^"]*">(관심사|공지|자유)<span[^>]*>[^<]</span>([^<]+)</p>' +
    '[\\s\\S]*?' +
    '<p class="text-fc_black font-bold mb-2 truncate[^"]*">([\\s\\S]*?)</p>' +
    '<p class="text-article_item_c[^"]*">([\\s\\S]*?)</p>',
    'g'
  )

  let match
  while ((match = CARD_RE.exec(html)) !== null) {
    const label = match[2]
    if (label !== '관심사') continue  // 공지·자유 글 제외

    const author    = decodeEntities(match[1].trim())
    const postedAt  = match[3].trim()
    const title     = decodeEntities(match[4].trim())
    const body      = decodeEntities(match[5].trim())

    // 1차: 본문 양식 필드에서 추출
    var dateRaw      = extractField(body, ['일시', '날짜'])
    var location     = extractField(body, ['장소'])
    var meetingPoint = extractField(body, [
      '집결장소\\/시간', '집결장소', '접선장소\\/시간', '접선장소', '집결', '접선',
    ])

    // 2차: 본문에 날짜 없으면 제목에서 폴백
    if (!dateRaw && (RANGE_RE.test(title) || SINGLE_RE.test(title))) {
      dateRaw = title
      if (!location) {
        const rest = title.replace(RANGE_RE, '').replace(SINGLE_RE, '').trim()
        location = rest.length >= 2 ? rest : null
      }
    }

    const range = dateRaw ? parseKoreanDateRange(dateRaw) : null
    if (!range) continue  // 날짜 파싱 실패 시 스킵

    events.push({
      author, postedAt, title, dateRaw,
      dtstart:      range.start,
      dtend:        range.end,
      location,
      meetingPoint,
      source:       'board',
      groupUrl:     GROUP_URL,
    })
  }

  return events
}

// ── 스프레드시트 upsert ──────────────────────────────────────
//  id 동일하면 업데이트, 없으면 새 행 추가
function upsertToSheet(sheet, rows) {
  const lastRow = sheet.getLastRow()

  // 기존 id → 행 번호 맵
  const idToRow = {}
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues()
      .forEach(function(r, i) { idToRow[String(r[0])] = i + 2 })
  }

  let count = 0
  for (const row of rows) {
    const values = [[
      row.id, row.title, row.dtstart, row.dtend || '',
      row.author || '', row.location || '', row.meeting_point || '',
      row.date_raw || '', row.posted_at_label || '',
      row.source, row.group_url || '', row.updated_at,
    ]]
    if (idToRow[row.id]) {
      sheet.getRange(idToRow[row.id], 1, 1, 12).setValues(values)
    } else {
      sheet.appendRow(values[0])
    }
    count++
  }
  return count
}

// ── 메인 싱크 함수 (트리거로 실행) ───────────────────────────
function syncSomoim() {
  try {
    const sheet  = initSomoimSheet()
    const events = scrapeBoardEvents()

    const rows = events.map(function(e) {
      return {
        id:               sha256Hex16(e.author + '|' + e.dtstart + '|' + (e.dtend || e.dtstart)),
        title:            e.title,
        dtstart:          e.dtstart,
        dtend:            e.dtend,
        author:           e.author,
        location:         e.location,
        meeting_point:    e.meetingPoint,
        date_raw:         e.dateRaw,
        posted_at_label:  e.postedAt,
        source:           'board',
        group_url:        e.groupUrl,
        updated_at:       new Date().toISOString(),
      }
    })

    const count = upsertToSheet(sheet, rows)
    Logger.log('[syncSomoim] 스크래핑: ' + events.length + '건, upsert: ' + count + '건')
    Logger.log('제목: ' + rows.map(function(r) { return r.title }).join(', '))
    return { ok: true, scraped: events.length, upserted: count }
  } catch (err) {
    Logger.log('[syncSomoim] 오류: ' + err.message)
    throw err
  }
}

// ── ICS 생성 헬퍼 ────────────────────────────────────────────
function escICS(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// RFC 5545: 한 줄 75바이트 초과 시 CRLF + 공백으로 폴딩
function foldLine(line) {
  const MAX = 74
  if (line.length <= MAX) return line
  const out = []
  let pos = 0
  while (pos < line.length) {
    if (pos === 0) {
      out.push(line.slice(0, MAX))
      pos = MAX
    } else {
      out.push(' ' + line.slice(pos, pos + MAX - 1))
      pos += MAX - 1
    }
  }
  return out.join('\r\n')
}

function toDateValue(iso) {
  return iso.slice(0, 10).replace(/-/g, '')
}

// DTEND는 exclusive (RFC 5545) — 7/4~7/5 일정이면 DTEND=7/6
function nextDayValue(iso) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function generateICS(rows) {
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//gonancroo//somoim-sync//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine('X-WR-CALNAME:👣 백패킹 고난크루'),
    'X-WR-TIMEZONE:Asia/Seoul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
  ]

  for (const r of rows) {
    const start       = toDateValue(r.dtstart)
    const endExclusive = r.dtend ? nextDayValue(r.dtend) : nextDayValue(r.dtstart)

    const descParts = []
    if (r.meeting_point) descParts.push('집결: ' + r.meeting_point)
    if (r.author)        descParts.push('리딩/작성: ' + r.author)
    if (r.group_url)     descParts.push(r.group_url)

    const summary = r.author
      ? '🏕 ' + r.title + ' [' + r.author + ']'
      : '🏕 ' + r.title

    lines.push('BEGIN:VEVENT')
    lines.push('UID:' + r.id + '@somoim-sync.gonancroo')
    lines.push('DTSTAMP:' + now)
    lines.push('DTSTART;VALUE=DATE:' + start)
    lines.push('DTEND;VALUE=DATE:' + endExclusive)
    lines.push(foldLine('SUMMARY:' + escICS(summary)))
    if (r.location)        lines.push(foldLine('LOCATION:' + escICS(r.location)))
    if (descParts.length)  lines.push(foldLine('DESCRIPTION:' + escICS(descParts.join('\n'))))
    if (r.group_url)       lines.push(foldLine('URL:' + r.group_url))
    lines.push('LAST-MODIFIED:' + now)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

// ── doGet: .ics 파일 서빙 ────────────────────────────────────
//  구독 URL: 이 GAS 배포 URL 그대로 Apple/Google Calendar에 등록
function doGet(e) {
  try {
    const sheet   = initSomoimSheet()
    const lastRow = sheet.getLastRow()
    const rows    = []

    if (lastRow > 1) {
      const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues()
      for (const r of data) {
        if (!r[0]) continue
        rows.push({
          id:            String(r[0]),
          title:         String(r[1]),
          dtstart:       String(r[2]),
          dtend:         r[3] ? String(r[3]) : null,
          author:        r[4] ? String(r[4]) : null,
          location:      r[5] ? String(r[5]) : null,
          meeting_point: r[6] ? String(r[6]) : null,
          group_url:     r[10] ? String(r[10]) : null,
          updated_at:    String(r[11]),
        })
      }
    }

    // dtstart 오름차순 정렬
    rows.sort(function(a, b) {
      return a.dtstart < b.dtstart ? -1 : a.dtstart > b.dtstart ? 1 : 0
    })

    const ics = generateICS(rows)
    return ContentService
      .createTextOutput(ics)
      .setMimeType(ContentService.MimeType.TEXT)

  } catch (err) {
    return ContentService
      .createTextOutput('calendar unavailable: ' + err.message)
      .setMimeType(ContentService.MimeType.TEXT)
  }
}

// ── 트리거 등록 (최초 1회만 실행) ───────────────────────────
//  Apps Script 편집기에서 이 함수를 직접 실행하세요
function setupTrigger() {
  // 기존 syncSomoim 트리거 모두 삭제
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'syncSomoim' })
    .forEach(function(t) { ScriptApp.deleteTrigger(t) })

  // 6시간마다 자동 싱크
  ScriptApp.newTrigger('syncSomoim')
    .timeBased()
    .everyHours(6)
    .create()

  Logger.log('✅ 트리거 등록 완료: syncSomoim 6시간마다 자동 실행')
}
