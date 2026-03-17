'use strict';
const { google } = require('googleapis');

module.exports = async (req, res) => {
  const hasAuth = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
  const spreadsheetId = process.env.SPREADSHEET_ID || null;

  // 기본 응답 (환경변수 미설정 시)
  if (!hasAuth || !spreadsheetId) {
    return res.json({ authenticated: false, spreadsheetId, gmailOk: false });
  }

  // Gmail 스코프 확인 (토큰이 있을 때만)
  let gmailOk = false;
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.getProfile({ userId: 'me' });
    gmailOk = true;
  } catch (e) {
    // gmail.send 스코프 없거나 토큰 만료 — 정상 fallback
    console.warn('[auth/status] Gmail 스코프 없음 또는 오류:', e.message);
  }

  return res.json({
    authenticated: true,
    spreadsheetId,
    gmailOk,
    scopeWarning: gmailOk ? null : 'Gmail 스코프 없음 — /api/auth/login 에서 재인증 필요',
  });
};
