import * as XLSX from 'xlsx';

/**
 * Parse CSV or XLSX file into array of row objects.
 * Returns array of { [header]: value } objects.
 */
export function parseSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          // Normalize headers to lowercase
          const rows = jsonRows.map(row => {
            const normalized = {};
            Object.keys(row).forEach(key => {
              normalized[key.trim().toLowerCase().replace(/"/g, '')] = String(row[key]).trim();
            });
            return normalized;
          });
          resolve(rows);
        } catch (err) {
          reject(new Error('Gagal membaca file Excel'));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsArrayBuffer(file);
    } else {
      // CSV
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target.result;
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length < 2) { reject(new Error('File harus memiliki header dan minimal 1 baris data')); return; }
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
          const rows = [];
          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            if (vals.length < 2) continue;
            const row = {};
            headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
            rows.push(row);
          }
          resolve(rows);
        } catch (err) {
          reject(new Error('Gagal membaca file CSV'));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsText(file);
    }
  });
}

/** Parse date string: supports DD/MM/YYYY -> YYYY-MM-DD, or pass through YYYY-MM-DD */
export function parseDate(dateVal) {
  if (!dateVal) return '';
  const s = String(dateVal).trim();
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  // Handle Excel numeric date (days since 1899-12-30)
  const num = Number(s);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const d = new Date((num - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return s;
}
