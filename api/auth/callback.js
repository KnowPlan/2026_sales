'use strict';
const { google } = require('googleapis');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const { code, state, error } = req.query;

  if (error) {
    return res.status(200).send(errPage('Google OAuth 오류: ' + error));
  }
  if (!code) {
    return res.status(400).send(errPage('Authorization code가 없습니다.'));
  }

  try {
    // state에서 clientId/clientSecret 복원
    let clientId, clientSecret;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        clientId = decoded.clientId;
        clientSecret = decoded.clientSecret;
      } catch (e) { /* state 없거나 파싱 실패 시 env var 사용 */ }
    }
    clientId     = clientId     || process.env.GOOGLE_CLIENT_ID;
    clientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(400).send(errPage('Client ID / Secret을 확인할 수 없습니다.'));
    }

    const redirectUri = process.env.OAUTH_REDIRECT_URI || `https://${req.headers.host}/api/auth/callback`;
    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await auth.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return res.status(400).send(errPage('refresh_token을 받지 못했습니다. Google OAuth 앱에서 "오프라인 액세스"가 허용되어 있는지 확인하세요.'));
    }

    // 스프레드시트 선택 페이지 표시
    return res.status(200).send(selectionPage(clientId, clientSecret, refreshToken, req.headers.host));

  } catch (e) {
    return res.status(500).send(errPage('오류: ' + e.message));
  }
};

// ── 스프레드시트 선택 페이지 ──
function selectionPage(clientId, clientSecret, refreshToken, host) {
  // 안전하게 인코딩
  const payload = Buffer.from(JSON.stringify({ clientId, clientSecret, refreshToken })).toString('base64');

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>스프레드시트 연결</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f12;color:#e8e8ee;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.wrap{max-width:560px;width:100%}
h2{font-size:20px;color:#34d399;margin-bottom:6px}
.sub{font-size:13px;color:#9393a8;margin-bottom:24px}
.card{background:#1c1c26;border:1px solid #2d2d3a;border-radius:12px;padding:20px;margin-bottom:14px}
.label{font-size:11px;font-weight:600;color:#64647a;letter-spacing:.5px;margin-bottom:8px;text-transform:uppercase}
.inp{background:#0f0f12;border:1px solid #2d2d3a;color:#e8e8ee;border-radius:6px;padding:10px 12px;font-size:13px;width:100%;outline:none;font-family:inherit}
.inp:focus{border-color:#6366f1}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:11px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:none;margin-top:8px}
.btn-p{background:#6366f1;color:#fff}.btn-p:hover{opacity:.9}
.btn-s{background:#1c1c26;border:1px solid #2d2d3a;color:#e8e8ee;margin-top:6px}.btn-s:hover{background:#23232f}
.err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);border-radius:8px;padding:10px 14px;font-size:13px;color:#f87171;margin-bottom:14px;display:none}
.spin{display:none;text-align:center;color:#9393a8;font-size:13px;padding:10px}
</style>
</head>
<body>
<div class="wrap">
  <h2>✅ Google 인증 완료!</h2>
  <p class="sub">사용할 스프레드시트를 선택하세요.</p>
  <div id="err" class="err"></div>

  <div class="card">
    <div class="label">🆕 새 스프레드시트 자동 생성</div>
    <button class="btn btn-p" onclick="finalize('')">새 스프레드시트 만들기</button>
  </div>

  <div class="card">
    <div class="label">📋 기존 스프레드시트 연결</div>
    <input id="ssId" class="inp" placeholder="스프레드시트 ID 입력 (URL의 /d/XXXX/edit 에서 XXXX 부분)" />
    <button class="btn btn-s" onclick="finalize(document.getElementById('ssId').value.trim())">이 시트 연결하기</button>
  </div>

  <div id="spin" class="spin">⏳ 스프레드시트 처리 중...</div>
</div>

<script>
const PAYLOAD = '${payload}';
const HOST = '${host}';

async function finalize(spreadsheetId) {
  const errEl = document.getElementById('err');
  const spinEl = document.getElementById('spin');
  errEl.style.display = 'none';
  spinEl.style.display = 'block';

  try {
    const body = JSON.parse(atob(PAYLOAD));
    if (spreadsheetId) body.spreadsheetId = spreadsheetId;

    const resp = await fetch('/api/auth/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    spinEl.style.display = 'none';

    if (data.success) {
      showResult(data, body.clientId, body.clientSecret, body.refreshToken);
    } else {
      errEl.textContent = '오류: ' + (data.error || '알 수 없는 오류');
      errEl.style.display = 'block';
    }
  } catch (e) {
    spinEl.style.display = 'none';
    errEl.textContent = '요청 실패: ' + e.message;
    errEl.style.display = 'block';
  }
}

function showResult(data, clientId, clientSecret, refreshToken) {
  document.querySelector('.wrap').innerHTML = \`
    <h2 style="color:#34d399;margin-bottom:6px">🎉 연결 준비 완료!</h2>
    <p style="font-size:13px;color:#9393a8;margin-bottom:20px">아래 4개 환경변수를 Vercel에 등록 후 Redeploy 하세요.</p>
    \${envVar('GOOGLE_CLIENT_ID', clientId)}
    \${envVar('GOOGLE_CLIENT_SECRET', clientSecret)}
    \${envVar('GOOGLE_REFRESH_TOKEN', refreshToken)}
    \${envVar('SPREADSHEET_ID', data.spreadsheetId)}
    <div style="margin-top:16px;background:#17171e;border:1px solid #2d2d3a;border-radius:10px;padding:16px;font-size:13px;color:#9393a8;line-height:2">
      <strong style="color:#e8e8ee">다음 단계:</strong><br>
      1️⃣ &nbsp;위 4개 값을 <a href="https://vercel.com/dashboard" target="_blank" style="color:#6366f1">Vercel 대시보드</a> → Settings → Environment Variables 에 추가<br>
      2️⃣ &nbsp;Vercel에서 <strong style="color:#e8e8ee">Redeploy</strong><br>
      3️⃣ &nbsp;<a href="/" style="color:#6366f1">앱 새로고침</a> → Google Sheets 모드 자동 전환 🎉
    </div>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <a href="\${data.sheetUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">📊 스프레드시트 열기</a>
      <a href="https://vercel.com/dashboard" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#1c1c26;border:1px solid #2d2d3a;color:#e8e8ee;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">⚙️ Vercel 대시보드</a>
    </div>
  \`;
}

function envVar(key, val) {
  return \`<div style="background:#1c1c26;border:1px solid #2d2d3a;border-radius:10px;padding:16px;margin-bottom:10px">
    <div style="font-size:11px;font-weight:600;color:#64647a;letter-spacing:.5px;margin-bottom:6px">\${key}</div>
    <div onclick="selectAll(this)" style="font-family:monospace;font-size:12px;background:#0f0f12;border:1px solid #2d2d3a;border-radius:6px;padding:10px;word-break:break-all;color:#a5b4fc;cursor:pointer" title="클릭하여 전체 선택">\${val}</div>
    <div style="font-size:11px;color:#64647a;margin-top:4px">클릭하면 전체 선택됩니다</div>
  </div>\`;
}

function selectAll(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
</script>
</body>
</html>`;
}

function errPage(msg) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>오류</title>
<style>body{font-family:sans-serif;padding:60px 24px;background:#0f0f12;color:#f87171;text-align:center}</style></head>
<body><h2>❌ 오류</h2><p style="margin-top:12px;color:#9393a8">${msg}</p></body></html>`;
}
