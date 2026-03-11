'use strict';
module.exports = async (req, res) => {
  const id = process.env.SPREADSHEET_ID;
  if (!id) return res.json({ url: null });
  res.json({ url: `https://docs.google.com/spreadsheets/d/${id}/edit` });
};
