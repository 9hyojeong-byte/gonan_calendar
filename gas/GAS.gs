// ============================================================
//  고난크루 여행 캘린더 — Google Apps Script (Web App)
//  배포: 확장프로그램 > Apps Script > 배포 > 새 배포
//        유형: 웹 앱 / 액세스: 모든 사람
// ============================================================

const SHEET_NAME = 'events';

// ── 시트 초기화 (첫 실행 시 헤더 생성) ─────────────────────
function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  // 헤더가 없으면 생성
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'startDate', 'endDate', 'title', 'content', 'pwHash', 'createdAt']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#d8f3dc');
    sheet.setFrozenRows(1);
    // 열 너비 조정
    sheet.setColumnWidth(1, 160);  // id
    sheet.setColumnWidth(2, 110);  // startDate
    sheet.setColumnWidth(3, 110);  // endDate
    sheet.setColumnWidth(4, 200);  // title
    sheet.setColumnWidth(5, 300);  // content
    sheet.setColumnWidth(6, 120);  // pwHash
    sheet.setColumnWidth(7, 160);  // createdAt
  }
  return sheet;
}

// ── CORS 허용 응답 헬퍼 ──────────────────────────────────────
function respond(data, status) {
  const payload = JSON.stringify({ status: status || 'ok', data: data });
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function respondError(msg, status) {
  const payload = JSON.stringify({ status: status || 'error', message: msg });
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 시트 전체 → 객체 배열 변환 ──────────────────────────────
function getAllRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];  // 헤더만 있거나 비어있음

  const range = sheet.getRange(2, 1, lastRow - 1, 7);
  const values = range.getValues();

  return values
    .filter(row => row[0] !== '')  // 빈 행 제외
    .map(row => ({
      id:        String(row[0]),
      startDate: String(row[1]),
      endDate:   String(row[2]),
      title:     String(row[3]),
      content:   String(row[4]),
      pwHash:    String(row[5]),
      createdAt: String(row[6]),
    }));
}

// ── id로 행 번호 찾기 (1-based, 헤더 포함) ──────────────────
function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const idx = ids.indexOf(id);
  return idx === -1 ? -1 : idx + 2;  // +2: 헤더 행 + 0-based→1-based
}

// ── GET: 전체 이벤트 조회 ────────────────────────────────────
function doGet(e) {
  try {
    const sheet = initSheet();
    const events = getAllRows(sheet);
    return respond(events);
  } catch (err) {
    return respondError(err.message);
  }
}

// ── POST: create / update / delete ──────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const sheet = initSheet();

    // ── CREATE ──────────────────────────────────────────────
    if (action === 'create') {
      const { id, startDate, endDate, title, content, pwHash, createdAt } = body;

      if (!id || !startDate || !endDate || !title || !pwHash) {
        return respondError('필수 필드 누락 (id, startDate, endDate, title, pwHash)');
      }

      sheet.appendRow([id, startDate, endDate, title, content || '', pwHash, createdAt || new Date().toISOString()]);
      return respond({ id }, 'created');
    }

    // ── UPDATE ──────────────────────────────────────────────
    if (action === 'update') {
      const { id, startDate, endDate, title, content, pwHash } = body;

      if (!id || !pwHash) return respondError('id와 pwHash 필요');

      const rowNum = findRowById(sheet, id);
      if (rowNum === -1) return respondError('이벤트를 찾을 수 없습니다.', 'not_found');

      // 비밀번호 검증
      const storedHash = sheet.getRange(rowNum, 6).getValue();
      if (String(storedHash) !== String(pwHash)) {
        return respondError('비밀번호가 올바르지 않습니다.', 'unauthorized');
      }

      // startDate, endDate, title, content 업데이트 (pwHash, createdAt 유지)
      if (startDate) sheet.getRange(rowNum, 2).setValue(startDate);
      if (endDate)   sheet.getRange(rowNum, 3).setValue(endDate);
      if (title)     sheet.getRange(rowNum, 4).setValue(title);
      sheet.getRange(rowNum, 5).setValue(content || '');

      return respond({ id }, 'updated');
    }

    // ── DELETE ──────────────────────────────────────────────
    if (action === 'delete') {
      const { id, pwHash } = body;

      if (!id || !pwHash) return respondError('id와 pwHash 필요');

      const rowNum = findRowById(sheet, id);
      if (rowNum === -1) return respondError('이벤트를 찾을 수 없습니다.', 'not_found');

      // 비밀번호 검증
      const storedHash = sheet.getRange(rowNum, 6).getValue();
      if (String(storedHash) !== String(pwHash)) {
        return respondError('비밀번호가 올바르지 않습니다.', 'unauthorized');
      }

      sheet.deleteRow(rowNum);
      return respond({ id }, 'deleted');
    }

    return respondError('알 수 없는 action: ' + action);

  } catch (err) {
    return respondError(err.message);
  }
}

// ── 테스트용 수동 실행 함수 ──────────────────────────────────
function testInit() {
  const sheet = initSheet();
  Logger.log('시트 초기화 완료: ' + sheet.getName());
}
