/**
 * Transformasi unit display di struk/invoice berdasarkan nama barang:
 *
 * 1. Barang dengan akhiran "ml", "ML", atau "L" (volume cair):
 *    - Pesanan dus → tetap "dus"
 *    - Pesanan pecahan (pcs/satuan) → "btl" (botol)
 *
 * 2. Barang yang namanya mengandung "npk":
 *    - Pesanan dus → "zak"
 *    - Pesanan pecahan → tetap "pcs"
 *
 * 3. Barang lain: unit tidak berubah.
 *
 * @param {string} productName - Nama produk
 * @param {string} unit - Unit asli dari backend ("dus" atau "pcs")
 * @returns {string} Unit untuk ditampilkan di struk
 */
export function displayUnit(productName, unit) {
  const name = (productName || '').toLowerCase().trim();
  const u = (unit || '').toLowerCase();

  // Aturan 2: NPK — pesanan dus → "zak", pecahan tetap "pcs"
  if (name.includes('npk')) {
    if (u === 'dus') return 'zak';
    return 'pcs';
  }

  // Aturan 1: Volume cair (akhiran ml / ML / L dengan angka di depannya)
  // Match contoh: "1L", "500ml", "10 X 1L", "250 ML"
  const liquidSuffix = /\d+\s*(ml|l)\s*$/i;
  if (liquidSuffix.test(name)) {
    if (u === 'dus') return 'dus';
    return 'btl';
  }

  // Default: unit asli
  return unit;
}
