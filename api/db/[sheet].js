'use strict';
const { readAll, appendRow } = require('../_lib/sheets');

module.exports = async (req, res) => {
  const { sheet } = req.query;
  try {
    if (req.method === 'GET') {
      const data = await readAll(sheet);
      return res.json({ success: true, data });
    }
    if (req.method === 'POST') {
      await appendRow(sheet, req.body || {});
      return res.json({ success: true });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
