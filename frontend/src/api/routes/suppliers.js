// Pengganti backend/routers/supplier_routes.py
import {
  db, uuid, nowIso, witaDate, witaIso, num, sum, notFound, badRequest, requirePanel, incStock, ensureWarehouseStock, logAudit, daysAgo,
} from '../core';

function csvRow(cells) {
  return cells.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',');
}

// Bayar hutang supplier dari pembelian paling lama (FIFO)
async function payFifo(supplierId, amount) {
  const unpaid = await db.purchases.find({ supplier_id: supplierId, remaining: { $gt: 0 } }).sort('date', 1).toArray();
  let left = amount; const paidPurchases = [];
  for (const p of unpaid) {
    if (left <= 0) break;
    const payThis = Math.min(left, num(p.remaining));
    const newPaid = num(p.paid) + payThis;
    await db.purchases.updateOne({ id: p.id }, { $set: { paid: newPaid, remaining: Math.max(0, num(p.total) - newPaid) } });
    paidPurchases.push({ purchase_id: p.id, amount: payThis });
    left -= payThis;
  }
  return paidPurchases;
}

export default function register(route) {
  route('GET', '/suppliers', async ({ query }) => {
    const filter = query.search ? { name: { $icontains: query.search } } : {};
    if (query.page != null && query.page !== '') {
      const page = Math.max(1, num(query.page, 1)); const per = num(query.per_page, 15) || 15;
      const total = await db.suppliers.countDocuments(filter);
      const data = await db.suppliers.find(filter).sort('name', 1).skip((page - 1) * per).limit(per).toArray();
      return { data, total, page, per_page: per, total_pages: Math.ceil(total / per) };
    }
    return db.suppliers.find(filter).sort('name', 1).toArray();
  });

  route('POST', '/suppliers', async ({ user, body }) => {
    requirePanel(user);
    const doc = { id: uuid(), name: body.name, contact_person: body.contact_person || '', phone: body.phone || '', email: body.email || '', address: body.address || '', created_at: nowIso() };
    await db.suppliers.insertOne(doc);
    return doc;
  });
  route('PUT', '/suppliers/:id', async ({ user, params, body }) => {
    requirePanel(user);
    const r = await db.suppliers.findOneAndUpdate({ id: params.id }, { $set: { name: body.name, contact_person: body.contact_person || '', phone: body.phone || '', email: body.email || '', address: body.address || '' } });
    if (!r) notFound('Supplier not found');
    return r;
  });
  route('DELETE', '/suppliers/:id', async ({ user, params }) => {
    requirePanel(user);
    const r = await db.suppliers.deleteOne({ id: params.id });
    if (!r.deletedCount) notFound('Supplier not found');
    return { message: 'Supplier deleted' };
  });
  route('GET', '/suppliers/:id/purchases', async ({ user, params }) => { requirePanel(user); return db.purchases.find({ supplier_id: params.id }).sort('created_at', -1).toArray(); });
  route('GET', '/suppliers/:id/payments', async ({ params }) => db.payment_history.find({ type: 'supplier', supplier_id: params.id }).sort('created_at', -1).toArray());
  route('GET', '/suppliers/:id/debt', async ({ user, params }) => {
    requirePanel(user);
    const ps = await db.purchases.find({ supplier_id: params.id }).toArray();
    const total = sum(ps, p => p.total), paid = sum(ps, p => p.paid);
    return { supplier_id: params.id, total_purchases: total, total_paid: paid, total_remaining: total - paid, purchase_count: ps.length };
  });

  // ---------- pembelian ----------
  route('GET', '/purchases', async ({ user, query }) => {
    requirePanel(user);
    return db.purchases.find(query.supplier_id ? { supplier_id: query.supplier_id } : {}).sort('created_at', -1).toArray();
  });
  route('PUT', '/purchases/:id/due-date', async ({ user, params, query }) => {
    requirePanel(user);
    const r = await db.purchases.updateOne({ id: params.id }, query.due_date ? { $set: { due_date: query.due_date } } : { $unset: { due_date: '' } });
    if (!r.matchedCount) notFound('Pembelian tidak ditemukan');
    return { message: 'Tanggal jatuh tempo berhasil diperbarui' };
  });
  route('POST', '/purchases/:id/return', async ({ user, params, body }) => {
    requirePanel(user);
    const warehouseId = body.warehouse_id || 'gudang_utama';
    const purchase = await db.purchases.findOne({ id: params.id });
    if (!purchase) notFound('Pembelian tidak ditemukan');
    let total = 0; const items = [];
    for (const it of body.items || []) {
      const qty = Math.trunc(num(it.quantity));
      if (qty <= 0) continue;
      const product = await db.products.findOne({ id: it.product_id });
      if (!product) continue;
      const pi = (purchase.items || []).find(x => x.product_id === it.product_id);
      const cost = pi ? num(pi.cost_price) : num(product.cost_price);
      total += qty * cost;
      items.push({ product_id: it.product_id, product_name: product.name, quantity: qty, cost_price: cost, subtotal: qty * cost });
      const ws = await db.warehouse_stock.findOne({ product_id: it.product_id, warehouse_id: warehouseId });
      if (ws) await db.warehouse_stock.updateOne({ product_id: it.product_id, warehouse_id: warehouseId }, { $set: { stock: Math.max(0, num(ws.stock) - qty) } });
    }
    if (!items.length) badRequest('Tidak ada item yang diretur');
    const newRemaining = Math.max(0, num(purchase.remaining) - total);
    await db.purchases.updateOne({ id: params.id }, { $set: { remaining: newRemaining } });
    await db.payment_history.insertOne({
      id: uuid(), type: 'supplier_return', purchase_id: params.id, supplier_id: purchase.supplier_id, supplier_name: purchase.supplier_name,
      items, total, warehouse_id: warehouseId, notes: body.notes || `Retur ke ${purchase.supplier_name || ''}`, created_at: nowIso(), date: witaDate(),
    });
    return { message: `Retur berhasil. Hutang berkurang ${total}`, return_value: total, new_remaining: newRemaining };
  });
  route('POST', '/purchases', async ({ user, body }) => {
    requirePanel(user);
    const supplier = await db.suppliers.findOne({ id: body.supplier_id });
    if (!supplier) notFound('Supplier not found');
    const warehouseId = body.warehouse_id || 'gudang_utama';
    const doc = {
      id: uuid(), supplier_id: body.supplier_id, supplier_name: supplier.name, items: body.items || [], total: num(body.total),
      paid: num(body.paid), remaining: num(body.total) - num(body.paid), warehouse_id: warehouseId, notes: body.notes || '',
      created_at: nowIso(), date: witaDate(),
    };
    await db.purchases.insertOne(doc);
    for (const it of doc.items) {
      if (it.product_id && num(it.quantity) > 0) { await ensureWarehouseStock(it.product_id); await incStock(it.product_id, warehouseId, num(it.quantity)); }
    }
    return doc;
  });
  route('POST', '/purchases/:id/pay', async ({ user, params, query }) => {
    requirePanel(user);
    const amount = num(query.amount);
    const p = await db.purchases.findOne({ id: params.id });
    if (!p) notFound('Purchase not found');
    const newPaid = num(p.paid) + amount;
    const r = await db.purchases.findOneAndUpdate({ id: params.id }, { $set: { paid: newPaid, remaining: num(p.total) - newPaid } });
    await db.payment_history.insertOne({
      id: uuid(), type: 'supplier', reference_id: params.id, supplier_id: p.supplier_id || '', supplier_name: p.supplier_name || '',
      amount, notes: `Pembayaran pembelian ${p.id}`, created_at: nowIso(), date: witaDate(),
    });
    return r;
  });
  route('DELETE', '/purchases/:id', async ({ user, params }) => {
    requirePanel(user);
    const r = await db.purchases.deleteOne({ id: params.id });
    if (!r.deletedCount) notFound('Purchase not found');
    return { message: 'Purchase deleted' };
  });

  route('GET', '/payment-history', async ({ query }) => {
    const f = {};
    if (query.type) f.type = query.type;
    if (query.reference_id) f.reference_id = query.reference_id;
    return db.payment_history.find(f).sort('created_at', -1).toArray();
  });

  // ---------- hutang supplier ----------
  async function overview() {
    const suppliers = await db.suppliers.find({}).sort('name', 1).toArray();
    const purchases = await db.purchases.find({}, { id: 1, supplier_id: 1, total: 1, paid: 1, remaining: 1, date: 1 }).toArray();
    const bySup = {};
    purchases.forEach(p => { (bySup[p.supplier_id] = bySup[p.supplier_id] || []).push(p); });
    return { suppliers, bySup };
  }
  route('GET', '/supplier-debts/overview', async ({ user }) => {
    requirePanel(user);
    const { suppliers, bySup } = await overview();
    const res = suppliers.map(s => {
      const sp = bySup[s.id] || [];
      const total = sum(sp, p => p.total), paid = sum(sp, p => p.paid);
      const unpaid = sp.filter(p => num(p.remaining) > 0);
      const dates = sp.map(p => p.date || '');
      return {
        supplier_id: s.id, supplier_name: s.name, phone: s.phone || '', contact_person: s.contact_person || '',
        total_purchases: total, total_paid: paid, outstanding: total - paid, purchase_count: sp.length, unpaid_count: unpaid.length,
        last_purchase_date: dates.length ? dates.sort().at(-1) : '',
        oldest_unpaid_date: unpaid.length ? unpaid.map(p => p.date || '').sort()[0] : '',
      };
    });
    res.sort((a, b) => ((a.outstanding > 0 ? -1 : 0) - (b.outstanding > 0 ? -1 : 0)) || (b.outstanding - a.outstanding));
    return res;
  });
  route('GET', '/supplier-debts/summary', async ({ user }) => {
    requirePanel(user);
    const purchases = await db.purchases.find({}, { supplier_id: 1, remaining: 1, date: 1 }).toArray();
    const totalDebt = sum(purchases, p => Math.max(0, num(p.remaining)));
    const withDebt = new Set(purchases.filter(p => num(p.remaining) > 0).map(p => p.supplier_id)).size;
    const monthStart = witaDate().slice(0, 7) + '-01';
    const pays = await db.payment_history.find({ type: 'supplier', date: { $gte: monthStart } }, { amount: 1 }).toArray();
    // Hutang "lewat jatuh tempo": tempo 30 hari dari tanggal pembelian, sesuai label di halaman
    const cutoff = daysAgo(30);
    const overdue = purchases.filter(p => num(p.remaining) > 0 && (p.date || '') <= cutoff);
    return {
      total_debt: totalDebt, suppliers_with_debt: withDebt, total_paid_this_month: sum(pays, p => p.amount),
      payments_this_month_count: pays.length, overdue_count: overdue.length, overdue_total: sum(overdue, p => p.remaining),
    };
  });
  route('GET', '/supplier-debts/export-csv', async ({ user }) => {
    requirePanel(user);
    const { suppliers, bySup } = await overview();
    const lines = [csvRow(['Supplier', 'Kontak', 'Telepon', 'Jml Pembelian', 'Total Pembelian', 'Total Dibayar', 'Sisa Hutang', 'Pembelian Belum Lunas', 'Tanggal Pembelian Terakhir'])];
    for (const s of suppliers) {
      const sp = bySup[s.id] || [];
      const total = sum(sp, p => p.total), paid = sum(sp, p => p.paid);
      if (total - paid > 0 || sp.length) {
        lines.push(csvRow([s.name, s.contact_person || '', s.phone || '', sp.length, total.toFixed(0), paid.toFixed(0), (total - paid).toFixed(0),
          sp.filter(p => num(p.remaining) > 0).length, sp.length ? sp.map(p => p.date || '').sort().at(-1) : '-']));
      }
    }
    return new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' });
  });
  route('GET', '/supplier-debts/:id/purchase-items', async ({ user, params, query }) => {
    requirePanel(user);
    const f = { supplier_id: params.id };
    if (query.date_from || query.date_to) f.date = { ...(query.date_from ? { $gte: query.date_from } : {}), ...(query.date_to ? { $lte: query.date_to } : {}) };
    const purchases = await db.purchases.find(f).sort('date', -1).toArray();
    const pids = new Set(); purchases.forEach(p => (p.items || []).forEach(i => i.product_id && pids.add(i.product_id)));
    const prods = pids.size ? await db.products.find({ id: { $in: [...pids] } }, { id: 1, items_per_box: 1 }).toArray() : [];
    const pm = Object.fromEntries(prods.map(p => [p.id, p]));
    const search = (query.search || '').toLowerCase();
    const out = [];
    for (const p of purchases) for (const it of p.items || []) {
      const name = it.product_name || '';
      if (search && !name.toLowerCase().includes(search)) continue;
      const ipb = num(it.items_per_box) || num(pm[it.product_id]?.items_per_box, 1) || 1;
      const qty = num(it.quantity);
      out.push({
        purchase_id: p.id, date: p.date || '', product_name: name, qty_dus: qty, items_per_box: ipb, qty_satuan: Math.trunc(qty * ipb),
        cost_price: it.cost_price || 0, subtotal: it.subtotal ?? qty * num(it.cost_price), due_date: p.due_date || '', purchase_remaining: p.remaining || 0,
      });
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  });
  route('POST', '/supplier-debts/:id/import-csv', async ({ user, params, body }) => {
    requirePanel(user);
    const rows = body.rows || [];
    if (!rows.length) badRequest('Data import kosong');
    const supplier = await db.suppliers.findOne({ id: params.id });
    if (!supplier) notFound('Supplier tidak ditemukan');
    const grouped = {};
    for (const r of rows) {
      const d = r.date || witaDate();
      grouped[d] = grouped[d] || { items: [], due_date: r.due_date || '' };
      if (!grouped[d].due_date && r.due_date) grouped[d].due_date = r.due_date;
      grouped[d].items.push(r);
    }
    let count = 0;
    for (const [date, g] of Object.entries(grouped)) {
      const items = g.items.map(r => {
        const qty = Math.trunc(num(r.qty_dus)); const cost = num(r.cost_price);
        count += 1;
        return { product_name: r.product_name || '', product_id: '', quantity: qty, items_per_box: num(r.items_per_box, 1) || 1, cost_price: cost, subtotal: cost * qty };
      });
      const total = sum(items, i => i.subtotal);
      await db.purchases.insertOne({
        id: uuid(), supplier_id: params.id, supplier_name: supplier.name, items, total, paid: 0, remaining: total,
        due_date: g.due_date, date, notes: `Import CSV - ${items.length} item`, source: 'csv_import', created_at: nowIso(),
      });
    }
    await logAudit(user, 'import_csv', 'purchases', params.id, { supplier: supplier.name, dates: Object.keys(grouped).length, items: count });
    return { message: `Berhasil import ${count} item dari ${Object.keys(grouped).length} tanggal pembelian` };
  });
  route('GET', '/supplier-debts/:id/purchases', async ({ user, params, query }) => {
    requirePanel(user);
    const f = { supplier_id: params.id };
    if (String(query.show_all) !== 'true') f.remaining = { $gt: 0 };
    return db.purchases.find(f).sort('date', -1).toArray();
  });
  route('POST', '/supplier-debts/:id/pay', async ({ user, params, query }) => {
    requirePanel(user);
    const amount = num(query.amount);
    const supplier = await db.suppliers.findOne({ id: params.id });
    if (!supplier) notFound('Supplier not found');
    if (!(await db.purchases.countDocuments({ supplier_id: params.id, remaining: { $gt: 0 } }))) badRequest('Tidak ada hutang untuk supplier ini');
    const paidPurchases = await payFifo(params.id, amount);
    const doc = {
      id: uuid(), type: 'supplier', reference_id: params.id, supplier_id: params.id, supplier_name: supplier.name, amount,
      notes: query.notes || `Pembayaran hutang ke ${supplier.name}`, paid_purchases: paidPurchases, created_at: nowIso(), date: witaDate(),
    };
    await db.payment_history.insertOne(doc);
    const all = await db.purchases.find({ supplier_id: params.id }, { remaining: 1 }).toArray();
    return { message: 'Pembayaran berhasil dicatat', amount_paid: amount, new_total_debt: sum(all, p => Math.max(0, num(p.remaining))), paid_purchases: paidPurchases, payment_id: doc.id };
  });
  route('POST', '/supplier-debts/:id/import-payments-csv', async ({ user, params, body }) => {
    requirePanel(user);
    const rows = body.rows || [];
    if (!rows.length) badRequest('Data import kosong');
    const supplier = await db.suppliers.findOne({ id: params.id });
    if (!supplier) notFound('Supplier tidak ditemukan');
    let total = 0; let n = 0;
    for (const r of rows) {
      const amount = num(r.amount);
      if (amount <= 0) continue;
      const date = r.date || witaDate();
      const paidPurchases = await payFifo(params.id, amount);
      await db.payment_history.insertOne({
        id: uuid(), type: 'supplier', reference_id: params.id, supplier_id: params.id, supplier_name: supplier.name, amount,
        notes: r.notes || 'Import CSV', paid_purchases: paidPurchases, created_at: `${date}T00:00:00`, date,
      });
      total += amount; n += 1;
    }
    await logAudit(user, 'import_payments_csv', 'supplier', params.id, { supplier: supplier.name, count: rows.length, total });
    return { message: `Berhasil import ${n} pembayaran senilai Rp ${Math.round(total).toLocaleString('en-US')}` };
  });
  route('PUT', '/supplier-debts/:id/correct', async ({ user, params, body }) => {
    requirePanel(user);
    const newDebt = num(body.new_debt);
    if (newDebt < 0) badRequest('Nilai hutang tidak boleh negatif');
    const supplier = await db.suppliers.findOne({ id: params.id });
    if (!supplier) notFound('Supplier tidak ditemukan');
    const purchases = await db.purchases.find({ supplier_id: params.id }).toArray();
    const oldDebt = sum(purchases, p => Math.max(0, num(p.remaining)));
    const diff = newDebt - oldDebt;
    if (diff === 0) return { message: 'Tidak ada perubahan', old_debt: oldDebt, new_debt: newDebt };
    if (diff < 0) {
      let reduce = -diff;
      const unpaid = purchases.filter(p => num(p.remaining) > 0).sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1));
      for (const p of unpaid) {
        if (reduce <= 0) break;
        const adj = Math.min(reduce, num(p.remaining));
        await db.purchases.updateOne({ id: p.id }, { $set: { paid: num(p.paid) + adj, remaining: Math.max(0, num(p.remaining) - adj) } });
        reduce -= adj;
      }
    } else if (purchases.length) {
      const target = [...purchases].sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1))[0];
      await db.purchases.updateOne({ id: target.id }, { $inc: { remaining: diff, total: diff } });
    } else {
      await db.purchases.insertOne({
        id: uuid(), supplier_id: params.id, supplier_name: supplier.name, date: witaDate(),
        items: [{ product_name: 'Koreksi Manual', quantity: 1, price: diff, subtotal: diff }],
        total: diff, paid: 0, remaining: diff, notes: body.notes || 'Koreksi manual hutang supplier', created_at: witaIso(), source: 'correction',
      });
    }
    await logAudit(user, 'KOREKSI_HUTANG_SUPPLIER', 'supplier', params.id, { supplier_name: supplier.name, old_debt: oldDebt, new_debt: newDebt, difference: diff, notes: body.notes || '' });
    return { message: 'Hutang supplier berhasil dikoreksi', old_debt: oldDebt, new_debt: newDebt };
  });
}
