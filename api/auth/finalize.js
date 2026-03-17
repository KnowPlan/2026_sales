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
  Stages:        ['id','label','color','icon','order'],
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { clientId, clientSecret, refreshToken, spreadsheetId: inputId } = req.body || {};

    if (!clientId || !clientSecret || !refreshToken) {
      return res.json({ success: false, error: 'clientId, clientSecret, refreshToken이 필요합니다.' });
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const sheets = google.sheets({ version: 'v4', auth });

    // ── 스코프 검증: Gmail 접근 가능 여부 확인 ──
    let gmailOk = false;
    try {
      const gmail = google.gmail({ version: 'v1', auth });
      await gmail.users.getProfile({ userId: 'me' });
      gmailOk = true;
      console.log('[auth/finalize] Gmail 스코프 확인 완료');
    } catch (gmailErr) {
      const msg = gmailErr.message || '';
      if (msg.includes('insufficient') || msg.includes('forbidden') || msg.includes('Request had insufficient')) {
        console.warn('[auth/finalize] Gmail 스코프 누락 — gmail.send 권한 없음');
      } else {
        console.warn('[auth/finalize] Gmail 확인 중 오류 (무시):', msg);
      }
    }

    let spreadsheetId = inputId ? inputId.trim() : null;

    if (!spreadsheetId) {
      // 새 스프레드시트 생성
      const resp = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: '영업관리 시스템' },
          sheets: Object.keys(SHEET_HEADERS).map(title => ({ properties: { title } })),
        },
      });
      spreadsheetId = resp.data.spreadsheetId;

      // 헤더 + 기본 admin 유저 초기화
      const now = new Date().toISOString();
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            ...Object.entries(SHEET_HEADERS).map(([name, h]) => ({
              range: `${name}!A1`, values: [h],
            })),
            // 기본 관리자 계정
            { range: 'Users!A2', values: [['u1', '관리자', 'admin', '1234', 'admin', 'true', now]] },
            // 기본 영업 단계
            { range: 'Stages!A2', values: [
              ['contact',     '접촉', '#60a5fa', '◈', '0'],
              ['proposal',    '제안', '#a78bfa', '▣', '1'],
              ['negotiation', '협상', '#fb923c', '◆', '2'],
            ]},
          ],
        },
      });
    } else {
      // 기존 스프레드시트 접근 확인
      await sheets.spreadsheets.get({ spreadsheetId });
    }

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return res.json({ success: true, spreadsheetId, sheetUrl, gmailOk,
      scopeWarning: gmailOk ? null : 'Gmail 스코프(gmail.send)가 없습니다. 이메일 발송을 사용하려면 /api/auth/login 에서 재인증 하세요.',
    });

  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
};
