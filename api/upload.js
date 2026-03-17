'use strict';
const { google } = require('googleapis');
const { Readable } = require('stream');
const { appendRow } = require('./_lib/sheets');

function getOAuth2() {
  const cid = process.env.GOOGLE_CLIENT_ID?.trim();
  const cs  = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const rt  = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!cid || !cs || !rt) throw new Error('Google OAuth 환경변수가 설정되지 않았습니다.');
  const auth = new google.auth.OAuth2(cid, cs);
  auth.setCredentials({ refresh_token: rt });
  return auth;
}

function genId() {
  return 'att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function getOrCreateFolder(drive, name, parentId) {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive' });
  if (res.data.files.length > 0) return res.data.files[0].id;
  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const f = await drive.files.create({ requestBody: body, fields: 'id' });
  return f.data.id;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { fileName, mimeType, base64Data, targetType, targetId, uploadedBy } = req.body || {};
    if (!fileName || !base64Data || !targetType || !targetId) {
      return res.status(400).json({ success: false, error: '필수 파라미터가 없습니다.' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const size = buffer.length;
    if (size > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: '파일 크기는 10MB를 초과할 수 없습니다.' });
    }

    const auth = getOAuth2();
    const drive = google.drive({ version: 'v3', auth });

    // 루트 폴더 조회/생성
    const envFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
    const rootFolderId = envFolderId || await getOrCreateFolder(drive, 'SalesWebFiles', null);

    // 대상 유형 서브폴더 조회/생성
    const subFolderId = await getOrCreateFolder(drive, targetType, rootFolderId);

    // 파일 업로드
    const stream = Readable.from(buffer);
    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeType || 'application/octet-stream',
        parents: [subFolderId],
      },
      media: {
        mimeType: mimeType || 'application/octet-stream',
        body: stream,
      },
      fields: 'id,webViewLink',
    });

    const fileId = uploadRes.data.id;
    const driveUrl = uploadRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    // 링크 공유 권한 (누구나 링크로 보기)
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    // Sheets 메타데이터 저장
    const id = genId();
    const now = new Date().toISOString().slice(0, 19);
    const metadata = {
      id,
      targetType,
      targetId,
      fileName,
      mimeType: mimeType || 'application/octet-stream',
      driveFileId: fileId,
      driveUrl,
      size: String(size),
      uploadedBy: uploadedBy || '',
      createdAt: now,
    };
    await appendRow('Attachments', metadata);

    return res.json({ success: true, data: metadata });
  } catch (e) {
    console.error('[upload] error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
};
