import readXlsxFile from 'read-excel-file';

/**
 * Parse CSV or XLSX file into array of row objects.
 * Returns array of { [header]: value } objects.
 */
export function parseSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xls')) {
      reject(new Error('Format .xls lama tidak didukung. Simpan ulang file sebagai .xlsx atau .csv'));
      return;
    }
    const isXlsx = lower.endsWith('.xlsx');

    if (isXlsx) {
      readXlsxFile(file)
        .then((sheet) => {
          if (!sheet || sheet.length < 2) { reject(new Error('File harus memiliki header dan minimal 1 baris data')); return; }
          const headers = sheet[0].map(h => String(h ?? '').trim().toLowerCase().replace(/"/g, ''));
          const rows = sheet.slice(1)
            .filter(r => r.some(v => v !== null && String(v).trim() !== ''))
            .map(r => {
              const row = {};
              headers.forEach((h, idx) => {
                const v = r[idx];
                // tanggal Excel -> YYYY-MM-DD supaya sama dengan format CSV
                row[h] = v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').trim();
              });
              return row;
            });
          resolve(rows);
        })
        .catch(() => reject(new Error('Gagal membaca file Excel')));
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
