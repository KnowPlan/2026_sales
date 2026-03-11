'use strict';
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  // Vercel 환경변수는 서버에서 직접 삭제할 수 없습니다.
  // Vercel 대시보드에서 환경변수를 제거 후 재배포하세요.
  res.json({ ok: true });
};
