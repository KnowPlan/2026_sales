'use strict';
const { google } = require('googleapis');

function getOAuth2() {
  const cid = process.env.GOOGLE_CLIENT_ID?.trim();
  const cs  = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const rt  = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!cid || !cs || !rt) throw new Error('Google OAuth 환경변수가 설정되지 않았습니다.');
  const auth = new google.auth.OAuth2(cid, cs);
  auth.setCredentials({ refresh_token: rt });
  return auth;
}

function sheets() {
  return google.sheets({ version: 'v4', auth: getOAuth2() });
}

function ssId() {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error('SPREADSHEET_ID 환경변수가 설정되지 않았습니다.');
  return id.trim();
}

/** 시트 전체 행을 객체 배열로 반환 (시트 없거나 에러 시 [] 반환) */
async function readAll(sheetName) {
  try {
    const r = await sheets().spreadsheets.values.get({
      spreadsheetId: ssId(),
      range: sheetName,
    });
    const rows = r.data.values || [];
    if (rows.length < 2) return [];
    const [headers, ...data] = rows;
    return data.map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
    );
  } catch (e) {
    // 시트 없음(400), 권한 오류, 기타 모든 에러 → 빈 배열 반환 (앱 초기화 블록 방지)
    const code = e.code || e.status || (e.response && e.response.status);
    if (code === 400 || code === '400' || code === 404 ||
        (e.message && (e.message.includes('Unable to parse range') || e.message.includes('not found')))) {
      return [];
    }
    console.error('[sheets] readAll error:', sheetName, code, e.message);
    return []; // 모든 에러에서 빈 배열 반환
  }
}

/** 행 추가 (없는 컬럼은 헤더에 자동 추가, 시트 없으면 자동 생성) */
async function appendRow(sheetName, data) {
  const id = ssId();
  const s = sheets();

  let headers = [];
  try {
    const hRes = await s.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${sheetName}!1:1`,
    });
    headers = hRes.data.values?.[0] ?? [];
  } catch (e) {
    if (e.code === 400 || e.status === 400) {
      // 시트 없음 - 새로 생성
      await s.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
      });
    } else throw e;
  }

  const newKeys = Object.keys(data).filter(k => !headers.includes(k));
  if (!headers.length || newKeys.length) {
    headers = headers.length ? [...headers, ...newKeys] : Object.keys(data);
    await s.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  const row = headers.map(h => (data[h] != null ? String(data[h]) : ''));
  await s.spreadsheets.values.append({
    spreadsheetId: id,
    range: sheetName,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  return { success: true };
}

/** id로 행 수정 */
async function updateRow(sheetName, rowId, updates) {
  const id = ssId();
  const s = sheets();
  const res = await s.spreadsheets.values.get({ spreadsheetId: id, range: sheetName });
  const [headers, ...rows] = res.data.values || [];
  if (!headers) throw new Error('시트가 비어 있습니다.');
  const idIdx = headers.indexOf('id');
  const idx = rows.findIndex(r => r[idIdx] === rowId);
  if (idx === -1) throw new Error('해당 id를 찾을 수 없습니다: ' + rowId);
  const updated = headers.map((h, i) =>
    updates[h] != null ? String(updates[h]) : (rows[idx][i] ?? '')
  );
  await s.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${sheetName}!A${idx + 2}`,
    valueInputOption: 'RAW',
    requestBody: { values: [updated] },
  });
  return { success: true };
}

/** id로 행 삭제 */
async function deleteRow(sheetName, rowId) {
  const id = ssId();
  const s = sheets();

  const meta = await s.spreadsheets.get({ spreadsheetId: id });
  const sheet = meta.data.sheets.find(sh => sh.properties.title === sheetName);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
  const sheetId = sheet.properties.sheetId;

  const res = await s.spreadsheets.values.get({ spreadsheetId: id, range: sheetName });
  const [headers, ...rows] = res.data.values || [];
  if (!headers) throw new Error('시트가 비어 있습니다.');
  const idIdx = headers.indexOf('id');
  const idx = rows.findIndex(r => r[idIdx] === rowId);
  if (idx === -1) throw new Error('해당 id를 찾을 수 없습니다: ' + rowId);

  await s.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 },
        },
      }],
    },
  });
  return { success: true };
}

module.exports = { readAll, appendRow, updateRow, deleteRow };
