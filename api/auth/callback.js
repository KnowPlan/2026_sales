'use strict';
const { google } = require('googleapis');

const SHEET_HEADERS = {
  Solutions:     ['id','name','description','createdAt'],
  Customers:     ['id','name','type','contactName','phone','email','address','createdAt'],
  SalesContexts: ['id','name','customerId','solutionId','ownerId','stage','expectedAmount','expectedCloseDate','salesYear','description','createdAt'],
  Activities:    ['id','salesContextId','type','title','content','ownerId','createdAt'],
  Contracts:     ['id','salesContextId','amount','startDate','endDate','status','createdAt'],
  Revenues:      ['id','contractId','amount','revenueDate','status','createdAt'],
  Users:         ['id','name','loginId','pw','role','isActive','createdAt'],
};

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const { code, error } = req.query;

  if (error) {
    return res.status(200).send(`<html><body style="font-family:sans-serif;padding:40px;background:#0f0f12;color:#f87171">OAuth 오류: ${error}</body></html>`);
  }
  if (!code) {
    return res.status(400).send('<html><body>Authorization code가 없습니다.</body></html>');
  }

  try {
    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri  = `https://${req.headers.host}/api/auth/callback`;

    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    // 스프레드시트 생성 + 시트 헤더 초기화
    const sheets = google.sheets({ version: 'v4', auth });
    const resp = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: '영업관리 시스템' },
        sheets: Object.keys(SHEET_HEADERS).map(title => ({ properties: { title } })),
      },
    });
    const spreadsheetId = resp.data.spreadsheetId;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: Object.entries(SHEET_HEADERS).map(([name, h]) => ({
          range: `${name}!A1`, values: [h],
        })),
      },
    });

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    return res.status(200).send(`<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>연동 완료</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f12;color:#e8e8ee;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.wrap{max-width:600px;width:100%}
h2{font-size:22px;color:#34d399;margin-bottom:8px}
.sub{font-size:14px;color:#9393a8;margin-bottom:28px}
.card{background:#1c1c26;border:1px solid #2d2d3a;border-radius:12px;padding:20px;margin-bottom:16px}
.label{font-size:11px;font-weight:600;color:#64647a;letter-spacing:.5px;margin-bottom:8px}
.val{font-family:'Courier New',monospace;font-size:13px;background:#0f0f12;border:1px solid #2d2d3a;border-radius:6px;padding:12px;word-break:break-all;color:#a5b4fc;user-select:all;cursor:pointer}
.val:active{background:#17171e}
.copy-hint{font-size:11px;color:#64647a;margin-top:6px}
.steps{background:#17171e;border:1px solid #2d2d3a;border-radius:12px;padding:20px;margin-bottom:16px;font-size:13px;line-height:2;color:#9393a8}
.steps strong{color:#e8e8ee}
.btn{display:inline-flex;align-items:center;gap:6px;background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;margin-top:4px}
.btn:hover{opacity:.9}
.btn-g{background:#1c1c26;border:1px solid #2d2d3a;color:#e8e8ee}
a{color:#6366f1}
</style>
</head>
<body>
<div class="wrap">
  <h2>✅ Google 인증 완료!</h2>
  <p class="sub">아래 두 값을 Vercel 환경변수에 추가한 뒤 Redeploy 하세요.</p>

  <div class="card">
    <div class="label">GOOGLE_REFRESH_TOKEN</div>
    <div class="val" title="클릭하여 복사">${tokens.refresh_token}</div>
    <div class="copy-hint">클릭하면 전체 선택됩니다</div>
  </div>

  <div class="card">
    <div class="label">SPREADSHEET_ID</div>
    <div class="val" title="클릭하여 복사">${spreadsheetId}</div>
    <div class="copy-hint">클릭하면 전체 선택됩니다</div>
  </div>

  <div class="steps">
    <strong>다음 단계:</strong><br>
    1️⃣ &nbsp;위 두 값을 <a href="https://vercel.com/dashboard" target="_blank">Vercel 대시보드</a> → Settings → Environment Variables 에 추가<br>
    2️⃣ &nbsp;Vercel에서 <strong>Redeploy</strong><br>
    3️⃣ &nbsp;앱 접속 → Google Sheets 모드로 자동 전환 🎉
  </div>

  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <a href="${sheetUrl}" target="_blank" class="btn">📊 스프레드시트 열기</a>
    <a href="https://vercel.com/dashboard" target="_blank" class="btn btn-g">⚙️ Vercel 대시보드</a>
    <a href="/" class="btn btn-g">🏠 앱으로 이동</a>
  </div>
</div>
</body>
</html>`);
  } catch (e) {
    return res.status(500).send(`<html><body style="font-family:sans-serif;padding:40px;background:#0f0f12;color:#f87171"><h3>오류 발생</h3><p>${e.message}</p></body></html>`);
  }
};
