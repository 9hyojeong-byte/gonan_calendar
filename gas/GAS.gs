// ============================================================
//  고난크루 여행 캘린더 — Google Apps Script (Web App)
//  배포: 확장프로그램 > Apps Script > 배포 > 새 배포
//        유형: 웹 앱 / 액세스: 모든 사람
//  ※ 수정 후 반드시 "새 배포" 또는 "배포 관리 > 버전 업데이트"
// ============================================================
//  시트 컬럼 구조 (v2):
//  1:id  2:startDate  3:endDate  4:title  5:content
//  6:pwHash  7:createdAt  8:leader  9:participants
// ============================================================

const SHEET_NAME = 'events';
const COL_COUNT  = 9;

function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'startDate', 'endDate', 'title', 'content', 'pwHash', 'createdAt', 'leader', 'participants']);
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
  } else {
    // 기존 시트에 leader/participants 헤더가 없으면 추가
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!headers.includes('leader')) {
      sheet.getRange(1, 8).setValue('leader');
      sheet.setColumnWidth(8, 150);
    }
    if (!headers.includes('participants')) {
      sheet.getRange(1, 9).setValue('participants');
      sheet.setColumnWidth(9, 200);
    }
  }
  return sheet;
}

// JSON 또는 JSONP 응답
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

// 시트에서 날짜 셀을 읽으면 Date 객체로 오는 경우가 있어 yyyy-MM-dd 로 강제 변환
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
    .filter(r => r[0] !== '')
    .map(r => ({
      id:           String(r[0]),
      startDate:    fmtDate(r[1]),
      endDate:      fmtDate(r[2]),
      title:        String(r[3]),
      content:      String(r[4]),
      pwHash:       String(r[5]),
      createdAt:    String(r[6]),
      leader:       String(r[7] || ''),
      participants: String(r[8] || ''),
    }));
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
  const idx = ids.indexOf(String(id));
  return idx === -1 ? -1 : idx + 2;
}

// ── 모든 요청을 doGet 하나로 처리 (JSONP 지원) ──────────────
function doGet(e) {
  const p        = e.parameter;
  const callback = p.callback || '';
  const action   = p.action   || 'list';

  try {
    const sheet = initSheet();

    // ── LIST ────────────────────────────────────────────────
    if (action === 'list') {
      return makeResponse({ status: 'ok', data: getAllRows(sheet) }, callback);
    }

    // ── CREATE ──────────────────────────────────────────────
    if (action === 'create') {
      const { id, startDate, endDate, title, content, pwHash, createdAt, leader, participants } = p;
      if (!id || !startDate || !endDate || !title || !pwHash) {
        return makeResponse({ status: 'error', message: '필수 필드 누락' }, callback);
      }
      sheet.appendRow([
        id, startDate, endDate, title,
        content || '', pwHash,
        createdAt || new Date().toISOString(),
        leader || '',
        participants || '',
      ]);
      return makeResponse({ status: 'created', id }, callback);
    }

    // ── UPDATE ──────────────────────────────────────────────
    if (action === 'update') {
      const { id, startDate, endDate, title, content, pwHash, leader } = p;
      if (!id || !pwHash) return makeResponse({ status: 'error', message: 'id, pwHash 필요' }, callback);
      const row = findRowById(sheet, id);
      if (row === -1) return makeResponse({ status: 'not_found' }, callback);
      if (String(sheet.getRange(row, 6).getValue()) !== String(pwHash)) {
        return makeResponse({ status: 'unauthorized' }, callback);
      }
      if (startDate) sheet.getRange(row, 2).setValue(startDate);
      if (endDate)   sheet.getRange(row, 3).setValue(endDate);
      if (title)     sheet.getRange(row, 4).setValue(title);
      sheet.getRange(row, 5).setValue(content || '');
      if (leader !== undefined) sheet.getRange(row, 8).setValue(leader);
      return makeResponse({ status: 'updated', id }, callback);
    }

    // ── UPDATE PARTICIPANTS (비밀번호 불필요) ────────────────
    if (action === 'updateParticipants') {
      const { id, participants } = p;
      if (!id) return makeResponse({ status: 'error', message: 'id 필요' }, callback);
      const row = findRowById(sheet, id);
      if (row === -1) return makeResponse({ status: 'not_found' }, callback);
      sheet.getRange(row, 9).setValue(participants || '');
      return makeResponse({ status: 'updated', id }, callback);
    }

    // ── DELETE ──────────────────────────────────────────────
    if (action === 'delete') {
      const { id, pwHash } = p;
      if (!id || !pwHash) return makeResponse({ status: 'error', message: 'id, pwHash 필요' }, callback);
      const row = findRowById(sheet, id);
      if (row === -1) return makeResponse({ status: 'not_found' }, callback);
      if (String(sheet.getRange(row, 6).getValue()) !== String(pwHash)) {
        return makeResponse({ status: 'unauthorized' }, callback);
      }
      sheet.deleteRow(row);
      return makeResponse({ status: 'deleted', id }, callback);
    }

    return makeResponse({ status: 'error', message: '알 수 없는 action: ' + action }, callback);

  } catch (err) {
    return makeResponse({ status: 'error', message: err.message }, callback);
  }
}

// doPost는 하위호환용으로 유지
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const fakeE = { parameter: body };
    return doGet(fakeE);
  } catch (err) {
    return makeResponse({ status: 'error', message: err.message }, '');
  }
}

function testInit() {
  Logger.log('시트: ' + initSheet().getName());
  Logger.log('데이터: ' + JSON.stringify(getAllRows(initSheet())));
}
