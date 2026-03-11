'use strict';
const { updateRow, deleteRow } = require('../../_lib/sheets');

module.exports = async (req, res) => {
  const { sheet, id } = req.query;
  try {
    if (req.method === 'PUT') {
      await updateRow(sheet, id, req.body || {});
      return res.json({ success: true });
    }
    if (req.method === 'DELETE') {
      await deleteRow(sheet, id);
      return res.json({ success: true });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
