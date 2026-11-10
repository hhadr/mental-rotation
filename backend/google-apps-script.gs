/**
 * Google Apps Script backend: appends every participant's trials to a Google Sheet.
 *
 * Setup:
 *  1. Create a new Google Sheet -> Extensions -> Apps Script, paste this file, save.
 *  2. Deploy -> New deployment -> type "Web app"
 *       Execute as: Me      Who has access: Anyone
 *     and allow the permissions Google asks for.
 *  3. Open the web-app URL (…/exec) in a browser. It should show {"ok":true,...}.
 *  4. Put that URL in js/config.js:  gasUrl: 'https://script.google.com/macros/s/XXXX/exec'
 *  5. After editing this script: Deploy -> Manage deployments -> edit -> Version: New version.
 *
 * Every value is stored as text. This keeps the sheet identical to the CSV: a sheet with a
 * Czech locale would otherwise change 0.42 to 0,42 and could read 2-3-1 as a date. It also
 * stops a participant's free-text answer from running as a formula.
 */
const SHEET_NAME = 'data';
const SUBMISSION_COLUMN = 'submission';
const MAX_ROWS = 200;
const MAX_COLUMNS = 200;
const MAX_CELL_LENGTH = 40000; // Google Sheets allows 50 000 characters per cell

const reply = (obj) => ContentService.createTextOutput(JSON.stringify(obj))
  .setMimeType(ContentService.MimeType.JSON);

// A leading apostrophe makes Google Sheets keep the value as plain text; it is not part of the value.
const asText = (v) => (v === null || v === undefined || v === '' ? '' : "'" + String(v).slice(0, MAX_CELL_LENGTH));

// The web app is public, so only well-formed submissions of a sensible size are accepted.
function isValid(body) {
  return /^[\w.-]{1,200}$/.test(body.filename)
    && Array.isArray(body.columns) && body.columns.length > 0 && body.columns.length <= MAX_COLUMNS
    && body.columns.every((c) => /^[\w-]{1,64}$/.test(c))
    && Array.isArray(body.rows) && body.rows.length > 0 && body.rows.length <= MAX_ROWS
    && body.rows.every((r) => Array.isArray(r) && r.length === body.columns.length);
}

function alreadySaved(sheet, header, filename) {
  const col = header.indexOf(SUBMISSION_COLUMN);
  if (col === -1 || sheet.getLastRow() < 2) return false;
  return sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(filename).matchEntireCell(true).findNext() !== null;
}

// Lets you check the deployment by opening its URL in a browser.
function doGet() {
  return reply({ ok: true, message: 'The mental rotation data endpoint is running.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const body = JSON.parse(e.postData.contents);
    if (!isValid(body)) return reply({ ok: false, error: 'invalid submission' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // Keep one header row; add any new columns at the end.
    const columns = [SUBMISSION_COLUMN].concat(body.columns);
    let header = sheet.getLastRow() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];

    // The browser retries when it gets no answer, so the same submission can arrive twice.
    if (alreadySaved(sheet, header, body.filename)) {
      return reply({ ok: true, rows: 0, duplicate: true });
    }

    const missing = columns.filter((c) => header.indexOf(c) === -1);
    if (missing.length) {
      header = header.concat(missing);
      sheet.getRange(1, 1, 1, header.length).setValues([header]);
    }
    const idx = columns.map((c) => header.indexOf(c));
    const out = body.rows.map((r) => {
      const row = new Array(header.length).fill('');
      [body.filename].concat(r).forEach((v, i) => { row[idx[i]] = asText(v); });
      return row;
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, out.length, header.length).setValues(out);
    SpreadsheetApp.flush();
    return reply({ ok: true, rows: out.length });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
