'use strict';
const { google } = require('googleapis');
const { readAll, deleteRow } = require('./_lib/sheets');

function getOAuth2() {
  const cid = process.env.GOOGLE_CLIENT_ID?.trim();
  const cs  = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const rt  = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!cid || !cs || !rt) throw new Error('Google OAuth 환경변수가 설정되지 않았습니다.');
  const auth = new google.auth.OAuth2(cid, cs);
  auth.setCredentials({ refresh_token: rt });
  return auth;
}

module.exports = async (req, res) => {
  try {
    // GET: targetType + targetId 필터링
    if (req.method === 'GET') {
      const { targetType, targetId } = req.query;
      const rows = await readAll('Attachments');
      const filtered = rows.filter(r =>
        (!targetType || r.targetType === targetType) &&
        (!targetId   || r.targetId   === targetId)
      );
      return res.json({ success: true, data: filtered });
    }

    // DELETE: id로 Drive 삭제 + Sheets 행 삭제
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'id가 필요합니다.' });

      // Sheets에서 파일 메타데이터 조회
      const rows = await readAll('Attachments');
      const att = rows.find(r => r.id === id);
      if (!att) return res.status(404).json({ success: false, error: '첨부파일을 찾을 수 없습니다.' });

      // Google Drive 파일 삭제
      if (att.driveFileId) {
        try {
          const auth = getOAuth2();
          const drive = google.drive({ version: 'v3', auth });
          await drive.files.delete({ fileId: att.driveFileId });
        } catch (e) {
          console.warn('[attachments] Drive 삭제 실패 (무시):', e.message);
          // Drive 삭제 실패해도 Sheets에서는 삭제 진행
        }
      }

      // Sheets 행 삭제
      await deleteRow('Attachments', id);

      return res.json({ success: true });
    }

    return res.status(405).end();
  } catch (e) {
    console.error('[attachments] error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
};
