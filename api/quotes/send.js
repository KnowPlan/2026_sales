'use strict';
const { google } = require('googleapis');
const { appendRow } = require('../_lib/sheets');

function getOAuth2() {
  const cid = process.env.GOOGLE_CLIENT_ID?.trim();
  const cs  = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const rt  = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!cid || !cs || !rt) throw new Error('Google OAuth 환경변수가 설정되지 않았습니다.');
  const auth = new google.auth.OAuth2(cid, cs);
  auth.setCredentials({ refresh_token: rt });
  return auth;
}

/** base64url 인코딩 */
function b64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** MIME 메시지 빌드 (HTML 본문 + HTML 첨부) */
function buildMimeMessage({ from, to, subject, htmlBody, attachmentHtml, attachmentName }) {
  const boundary = 'QUOTE_BOUNDARY_' + Date.now();
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody.replace(/<[^>]+>/g, '').trim()).toString('base64'),
  ];

  if (attachmentHtml) {
    lines.push(
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8; name="${attachmentName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachmentName}"`,
      '',
      Buffer.from(attachmentHtml).toString('base64'),
    );
  }

  lines.push('', `--${boundary}--`);
  return lines.join('\r\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { quoteId, to, subject, body, quoteHtml, fileName } = req.body || {};
    console.log('[quotes/send] 요청 수신 - to:', to, '| subject:', subject, '| quoteId:', quoteId);

    if (!to || !subject || !quoteHtml) {
      return res.status(400).json({ success: false, error: '필수 파라미터가 없습니다. (to, subject, quoteHtml 필요)' });
    }

    let auth;
    try {
      auth = getOAuth2();
    } catch (e) {
      console.error('[quotes/send] OAuth 초기화 실패:', e.message);
      return res.status(500).json({ success: false, error: 'OAuth 설정 오류: ' + e.message });
    }

    const gmail = google.gmail({ version: 'v1', auth });

    // 발신자 이메일 조회
    let fromEmail = '';
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      fromEmail = profile.data.emailAddress || '';
      console.log('[quotes/send] 발신자 이메일:', fromEmail);
    } catch (e) {
      console.error('[quotes/send] getProfile 실패:', e.code, e.message);
      // 403 / insufficient scope / access denied 모두 재인증 안내
      const msg = (e.message || '').toLowerCase();
      if (e.code === 403 || msg.includes('insufficient') || msg.includes('access denied') || msg.includes('forbidden')) {
        return res.status(403).json({
          success: false,
          error: 'Gmail 권한이 없습니다. /api/auth/login 에서 gmail.send 스코프를 포함하여 재인증 해주세요.',
          needsReauth: true,
        });
      }
      throw e;
    }

    const mime = buildMimeMessage({
      from: fromEmail,
      to,
      subject,
      htmlBody: body || '',
      attachmentHtml: quoteHtml,
      attachmentName: fileName || 'quote.html',
    });

    console.log('[quotes/send] MIME 생성 완료, Gmail API 발송 시작...');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: b64url(mime) },
    });

    console.log('[quotes/send] 발송 성공 - to:', to);
    return res.json({ success: true });
  } catch (e) {
    console.error('[quotes/send] 최종 오류:', e.code, e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
};
