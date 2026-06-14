// ============================================================
//  고난크루 여행 캘린더 — Google Apps Script (Web App)
//  배포: 확장프로그램 > Apps Script > 배포 > 새 배포
//        유형: 웹 앱 / 액세스: 모든 사람
//  ※ 수정 후 반드시 "새 배포" 또는 "배포 관리 > 버전 업데이트"
// ============================================================
//  시트 컬럼 구조:
//  1:id  2:startDate  3:endDate  4:title  5:content
//  6:pwHash  7:createdAt  8:leader  9:postedAt
// ============================================================

const SHEET_NAME = 'events';
const COL_COUNT  = 9;
const GROUP_URL  = 'https://www.somoim.co.kr/ee346172-8bf3-11ec-88c3-0ada976e8c451';

// ── 시트 초기화 ──────────────────────────────────────────────
function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'startDate', 'endDate', 'title', 'content', 'pwHash', 'createdAt', 'leader', 'postedAt']);
    sheet.getRange(1, 1, 1, COL_COUNT).setFontWeight('bold').setBackground('#d8f3dc');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 110);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 200);
    sheet.setColumnWidth(5, 300);
    sheet.setColumnWidth(6, 120);
    sheet.setColumnWidth(7, 160);
    sheet.setColumnWidth(8, 150);
    sheet.setColumnWidth(9, 200);
  }
  return sheet;
}

// ── JSON / JSONP 응답 ────────────────────────────────────────
function makeResponse(result, callback) {
  const json = JSON.stringify(result);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// 날짜 셀 → yyyy-MM-dd 문자열
function fmtDate(val) {
  if (val instanceof Date && !isNaN(val)) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

function getAllRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const numCols = Math.max(sheet.getLastColumn(), COL_COUNT);
  return sheet.getRange(2, 1, lastRow - 1, numCols).getValues()
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) {
      return {
        id:        String(r[0]),
        startDate: fmtDate(r[1]),
        endDate:   fmtDate(r[2]),
        title:     String(r[3]),
        content:   String(r[4]),
        pwHash:    String(r[5]),
        createdAt: String(r[6]),
        leader:    String(r[7] || ''),
        postedAt:  r[8] instanceof Date ? r[8].toISOString() : String(r[8] || ''),
      };
    });
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
  const idx = ids.indexOf(String(id));
  return idx === -1 ? -1 : idx + 2;
}

// ════════════════════════════════════════════════════════════
//  소모임 스크래퍼 (sync 액션용)
// ════════════════════════════════════════════════════════════

function sha256Hex16(str) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('').slice(0, 16);
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(+n); });
}

var RANGE_RE = /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*[\/월]\s*(\d{1,2})\s*일?\s*[~∼–-]\s*(?:(\d{1,2})\s*[\/월]\s*)?(\d{1,2})\s*일?/;
var SINGLE_RE = /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*[\/월]\s*(\d{1,2})\s*일?/;

