'use strict';
/**
 * 영업관리 시스템 - Google Sheets 연동 안내
 *
 * 로컬 서버 없이 Vercel URL로 OAuth 인증을 진행합니다.
 *
 * 사용법:
 *   node scripts/setup.js
 */

const { execSync } = require('child_process');

const VERCEL_URL = 'https://2026salse.vercel.app';
const LOGIN_URL  = `${VERCEL_URL}/api/auth/login`;

console.log('\n══════════════════════════════════════════════════════');
console.log('  영업관리 시스템 — Google Sheets 연동 가이드');
console.log('══════════════════════════════════════════════════════\n');
console.log('📌 [Step 1] Google Cloud Console 설정');
console.log('   승인된 리디렉션 URI에 아래 주소를 추가하세요:');
console.log(`   ${VERCEL_URL}/api/auth/callback\n`);
console.log('📌 [Step 2] Vercel 환경변수 2개 먼저 등록 후 Redeploy');
console.log('   GOOGLE_CLIENT_ID     = <발급받은 Client ID>');
console.log('   GOOGLE_CLIENT_SECRET = <발급받은 Client Secret>\n');
console.log('📌 [Step 3] 아래 URL을 브라우저에서 열어 Google 인증 진행');
console.log(`   ${LOGIN_URL}\n`);
console.log('   → 인증 완료 시 REFRESH_TOKEN + SPREADSHEET_ID 자동 발급');
console.log('   → 해당 값을 Vercel에 추가 후 Redeploy하면 연동 완료!\n');

try {
  execSync(`start "" "${LOGIN_URL}"`, { stdio: 'ignore' });
  console.log('✅ 브라우저를 열었습니다.\n');
} catch (e) {
  // 자동 실행 실패 시 URL 출력
}
