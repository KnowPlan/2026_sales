'use strict';
const { google } = require('googleapis');

// 시스템 전체에서 필요한 스코프 (Sheets + Drive + Gmail 통합)
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.send',
];

module.exports = async (req, res) => {

  // ── POST: in-app 설정 화면에서 호출 → {authUrl} JSON 반환 ──
  if (req.method === 'POST') {
    const { clientId, clientSecret } = req.body || {};
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'clientId와 clientSecret을 입력하세요.' });
    }
    const redirectUri = process.env.OAUTH_REDIRECT_URI || `https://${req.headers.host}/api/auth/callback`;
    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    // state에 credentials 인코딩 (콜백에서 복원)
    const state = Buffer.from(JSON.stringify({ clientId, clientSecret })).toString('base64');
    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',
      scope: REQUIRED_SCOPES,
      prompt: 'consent',
      state,
    });
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

  const redirectUri = process.env.OAUTH_REDIRECT_URI || `https://${req.headers.host}/api/auth/callback`;
  const state = Buffer.from(JSON.stringify({ clientId, clientSecret })).toString('base64');
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: REQUIRED_SCOPES,
    prompt: 'consent',
    state,
  });
  res.writeHead(302, { Location: authUrl });
  res.end();
};
