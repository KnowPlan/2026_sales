'use strict';
module.exports = async (req, res) => {
  const hasAuth = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
  const spreadsheetId = process.env.SPREADSHEET_ID || null;
  res.json({
    authenticated: hasAuth && !!spreadsheetId,
    spreadsheetId,
  });
};
