// js/workers/csvWorker.js
// Worker: receives {file, previewRows} via postMessage, returns {status, headers, rows, counts}
// Note: modern browsers support File.text() inside worker.

function parseCSV(text) {
  // Robust streaming parser for CSV (handles quotes, commas inside quotes, CRLF)
  const rows = [];
  let cur = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i+1];

    if (ch === '"') {
      if (inQuotes && next === '"') { // escaped quote
        cur += '"';
        i++; // skip next
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (ch === ',')) {
      row.push(cur);
      cur = "";
      continue;
    }

    // newline handling when not in quotes
    if (!inQuotes && ch === '\n') {
      // trim optional CR from CRLF
      if (cur.endsWith('\r')) cur = cur.slice(0, -1);
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    cur += ch;
  }
  // push leftover
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function normalizePhone(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  // remove spaces, brackets, hyphens, plus signs (keep leading + optionally)
  s = s.replace(/[\s\-\(\)\.]/g, '');
  // if it starts with 0 and looks local, we keep digits only - server should enforce full format
  // keep only digits and leading +
  s = s.replace(/[^\d+]/g, '');
  // remove leading zeros if any (leave as is: better to send raw to server)
  if (s === '') return null;
  return s;
}

self.onmessage = async (ev) => {
  const { file, previewRows = 20 } = ev.data;
  if (!file) {
    postMessage({ status: 'error', message: 'No file provided' });
    return;
  }

  try {
    const text = await file.text(); // may be large but worker handles it
    const allRows = parseCSV(text);

    if (allRows.length === 0) {
      postMessage({ status: 'done', headers: [], rows: [], counts: { total: 0, unique: 0, invalidPhones: 0 } });
      return;
    }

    const headers = allRows[0].map(h => h.trim());
    const dataRows = allRows.slice(1);

    const seenPhones = new Set();
    const parsedPreview = [];
    let invalidPhones = 0;

    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      const obj = {};
      for (let c = 0; c < headers.length; c++) obj[headers[c] || `col${c}`] = row[c] ?? '';

      // try find phone column heuristically: headers with phone or mobile or number or 0th column fallback
      let phoneCandidate = null;
      const phoneHeaderIndex = headers.findIndex(h => /phone|mobile|contact|number|msisdn/i.test(h));
      if (phoneHeaderIndex >= 0) phoneCandidate = (dataRows[r][phoneHeaderIndex] || '').trim();
      else phoneCandidate = (dataRows[r][0] || '').trim();

      const normalized = normalizePhone(phoneCandidate);
      if (!normalized) invalidPhones++;
      else seenPhones.add(normalized);

      if (parsedPreview.length < previewRows) {
        parsedPreview.push({ raw: obj, phone: normalized });
      }
    }

    const counts = { total: dataRows.length, unique: seenPhones.size, invalidPhones };
    postMessage({ status: 'done', headers, rows: parsedPreview, counts });
  } catch (err) {
    postMessage({ status: 'error', message: String(err) });
  }
};
