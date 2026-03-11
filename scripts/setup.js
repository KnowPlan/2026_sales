'use strict';
/**
 * 영업관리 시스템 - Google Sheets 초기 설정 스크립트
 * 실행: node scripts/setup.js
 *
 * 사전 준비:
 *   Google Cloud Console > API 및 서비스 > 사용자 인증 정보 > OAuth 2.0 클라이언트 ID
 *   승인된 리디렉션 URI에 아래 주소를 추가하세요:
 *   http://localhost:3001/callback
 */

const { google } = require('googleapis');
const http = require('http');
const { parse } = require('url');
const { execSync } = require('child_process');

// 환경변수 또는 직접 입력으로 설정하세요
// 예: set GOOGLE_CLIENT_ID=xxx && set GOOGLE_CLIENT_SECRET=yyy && node scripts/setup.js
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '<YOUR_CLIENT_ID>';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '<YOUR_CLIENT_SECRET>';
const REDIRECT_URI  = 'http://localhost:3001/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const SHEET_HEADERS = {
  Solutions:     ['id','name','description','createdAt'],
  Customers:     ['id','name','type','contactName','phone','email','address','createdAt'],
  SalesContexts: ['id','name','customerId','solutionId','ownerId','stage','expectedAmount','expectedCloseDate','salesYear','description','createdAt'],
  Activities:    ['id','salesContextId','type','title','content','ownerId','createdAt'],
  Contracts:     ['id','salesContextId','amount','startDate','endDate','status','createdAt'],
  Revenues:      ['id','contractId','amount','revenueDate','status','createdAt'],
  Users:         ['id','name','loginId','pw','role','isActive','createdAt'],
};

async function main() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  const authUrl = auth.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  영업관리 시스템 — Google Sheets 초기 설정');
  console.log('══════════════════════════════════════════════════════\n');
  console.log('📌 [사전 준비] Google Cloud Console에서 아래 URI를 추가하세요:');
  console.log('   OAuth 클라이언트 > 승인된 리디렉션 URI:');
  console.log('   http://localhost:3001/callback\n');
  console.log('🔗 브라우저가 열립니다. Google 계정을 선택하고 권한을 허용하세요.\n');

  try { execSync(`start "" "${authUrl}"`, { stdio: 'ignore' }); } catch (e) {
    console.log('URL:', authUrl, '\n');
  }

  // 로컬 서버로 OAuth 콜백 수신
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const { pathname, query } = parse(req.url, true);
      if (pathname === '/callback') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2 style="font-family:sans-serif;text-align:center;margin-top:60px">✅ 인증 완료!<br><small style="font-size:14px;color:#888">터미널로 돌아가세요.</small></h2>');
        server.close();
        resolve(query.code);
      }
    });
    server.listen(3001, () =>
      console.log('⏳ Google 인증 대기 중 (브라우저에서 인증을 완료하세요)...\n')
    );
    setTimeout(() => { server.close(); reject(new Error('2분 이내에 인증을 완료하세요.')); }, 120000);
  });

  // 코드 → 토큰 교환
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  console.log('✅ OAuth 토큰 획득 완료\n');

  // 스프레드시트 생성
  console.log('📊 Google Spreadsheet 생성 중...');
  const sheets = google.sheets({ version: 'v4', auth });

  const resp = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: '영업관리 시스템' },
      sheets: Object.keys(SHEET_HEADERS).map(title => ({ properties: { title } })),
    },
  });
  const spreadsheetId = resp.data.spreadsheetId;

  // 헤더 행 일괄 등록
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: Object.entries(SHEET_HEADERS).map(([name, h]) => ({
        range: `${name}!A1`, values: [h],
      })),
    },
  });
  console.log('✅ 스프레드시트 생성 완료\n');

  // 결과 출력
  console.log('══════════════════════════════════════════════════════');
  console.log('  ✅ 설정 완료! 아래 환경변수를 Vercel에 등록하세요');
  console.log('══════════════════════════════════════════════════════\n');
  console.log('[ Vercel 대시보드 > Settings > Environment Variables ]\n');
  console.log(`  GOOGLE_CLIENT_ID     = ${CLIENT_ID}`);
  console.log(`  GOOGLE_CLIENT_SECRET = ${CLIENT_SECRET}`);
  console.log(`  GOOGLE_REFRESH_TOKEN = ${tokens.refresh_token}`);
  console.log(`  SPREADSHEET_ID       = ${spreadsheetId}\n`);
  console.log('🔗 스프레드시트 URL:');
  console.log(`   https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n`);
  console.log('환경변수 등록 후 Vercel에서 [Redeploy] 하면 연동이 완료됩니다.');
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});
