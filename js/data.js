// CSV building and data upload.

export function toCSV(rows) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function downloadText(text, filename, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function backupLocal(key, csv) {
  try { localStorage.setItem(key, csv); } catch { /* storage unavailable */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs `send` up to 3 times; it throws if the data were not confirmed as stored.
async function withRetries(send) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await send();
      return;
    } catch (e) { lastErr = e; }
    await sleep(1000 * (attempt + 1));
  }
  throw lastErr;
}

// Resolves once the backend has confirmed the data; throws on failure.
export async function saveData(config, filename, csv, rows) {
  if (config.dataBackend === 'datapipe') {
    if (!config.datapipeExperimentId) throw new Error('datapipeExperimentId not set');
    await withRetries(async () => {
      const res = await fetch('https://pipe.jspsych.org/api/data/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: '*/*' },
        body: JSON.stringify({ experimentID: config.datapipeExperimentId, filename, data: csv }),
      });
      if (!res.ok) throw new Error(`DataPipe HTTP ${res.status}: ${await res.text()}`);
    });
    return;
  }
  if (config.dataBackend === 'gas') {
    if (!config.gasUrl) throw new Error('gasUrl not set');
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const body = JSON.stringify({ filename, columns, rows: rows.map((r) => columns.map((c) => r[c] ?? '')) });
    await withRetries(async () => {
      // text/plain avoids the CORS preflight that Apps Script cannot answer.
      const res = await fetch(config.gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
      const reply = await res.json();
      if (!reply.ok) throw new Error(`Google Sheet: ${reply.error}`);
    });
    return;
  }
  throw new Error('no-backend');
}
