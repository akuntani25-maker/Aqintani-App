// Pengganti bagian log aktivitas & import data di backend/routers/admin_routes.py
import { db, uuid, nowIso, witaDate, num, badRequest, notFound, requireAdmin, requireAdminOrManager } from '../core';
import { parseSpreadsheetFile } from '../../utils/fileParser';

const TYPES = [
  { key: 'warehouses', label: 'Gudang', order: 1, columns: ['nama', 'unit', 'urutan'] },
  { key: 'categories', label: 'Kategori', order: 2, columns: ['nama', 'deskripsi'] },
  { key: 'suppliers', label: 'Supplier', order: 3, columns: ['nama', 'kontak', 'telepon', 'email', 'alamat'] },
  { key: 'products', label: 'Produk', order: 4, columns: ['nama', 'barcode', 'kategori', 'supplier', 'harga_jual', 'harga_beli', 'harga_box', 'isi_per_box', 'min_stok', 'kadaluarsa', 'batch', 'deskripsi'] },
  { key: 'warehouse_stock', label: 'Stok per Gudang', order: 5, columns: ['produk', 'gudang', 'stok'] },
  { key: 'purchases', label: 'Pembelian Supplier', order: 6, columns: ['no_pembelian', 'supplier', 'tanggal', 'produk', 'jumlah', 'harga_satuan', 'total_pembelian', 'dibayar', 'sisa', 'gudang', 'catatan'] },
  { key: 'payment_history', label: 'Pembayaran Hutang Supplier', order: 7, columns: ['supplier', 'tanggal', 'jumlah', 'catatan'] },
  { key: 'partner_stores', label: 'Kios Mitra', order: 8, columns: ['nama', 'pemilik', 'telepon', 'alamat', 'limit_kredit', 'hutang_saat_ini'] },
  { key: 'partner_orders', label: 'Pesanan Kios Mitra', order: 9, columns: ['no_pesanan', 'kios_mitra', 'tanggal', 'produk', 'jumlah', 'harga', 'gudang', 'diskon', 'total_pesanan', 'dibayar', 'sisa', 'sales', 'status'] },
];
const KEYS = TYPES.map(t => t.key);
const sf = (v, d = 0) => { if (v === '' || v == null) return d; const n = Number(String(v).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : d; };
const si = (v, d = 0) => Math.trunc(sf(v, d));
const ss = (v, d = '') => { const s = v == null ? '' : String(v).trim(); return s || d; };
const lc = v => ss(v).toLowerCase();

export default function register(route) {
  route('GET', '/audit-log', async ({ user, query }) => {
    requireAdminOrManager(user);
    const f = query.entity_type ? { entity_type: query.entity_type } : {};
    return db.audit_log.find(f).sort('timestamp', -1).limit(num(query.limit, 100) || 100).toArray();
  });

  route('GET', '/import/types', async ({ user }) => { requireAdmin(user); return TYPES; });
  route('GET', '/import/counts', async ({ user }) => {
    requireAdmin(user);
    const out = {};
    await Promise.all(KEYS.map(async k => { out[k] = await db[k].countDocuments({}); }));
    return out;
  });
  route('GET', '/import/template/:type', async ({ user, params }) => {
    requireAdmin(user);
    const t = TYPES.find(x => x.key === params.type);
    if (!t) notFound('Tipe import tidak ditemukan');
    return new Blob(['﻿' + t.columns.join(',') + '\n'], { type: 'text/csv' });
  });
  route('DELETE', '/import/clear/:type', async ({ user, params }) => {
    requireAdmin(user);
    if (!KEYS.includes(params.type)) badRequest('Tipe tidak didukung');
    const r = await db[params.type].deleteMany({});
    return { message: `${r.deletedCount} data dihapus dari ${params.type}` };
  });

  route('POST', '/import/:type', async ({ user, params, body }) => {
    requireAdmin(user);
    const type = params.type;
    const file = body instanceof FormData ? body.get('file') : body?.file;
    let rows;
    try { rows = await parseSpreadsheetFile(file); } catch (e) { badRequest(`Gagal membaca file: ${e.message}`); }
    rows = (rows || []).filter(r => Object.values(r).some(v => String(v ?? '').trim() !== ''));
    if (!rows.length) badRequest('File kosong atau format tidak sesuai');
    const now = nowIso(); const today = witaDate();
    const res = { success: 0, skipped: 0, errors: [] };
    const err = m => res.errors.push(m);

    if (type === 'warehouses') {
      const ex = Object.fromEntries((await db.warehouses.find({}).toArray()).map(w => [w.name.toLowerCase(), w]));
      let max = Math.max(0, ...Object.values(ex).map(w => num(w.sort_order)));
      for (const [i, r] of rows.entries()) {
        const nama = ss(r.nama); if (!nama) { err(`Baris ${i + 1}: Nama kosong`); continue; }
        if (ex[nama.toLowerCase()]) { res.skipped += 1; continue; }
        max += 1; let unit = ss(r.unit, 'dus').toLowerCase(); if (!['dus', 'satuan'].includes(unit)) unit = 'dus';
        const doc = { id: nama.toLowerCase().replace(/[\s-]/g, '_'), name: nama, unit, sort_order: si(r.urutan, max) };
        await db.warehouses.insertOne(doc); ex[nama.toLowerCase()] = doc; res.success += 1;
      }
    } else if (type === 'categories' || type === 'suppliers' || type === 'partner_stores') {
      const ex = new Set((await db[type].find({}, { name: 1 }).toArray()).map(x => (x.name || '').toLowerCase()));
      const docs = [];
      for (const [i, r] of rows.entries()) {
        const nama = ss(r.nama); if (!nama) { err(`Baris ${i + 1}: Nama kosong`); continue; }
        if (ex.has(nama.toLowerCase())) { res.skipped += 1; continue; }
        if (type === 'categories') docs.push({ id: uuid(), name: nama, description: ss(r.deskripsi), created_at: now });
        else if (type === 'suppliers') docs.push({ id: uuid(), name: nama, contact_person: ss(r.kontak), phone: ss(r.telepon), email: ss(r.email), address: ss(r.alamat), created_at: now });
        else docs.push({ id: uuid(), name: nama, owner_name: ss(r.pemilik), phone: ss(r.telepon), address: ss(r.alamat), latitude: null, longitude: null, credit_limit: sf(r.limit_kredit), current_debt: sf(r.hutang_saat_ini), vehicle_id: '', created_at: now });
        ex.add(nama.toLowerCase()); res.success += 1;
      }
      await db[type].insertMany(docs);
    } else if (type === 'products') {
      const cats = Object.fromEntries((await db.categories.find({}).toArray()).map(c => [c.name.toLowerCase(), c.id]));
      const sups = Object.fromEntries((await db.suppliers.find({}).toArray()).map(s => [s.name.toLowerCase(), s.id]));
      const ex = new Set((await db.products.find({}, { name: 1 }).toArray()).map(p => (p.name || '').toLowerCase()));
      const whs = await db.warehouses.find({}, { id: 1 }).toArray();
      const docs = [], stocks = [];
      for (const [i, r] of rows.entries()) {
        const nama = ss(r.nama); if (!nama) { err(`Baris ${i + 1}: Nama kosong`); continue; }
        if (ex.has(nama.toLowerCase())) { res.skipped += 1; continue; }
        const cn = lc(r.kategori), sn = lc(r.supplier);
        if (cn && !cats[cn]) { err(`Baris ${i + 1}: Kategori '${r.kategori}' tidak ditemukan`); continue; }
        if (sn && !sups[sn]) { err(`Baris ${i + 1}: Supplier '${r.supplier}' tidak ditemukan`); continue; }
        const id = uuid();
        docs.push({
          id, name: nama, barcode: ss(r.barcode), category_id: cats[cn] || '', supplier_id: sups[sn] || '', stock: 0,
          price: sf(r.harga_jual), cost_price: sf(r.harga_beli), box_price: sf(r.harga_box), items_per_box: Math.max(1, si(r.isi_per_box, 1)),
          min_stock_alert: si(r.min_stok, 10), expiry_date: ss(r.kadaluarsa), batch_number: ss(r.batch), description: ss(r.deskripsi),
          image: '', created_at: now, updated_at: now,
        });
        whs.forEach(w => stocks.push({ product_id: id, warehouse_id: w.id, stock: 0 }));
        ex.add(nama.toLowerCase()); res.success += 1;
      }
      await db.products.insertMany(docs);
      await db.warehouse_stock.insertMany(stocks);
    } else if (type === 'warehouse_stock') {
      const prods = Object.fromEntries((await db.products.find({}, { id: 1, name: 1 }).toArray()).map(p => [p.name.toLowerCase(), p]));
      const whs = Object.fromEntries((await db.warehouses.find({}).toArray()).map(w => [w.name.toLowerCase(), w.id]));
      for (const [i, r] of rows.entries()) {
        const pn = lc(r.produk), wn = lc(r.gudang);
        if (!pn || !wn) { err(`Baris ${i + 1}: Produk atau gudang kosong`); continue; }
        if (!prods[pn]) { err(`Baris ${i + 1}: Produk '${r.produk}' tidak ditemukan`); continue; }
        if (!whs[wn]) { err(`Baris ${i + 1}: Gudang '${r.gudang}' tidak ditemukan`); continue; }
        await db.warehouse_stock.updateOne({ product_id: prods[pn].id, warehouse_id: whs[wn] }, { $set: { stock: si(r.stok) } }, { upsert: true });
        res.success += 1;
      }
    } else if (type === 'purchases' || type === 'partner_orders') {
      const isP = type === 'purchases';
      const owners = Object.fromEntries((await (isP ? db.suppliers : db.partner_stores).find({}).toArray()).map(s => [s.name.toLowerCase(), s]));
      const prods = Object.fromEntries((await db.products.find({}, { id: 1, name: 1 }).toArray()).map(p => [p.name.toLowerCase(), p]));
      const whs = Object.fromEntries((await db.warehouses.find({}).toArray()).map(w => [w.name.toLowerCase(), w.id]));
      const canv = isP ? {} : Object.fromEntries((await db.canvassers.find({}).toArray()).map(c => [c.name.toLowerCase(), c]));
      const groups = {};
      rows.forEach((r, i) => { const k = ss(isP ? r.no_pembelian : r.no_pesanan) || `auto_${i + 1}`; (groups[k] = groups[k] || []).push([i + 1, r]); });
      for (const [key, g] of Object.entries(groups)) {
        const first = g[0][1];
        const owner = owners[lc(isP ? first.supplier : first.kios_mitra)];
        if (!owner) { g.forEach(([i]) => err(`Baris ${i}: ${isP ? `Supplier '${first.supplier}'` : `Kios '${first.kios_mitra}'`} tidak ditemukan`)); continue; }
        const items = []; let bad = false;
        for (const [i, r] of g) {
          const pn = lc(r.produk); if (!pn) continue;
          const p = prods[pn]; if (!p) { err(`Baris ${i}: Produk '${r.produk}' tidak ditemukan`); bad = true; continue; }
          const q = si(r.jumlah);
          if (isP) { const h = sf(r.harga_satuan); items.push({ product_id: p.id, product_name: p.name, quantity: q, cost_price: h, subtotal: q * h }); }
          else { const h = sf(r.harga); items.push({ product_id: p.id, product_name: p.name, quantity: q, price: h, subtotal: q * h, warehouse_id: whs[lc(r.gudang)] || '', sell_unit: '' }); }
        }
        if (bad || !items.length) continue;
        const subtotal = items.reduce((s, x) => s + x.subtotal, 0);
        const disc = isP ? 0 : sf(first.diskon);
        const total = sf(isP ? first.total_pembelian : first.total_pesanan) || subtotal - disc;
        const paid = sf(first.dibayar); const rem = ss(first.sisa) ? sf(first.sisa) : total - paid;
        const date = ss(first.tanggal) || today;
        if (isP) {
          await db.purchases.insertOne({ id: uuid(), supplier_id: owner.id, supplier_name: owner.name, items, total, paid, remaining: rem, warehouse_id: whs[lc(first.gudang)] || 'gudang_utama', notes: ss(first.catatan), created_at: `${date}T00:00:00+00:00`, date });
        } else {
          const c = canv[lc(first.sales)];
          await db.partner_orders.insertOne({
            id: uuid(), order_number: key.startsWith('auto_') ? `PO-IMP-${uuid().slice(0, 8).toUpperCase()}` : key, partner_store_id: owner.id, partner_store_name: owner.name,
            items, subtotal, discount: disc, total, paid, remaining: rem, delivery_date: date, canvasser_id: c?.id || '', canvasser_name: c?.name || ss(first.sales),
            warehouse_id: whs[lc(first.gudang)] || '', status: ss(first.status) || 'completed', created_at: `${date}T00:00:00+00:00`, date, has_return: false,
          });
        }
        res.success += 1;
      }
    } else if (type === 'payment_history') {
      const sups = Object.fromEntries((await db.suppliers.find({}).toArray()).map(s => [s.name.toLowerCase(), s]));
      for (const [i, r] of rows.entries()) {
        const s = sups[lc(r.supplier)]; if (!s) { err(`Baris ${i + 1}: Supplier '${r.supplier}' tidak ditemukan`); continue; }
        const amt = sf(r.jumlah); if (amt <= 0) { err(`Baris ${i + 1}: Jumlah harus > 0`); continue; }
        const date = ss(r.tanggal) || today;
        await db.payment_history.insertOne({ id: uuid(), type: 'supplier', reference_id: s.id, supplier_id: s.id, supplier_name: s.name, amount: amt, notes: ss(r.catatan) || `Import: Pembayaran ke ${s.name}`, created_at: `${date}T00:00:00+00:00`, date });
        res.success += 1;
      }
    } else badRequest(`Tipe import '${type}' tidak didukung`);

    return { type, total_rows: rows.length, success: res.success, skipped: res.skipped, error_count: res.errors.length, errors: res.errors.slice(0, 50) };
  });
}