function fmtDateStr(y, m, d) {
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function parseKoreanDateRange(raw) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600000);
  const ty = kst.getUTCFullYear(), tm = kst.getUTCMonth() + 1, td = kst.getUTCDate();

  function resolveYear(explicit, m, d) {
    if (explicit) return +explicit;
    const diff = (Date.UTC(ty, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000;
    return diff < -7 ? ty + 1 : ty;
  }

  const r = raw.match(RANGE_RE);
  if (r) {
    const sm = +r[2], sd = +r[3], em = r[4] ? +r[4] : sm, ed = +r[5];
    const y = resolveYear(r[1], sm, sd), ey = em < sm ? y + 1 : y;
    return { start: fmtDateStr(y, sm, sd), end: fmtDateStr(ey, em, ed) };
  }
  const s = raw.match(SINGLE_RE);
  if (s) {
    const sm = +s[2], sd = +s[3], y = resolveYear(s[1], sm, sd);
    return { start: fmtDateStr(y, sm, sd), end: null };
  }
  return null;
}

function extractField(body, labels) {
  const pattern = new RegExp(
    '\\d?\\s*\\.?\\s*(?:' + labels.join('|') + ')\\s*[:：]\\s*([^\\n]+)'
  );
  const m = body.match(pattern);
  return m ? m[1].trim() : null;
}

// 소모임 상대 시각 레이블 → ISO 문자열 (스크래핑 시점 기준)
function resolvePostedAt(label) {
  const s = label.trim();
  const now = new Date();
  if (/방금/.test(s)) return now.toISOString();
  var m;
  m = s.match(/(\d+)\s*분\s*전/);   if (m) return new Date(now - +m[1] * 60000).toISOString();
  m = s.match(/(\d+)\s*시간\s*전/); if (m) return new Date(now - +m[1] * 3600000).toISOString();
  m = s.match(/(\d+)\s*일\s*전/);   if (m) return new Date(now - +m[1] * 86400000).toISOString();
  m = s.match(/(\d+)\s*주\s*전/);   if (m) return new Date(now - +m[1] * 604800000).toISOString();
  return s; // 이미 절대 날짜 형식이면 그대로
}

function scrapeSomoimEvents() {
  const res = UrlFetchApp.fetch(GROUP_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('somoim fetch failed: ' + res.getResponseCode());

  const html = res.getContentText('UTF-8');
  const events = [];

  // ※ 구분자 문자(∙ U+2219)는 인코딩 불일치 방지를 위해 [^<] 로 처리
  const CARD_RE = new RegExp(
    '<p class="text-\\[15px\\] font-bold">([^<]+)</p>' +
    '<p class="text-\\[13px\\][^"]*">(관심사|공지|자유)<span[^>]*>[^<]</span>([^<]+)</p>' +
    '[\\s\\S]*?' +
    '<p class="text-fc_black font-bold mb-2 truncate[^"]*">([\\s\\S]*?)</p>' +
    '<p class="text-article_item_c[^"]*">([\\s\\S]*?)</p>',
    'g'
  );

  let match;
  while ((match = CARD_RE.exec(html)) !== null) {
    const label = match[2];
    if (label !== '관심사') continue;

    const author    = decodeEntities(match[1].trim());
    const postedAt  = match[3].trim();
    const title     = decodeEntities(match[4].trim());
    const body      = decodeEntities(match[5].trim());

    var dateRaw      = extractField(body, ['일시', '날짜']);
    var location     = extractField(body, ['장소']);
    var meetingPoint = extractField(body, ['집결장소\\/시간', '집결장소', '접선장소\\/시간', '접선장소', '집결', '접선']);

    if (!dateRaw && (RANGE_RE.test(title) || SINGLE_RE.test(title))) {
      dateRaw = title;
      if (!location) {
        const rest = title.replace(RANGE_RE, '').replace(SINGLE_RE, '').trim();
        location = rest.length >= 2 ? rest : null;
      }
    }

    const range = dateRaw ? parseKoreanDateRange(dateRaw) : null;
    if (!range) continue;

    events.push({ author, postedAt, title, dateRaw, dtstart: range.start, dtend: range.end, location, meetingPoint });
  }
  return events;
}

// 소모임 이벤트 → events 시트 upsert
function syncSomoimToSheet(sheet, prefix) {
  const scraped = scrapeSomoimEvents();
  const now = new Date().toISOString();
  // 마지막 sync 시간 저장
  PropertiesService.getScriptProperties().setProperty('lastSynced', now);

  // K1 셀에 실행 시각(한국시간) 기록
  var kst = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  var label = prefix ? prefix + ' ' + kst : kst;
  sheet.getRange(1, 11).setValue(label);

  const idToRow = {};
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues()
      .forEach(function(r, i) { idToRow[String(r[0])] = i + 2; });
  }

  let upserted = 0;
  for (const ev of scraped) {
    const id = sha256Hex16(ev.author + '|' + ev.dtstart + '|' + (ev.dtend || ev.dtstart));

    // content: 장소 + 집결장소 조합
    const contentParts = [];
    if (ev.location)     contentParts.push('📍 장소: ' + ev.location);
    if (ev.meetingPoint) contentParts.push('🚩 집결: ' + ev.meetingPoint);
    const content = contentParts.join('\n');

    const values = [[
      id,
      ev.dtstart,
      ev.dtend || ev.dtstart,
      ev.title,
      content,
      '',              // pwHash 없음
      now,
      ev.author || '',
      resolvePostedAt(ev.postedAt || ''),  // 소모임 게시물 등록일 (ISO)
    ]];

    if (idToRow[id]) {
      sheet.getRange(idToRow[id], 1, 1, COL_COUNT).setValues(values);
    } else {
      sheet.appendRow(values[0]);
    }
    upserted++;
  }
  return { scraped: scraped.length, upserted };
}

// ════════════════════════════════════════════════════════════
//  doGet — 모든 요청 처리
// ════════════════════════════════════════════════════════════
function doGet(e) {
  const p        = e.parameter;
  const callback = p.callback || '';
  const action   = p.action   || 'list';

  try {
    const sheet = initSheet();

    // ── LIST ────────────────────────────────────────────────
    if (action === 'list') {
      const lastSynced = PropertiesService.getScriptProperties().getProperty('lastSynced') || null;
      return makeResponse({ status: 'ok', data: getAllRows(sheet), lastSynced }, callback);
    }

    // ── SYNC (소모임 스크래핑 → 시트 갱신) ──────────────────
    if (action === 'sync') {
      const result = syncSomoimToSheet(sheet, '(자동)');
      const data   = getAllRows(sheet);
      const lastSynced = PropertiesService.getScriptProperties().getProperty('lastSynced') || null;
      return makeResponse({ status: 'ok', scraped: result.scraped, upserted: result.upserted, data, lastSynced }, callback);
    }

    // ── DELETE ──────────────────────────────────────────────
    if (action === 'delete') {
      var id = p.id;
      if (!id) return makeResponse({ status: 'error', message: 'id 필요' }, callback);
      var rowIdx = findRowById(sheet, id);
      if (rowIdx === -1) return makeResponse({ status: 'error', message: '해당 일정을 찾을 수 없습니다' }, callback);
      sheet.deleteRow(rowIdx);
      var data = getAllRows(sheet);
      return makeResponse({ status: 'ok', data: data }, callback);
    }

    return makeResponse({ status: 'error', message: '알 수 없는 action: ' + action }, callback);

  } catch (err) {
    return makeResponse({ status: 'error', message: err.message }, callback);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return doGet({ parameter: body });
  } catch (err) {
    return makeResponse({ status: 'error', message: err.message }, '');
  }
}

function testInit() {
  Logger.log('시트: ' + initSheet().getName());
  Logger.log('데이터: ' + JSON.stringify(getAllRows(initSheet())));
}

function testSync() {
  const sheet = initSheet();
  const result = syncSomoimToSheet(sheet, '(수동)');
  Logger.log('결과: ' + JSON.stringify(result));
}

// 시간 기반 트리거에 등록할 함수
function triggerSync() {
  const sheet = initSheet();
  syncSomoimToSheet(sheet, '(자동)');
}
