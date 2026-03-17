'use strict';
const { google } = require('googleapis');

// 시스템 전체에서 필요한 스코프 (Sheets + Drive.file + Gmail)
// drive.file : Sensitive — 미검증 앱 사용 가능
// drive      : Restricted — Google 앱 검증 필요 (사용 불가)
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
];
// Google OAuth는 scope를 공백 구분 문자열로 받음 (배열도 내부적으로 join하지만 명시적으로 지정)
const SCOPE_STRING = SCOPES.join(' ');

function buildAuthUrl(clientId, clientSecret, redirectUri, state) {
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPE_STRING,   // 명시적 공백 구분 문자열
    prompt: 'consent',
    state,
  });

  // ── 진단 로그 (Vercel 런타임 로그에서 확인) ──
  console.log('[auth/login] redirect_uri :', redirectUri);
  console.log('[auth/login] scope        :', SCOPE_STRING);
  console.log('[auth/login] authUrl      :', url);

  // authUrl에서 scope 파라미터만 추출해서 재검증
  try {
    const parsed = new URL(url);
    const scopeParam = parsed.searchParams.get('scope');
    console.log('[auth/login] scope param in URL:', scopeParam);
    const redirectParam = parsed.searchParams.get('redirect_uri');
    console.log('[auth/login] redirect_uri in URL:', redirectParam);
  } catch (e) {
    console.error('[auth/login] URL 파싱 실패:', e.message);
  }

  return url;
}

module.exports = async (req, res) => {

  // ── POST: in-app 설정 화면에서 호출 → {authUrl} JSON 반환 ──
  if (req.method === 'POST') {
    const { clientId, clientSecret } = req.body || {};
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'clientId와 clientSecret을 입력하세요.' });
    }
    const redirectUri = process.env.OAUTH_REDIRECT_URI
      || `https://${req.headers.host}/api/auth/callback`;
    const state = Buffer.from(JSON.stringify({ clientId, clientSecret })).toString('base64');
    const authUrl = buildAuthUrl(clientId, clientSecret, redirectUri, state);
    return res.json({ authUrl });
  }

  // ── GET: 브라우저에서 직접 접속 → Google OAuth 리다이렉트 ──
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>설정 필요</title>
<style>body{font-family:-apple-system,sans-serif;max-width:520px;margin:80px auto;padding:24px;background:#0f0f12;color:#e8e8ee}
h2{color:#fbbf24}code{background:#1c1c26;padding:2px 8px;border-radius:4px;font-size:13px;color:#a5b4fc}</style>
</head><body>
<h2>⚠️ 환경변수 설정 필요</h2>
<p>Vercel 대시보드에서 아래 두 항목을 먼저 등록하세요.</p>
<p><code>GOOGLE_CLIENT_ID</code></p>
<p><code>GOOGLE_CLIENT_SECRET</code></p>
<p style="margin-top:20px;color:#9393a8;font-size:13px">등록 후 Vercel에서 Redeploy → 이 페이지 새로고침하면 계속 진행됩니다.</p>
</body></html>`);
  }

  const redirectUri = process.env.OAUTH_REDIRECT_URI
    || `https://${req.headers.host}/api/auth/callback`;
  const state = Buffer.from(JSON.stringify({ clientId, clientSecret })).toString('base64');
  const authUrl = buildAuthUrl(clientId, clientSecret, redirectUri, state);

  res.writeHead(302, { Location: authUrl });
  res.end();
};
