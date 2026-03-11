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
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { GOOGLE_CLIENT_ID: cid, GOOGLE_CLIENT_SECRET: cs, GOOGLE_REFRESH_TOKEN: rt } = process.env;
    if (!cid || !cs || !rt) return res.json({ success: false, error: '환경변수가 설정되지 않았습니다.' });

    const auth = new google.auth.OAuth2(cid, cs);
    auth.setCredentials({ refresh_token: rt });
    const sheets = google.sheets({ version: 'v4', auth });

    let { spreadsheetId } = req.body || {};

    if (!spreadsheetId) {
      const resp = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: '영업관리 시스템' },
          sheets: Object.keys(SHEET_HEADERS).map(title => ({ properties: { title } })),
        },
      });
      spreadsheetId = resp.data.spreadsheetId;

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: Object.entries(SHEET_HEADERS).map(([name, h]) => ({
            range: `${name}!A1`, values: [h],
          })),
        },
      });
    }

    res.json({ success: true, spreadsheetId });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
};
