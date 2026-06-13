/**
 * Feng Cha Ops bi-weekly inventory sync.
 *
 * Deploy as Google Apps Script Web App:
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * Then save the Web App URL in app_settings as key biw_sheet_webhook_url
 * or paste it into BIW_SHEET_WEBHOOK_URL in index.html.
 */

const SHEET_ID = '10WrpioWY-fvcV-B95xFP8fp9HGGeUgP49TX4HTuJKpc';
const SHEET_NAME = ''; // Leave blank to use the first sheet tab.
const STORE_COLUMNS = {
  Heights: 3, // Column C
  SP: 4       // Column D / Spring Branch
};
const ITEM_NAME_COLUMNS = [1, 2]; // Match item names from Column A or B.

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const store = payload.store;
    const targetCol = STORE_COLUMNS[store];
    if (!targetCol) throw new Error('Unknown store: ' + store);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
    if (!sheet) throw new Error('Sheet tab not found.');

    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const rowMap = buildItemRowMap_(sheet);
    const updates = [];

    rows.forEach(item => {
      const name = String(item.item_name || '').trim();
      if (!name) return;
      let rowNum = rowMap[normalize_(name)];
      if (!rowNum) {
        rowNum = Math.max(sheet.getLastRow() + 1, 2);
        sheet.getRange(rowNum, 1).setValue(name);
        rowMap[normalize_(name)] = rowNum;
      }
      updates.push({ rowNum, value: item.count });
    });

    updates.forEach(update => {
      sheet.getRange(update.rowNum, targetCol).setValue(update.value);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, updated: updates.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err && err.message || err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function buildItemRowMap_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = Math.max(Math.max.apply(null, ITEM_NAME_COLUMNS), sheet.getLastColumn(), 1);
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const map = {};
  values.forEach((row, idx) => {
    ITEM_NAME_COLUMNS.forEach(col => {
      const value = String(row[col - 1] || '').trim();
      if (value) map[normalize_(value)] = idx + 1;
    });
  });
  return map;
}

function normalize_(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
