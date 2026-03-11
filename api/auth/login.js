'use strict';
const { google } = require('googleapis');

module.exports = async (req, res) => {
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
<p style="margin-top:20px;color:#9393a8;font-size:13px">
  등록 후 Vercel에서 Redeploy → 이 페이지 새로고침하면 계속 진행됩니다.
</p>
</body></html>`);
  }

  const redirectUri = `https://${req.headers.host}/api/auth/callback`;
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
    prompt: 'consent',
  });

  res.writeHead(302, { Location: authUrl });
  res.end();
};
