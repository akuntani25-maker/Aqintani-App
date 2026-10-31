// Pengganti backend/routers/partner_routes.py
import {
  db, uuid, nowIso, witaDate, witaIso, businessDate, stamp, num, sum, notFound, badRequest,
  requirePanel, incStock, getStock, logAudit,
} from '../core';

const CANCELLED = ['cancelled', 'canceled'];

async function addDebt(storeId, delta, floorZero = false) {
  if (!delta) return;
  if (!floorZero) { await db.partner_stores.updateOne({ id: storeId }, { $inc: { current_debt: delta } }); return; }
  const s = await db.partner_stores.findOne({ id: storeId });
  if (s) await db.partner_stores.updateOne({ id: storeId }, { $set: { current_debt: Math.max(0, num(s.current_debt) + delta) } });
}

export default function register(route) {
  // ---------- kios mitra ----------
  route('GET', '/partner-stores', async () => db.partner_stores.find({}).sort('name', 1).toArray());
  const storeFields = b => ({
    name: b.name, owner_name: b.owner_name || '', phone: b.phone || '', address: b.address || '',
    latitude: b.latitude ?? null, longitude: b.longitude ?? null, credit_limit: num(b.credit_limit), vehicle_id: b.vehicle_id || '',
  });
  route('POST', '/partner-stores', async ({ user, body }) => {
    requirePanel(user);
    const doc = { id: uuid(), ...storeFields(body), current_debt: 0, created_at: nowIso() };
    await db.partner_stores.insertOne(doc);
    return doc;
  });
  route('PUT', '/partner-stores/:id', async ({ user, params, body }) => {
    requirePanel(user);
    const r = await db.partner_stores.findOneAndUpdate({ id: params.id }, { $set: storeFields(body) });
    if (!r) notFound('Partner store not found');
    return r;
  });
  route('DELETE', '/partner-stores/:id', async ({ user, params }) => {
    requirePanel(user);
    const r = await db.partner_stores.deleteOne({ id: params.id });
    if (!r.deletedCount) notFound('Partner store not found');
    return { message: 'Partner store deleted' };
  });
  route('POST', '/partner-stores/:id/pay', async ({ user, params, query }) => {
    requirePanel(user);
    const amount = num(query.amount);
    const s = await db.partner_stores.findOne({ id: params.id });
    if (!s) notFound('Partner store not found');
    const newDebt = num(s.current_debt) - amount;
    await db.partner_stores.updateOne({ id: params.id }, { $set: { current_debt: newDebt } });
    const pay = { id: uuid(), type: 'partner_store', reference_id: params.id, partner_store_name: s.name, amount, notes: query.notes || `Setoran dari ${s.name}`, created_at: witaIso(), date: witaDate() };
    await db.payment_history.insertOne(pay);
    return { message: 'Payment recorded', new_debt: newDebt, payment: pay };
  });
  route('GET', '/partner-stores/:id/payments', async ({ params }) =>
    db.payment_history.find({ type: 'partner_store', reference_id: params.id }).sort('created_at', -1).toArray());
  route('PUT', '/partner-stores/:id/edit-debt', async ({ user, params, body }) => {
    requirePanel(user);
    const s = await db.partner_stores.findOne({ id: params.id });
    if (!s) notFound('Kios mitra tidak ditemukan');
    const type = body.type || 'correction'; const amount = num(body.amount); const old = num(s.current_debt);
    let nd;
    if (type === 'payment') {
      if (amount <= 0) badRequest('Jumlah pembayaran harus lebih dari 0');
      nd = old - amount;
      await db.payment_history.insertOne({ id: uuid(), type: 'partner_store', reference_id: params.id, partner_store_name: s.name, amount, notes: body.notes || `Pembayaran piutang ${s.name}`, created_at: witaIso(), date: witaDate() });
    } else if (type === 'correction') {
      if (amount < 0) badRequest('Nilai piutang tidak boleh negatif');
      nd = amount;
    } else badRequest('Tipe edit tidak valid');
    await db.partner_stores.updateOne({ id: params.id }, { $set: { current_debt: nd } });
    await logAudit(user, 'EDIT_PIUTANG_MITRA', 'partner_store', params.id, { store_name: s.name, type, old_debt: old, new_debt: nd, amount, notes: body.notes || '' });
    return { message: 'Piutang berhasil diperbarui', old_debt: old, new_debt: nd };
  });

  route('GET', '/partner-stores/:id/order-items', async ({ user, params, query }) => {
    requirePanel(user);
    const f = { partner_store_id: params.id, status: { $nin: CANCELLED } };
    if (query.date_from || query.date_to) f.created_at = { ...(query.date_from ? { $gte: query.date_from } : {}), ...(query.date_to ? { $lte: `${query.date_to}T23:59:59` } : {}) };
    const orders = await db.partner_orders.find(f).sort('created_at', -1).toArray();
    const pays = await db.payment_history.find({ type: 'partner_store', reference_id: params.id }, { date: 1, created_at: 1, amount: 1 }).toArray();
    const payByDate = {};
    pays.forEach(p => { const d = p.date || (p.created_at || '').slice(0, 10); payByDate[d] = (payByDate[d] || 0) + num(p.amount); });
    const pids = new Set(), wids = new Set();
    orders.forEach(o => (o.items || []).forEach(i => { if (i.product_id) pids.add(i.product_id); if (i.warehouse_id) wids.add(i.warehouse_id); }));
    const pm = Object.fromEntries((pids.size ? await db.products.find({ id: { $in: [...pids] } }, { id: 1, items_per_box: 1 }).toArray() : []).map(p => [p.id, p]));
    const wm = Object.fromEntries((wids.size ? await db.warehouses.find({ id: { $in: [...wids] } }, { id: 1, unit: 1 }).toArray() : []).map(w => [w.id, w]));
    const search = (query.search || '').toLowerCase();
    const out = [];
    for (const o of orders) {
      const date = (o.created_at || '').slice(0, 10);
      for (const it of o.items || []) {
        const name = it.product_name || '';
        if (search && !name.toLowerCase().includes(search)) continue;
        const ipb = num(pm[it.product_id]?.items_per_box, 1) || 1; const qty = num(it.quantity);
        const unit = it.warehouse_id ? (it.warehouse_id !== 'gudang_toko' ? (wm[it.warehouse_id]?.unit || 'dus') : 'satuan') : (it.unit || it.sell_unit || 'satuan');
        out.push({
          order_id: o.id, order_number: o.order_number || '', date, product_name: name, qty, unit,
          qty_dus: unit === 'dus' ? qty : 0, qty_satuan: unit !== 'dus' ? qty : Math.trunc(qty * ipb), items_per_box: ipb,
          price: it.price || 0, subtotal: it.subtotal ?? qty * num(it.price), setoran: payByDate[date] || 0, payment_type: o.payment_type || 'bon',
        });
      }
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  });

  route('POST', '/partner-stores/:id/import-orders-csv', async ({ user, params, body }) => {
    requirePanel(user);
    const rows = body.rows || [];
    if (!rows.length) badRequest('Data import kosong');
    const store = await db.partner_stores.findOne({ id: params.id });
    if (!store) notFound('Kios mitra tidak ditemukan');
    const grouped = {};
    rows.forEach(r => { const d = r.date || witaDate(); (grouped[d] = grouped[d] || []).push(r); });
    let count = 0;
    for (const [date, list] of Object.entries(grouped)) {
      const items = list.map(r => { count += 1; const q = Math.trunc(num(r.qty)); const pr = num(r.price); return { product_name: r.product_name || '', product_id: '', quantity: q, unit: (r.unit || 'satuan').toLowerCase(), price: pr, subtotal: pr * q }; });
      const total = sum(items, i => i.subtotal);
      await db.partner_orders.insertOne({
        id: uuid(), order_number: `IMP-${date.replace(/-/g, '')}${String(list.length).padStart(2, '0')}`, partner_store_id: params.id, partner_store_name: store.name,
        canvasser_id: '', canvasser_name: 'Import CSV', items, total, subtotal: total, discount: 0, paid: 0, remaining: total, status: 'delivered',
        order_type: 'reguler', notes: `Import CSV - ${items.length} item`, is_settled: false, date, delivery_date: date, warehouse_id: '',
        created_at: `${date}T00:00:00`, updated_at: nowIso(),
      });
    }
    await addDebt(params.id, sum(rows, r => num(r.price) * Math.trunc(num(r.qty))));
    await logAudit(user, 'import_csv', 'partner_orders', params.id, { store: store.name, dates: Object.keys(grouped).length, items: count });
    return { message: `Berhasil import ${count} item dari ${Object.keys(grouped).length} tanggal` };
  });
  route('POST', '/partner-stores/:id/import-payments-csv', async ({ user, params, body }) => {
    requirePanel(user);
    const rows = body.rows || [];
    if (!rows.length) badRequest('Data import kosong');
    const store = await db.partner_stores.findOne({ id: params.id });
    if (!store) notFound('Kios mitra tidak ditemukan');
    let total = 0, n = 0;
    for (const r of rows) {
      const amount = num(r.amount); if (amount <= 0) continue;
      const date = r.date || witaDate();
      await db.payment_history.insertOne({ id: uuid(), type: 'partner_store', reference_id: params.id, partner_store_name: store.name, amount, notes: r.notes || 'Import CSV', created_at: `${date}T00:00:00`, date });
      total += amount; n += 1;
    }
    if (total > 0) await addDebt(params.id, -total);
    await logAudit(user, 'import_payments_csv', 'partner_store', params.id, { store: store.name, count: rows.length, total });
    return { message: `Berhasil import ${n} pembayaran senilai Rp ${Math.round(total).toLocaleString('en-US')}` };
  });

  // ---------- pesanan kios ----------
  route('GET', '/partner-orders', async ({ query }) =>
    db.partner_orders.find(query.partner_store_id ? { partner_store_id: query.partner_store_id } : {}).sort('created_at', -1).toArray());

  route('GET', '/partner-orders/:id', async ({ params }) => {
    const o = await db.partner_orders.findOne({ id: params.id });
    if (!o) notFound('Order not found');
    const ps = await db.partner_stores.findOne({ id: o.partner_store_id });
    o.partner_debt_total = ps?.current_debt || 0; o.partner_phone = ps?.phone || ''; o.partner_address = ps?.address || '';
    const pids = (o.items || []).map(i => i.product_id).filter(Boolean);
    if (pids.length) {
      const pm = Object.fromEntries((await db.products.find({ id: { $in: pids } }, { id: 1, items_per_box: 1 }).toArray()).map(p => [p.id, p]));
      const wids = [...new Set((o.items || []).map(i => i.warehouse_id).filter(Boolean))];
      const wm = Object.fromEntries((wids.length ? await db.warehouses.find({ id: { $in: wids } }, { id: 1, unit: 1 }).toArray() : []).map(w => [w.id, w]));
      for (const it of o.items) {
        it.items_per_box = num(pm[it.product_id]?.items_per_box, 1) || 1;
        if (it.warehouse_id) it.sell_unit = it.warehouse_id === 'gudang_toko' ? 'satuan' : 'dus';
        else if (!it.sell_unit) it.sell_unit = 'satuan';
        if (!it.unit) it.unit = wm[it.warehouse_id]?.unit === 'dus' ? 'dus' : 'pcs';
      }
    }
    return o;
  });

  route('POST', '/partner-orders', async ({ body }) => {
    const store = await db.partner_stores.findOne({ id: body.partner_store_id });
    if (!store) notFound('Partner store not found');
    let canvName = '';
    if (body.canvasser_id) canvName = (await db.canvassers.findOne({ id: body.canvasser_id }))?.name || '';
    const defWh = body.warehouse_id || 'gudang_utama';
    const whs = Object.fromEntries((await db.warehouses.find({}).toArray()).map(w => [w.id, w]));
    // cek stok semua item dulu
    for (const it of body.items || []) {
      const wid = it.warehouse_id || defWh;
      if (!whs[wid]) continue;
      if (await getStock(it.product_id, wid) < num(it.quantity)) badRequest(`Stok ${whs[wid].name || wid} tidak cukup untuk ${it.product_name}`);
    }
    const items = [];
    for (const it of body.items || []) {
      const wid = it.warehouse_id || defWh;
      if (whs[wid]) await incStock(it.product_id, wid, -num(it.quantity));
      items.push({ sell_unit: '', ...it, warehouse_id: wid, unit: whs[wid]?.unit === 'dus' ? 'dus' : 'pcs' });
    }
    const isBarter = (body.order_type || 'regular') === 'barter';
    const barter = []; let barterTotal = 0;
    if (isBarter) {
      for (const b of body.barter_received_items || []) {
        const q = Math.trunc(num(b.quantity)); const wid = b.warehouse_id || 'gudang_toko';
        if (q <= 0 || !b.product_name) continue;
        const unit = whs[wid]?.unit === 'dus' ? 'dus' : 'pcs';
        if (b.product_id) await incStock(b.product_id, wid, q);
        const p = b.product_id ? await db.products.findOne({ id: b.product_id }, { items_per_box: 1 }) : null;
        const subtotal = num(b.price) * q * (unit === 'dus' ? (num(p?.items_per_box, 1) || 1) : 1);
        barter.push({ product_id: b.product_id || '', product_name: b.product_name, quantity: q, price: num(b.price), subtotal, warehouse_id: wid, unit });
        barterTotal += subtotal;
      }
    }
    const total = isBarter ? num(body.total) - barterTotal : num(body.total);
    const now = new Date();
    const doc = {
      id: uuid(), order_number: `PO${stamp(now)}`, partner_store_id: body.partner_store_id, partner_store_name: store.name, items,
      subtotal: num(body.subtotal), discount: num(body.discount), total, paid: num(body.paid), remaining: total - num(body.paid),
      delivery_date: body.delivery_date || witaDate(now), canvasser_id: body.canvasser_id || '', canvasser_name: canvName,
      warehouse_id: defWh, status: 'pending', order_type: body.order_type || 'regular', is_settled: false,
      created_at: witaIso(now), date: witaDate(now),
    };
    if (isBarter) { doc.barter_received_items = barter; doc.barter_received_total = barterTotal; }
    await db.partner_orders.insertOne(doc);
    await db.partner_stores.updateOne({ id: body.partner_store_id }, { $inc: { current_debt: doc.remaining } });
    return doc;
  });

  route('PUT', '/partner-orders/:id/status', async ({ user, params, query }) => {
    const status = query.status;
    const o = await db.partner_orders.findOne({ id: params.id });
    if (!o) notFound('Order not found');
    if (CANCELLED.includes(status) && !CANCELLED.includes(o.status || 'pending')) {
      for (const it of o.items || []) {
        if (it.source === 'external' || !it.product_id) continue;
        await incStock(it.product_id, it.warehouse_id || o.warehouse_id || 'gudang_utama', num(it.quantity));
      }
      const rem = num(o.remaining);
      if (rem > 0) await addDebt(o.partner_store_id, -rem, true);
      await logAudit(user, 'CANCEL_ORDER_RETUR', 'partner_order', params.id, {
        order_number: o.order_number, partner_store_name: o.partner_store_name,
        items_returned: (o.items || []).map(i => ({ product_name: i.product_name, quantity: i.quantity, warehouse_id: i.warehouse_id || o.warehouse_id || 'gudang_utama' })),
        debt_reduced: rem,
      });
    }
    return db.partner_orders.findOneAndUpdate({ id: params.id }, { $set: { status } });
  });

  route('POST', '/partner-orders/:id/add-items', async ({ user, params, body }) => {
    const newItems = body.items || [];
    if (!newItems.length) badRequest('Tidak ada item untuk ditambahkan');
    const o = await db.partner_orders.findOne({ id: params.id });
    if (!o) notFound('Pesanan tidak ditemukan');
    if (CANCELLED.includes(o.status)) badRequest('Tidak bisa menambah item ke pesanan yang dibatalkan');
    for (const ni of newItems) {
      const src = ni.source || 'gudang_toko';
      if (['gudang_utama', 'gudang_toko'].includes(src)) {
        const have = await getStock(ni.product_id, src);
        if (have < Math.trunc(num(ni.quantity))) badRequest(`Stok tidak cukup untuk ${ni.product_name} di ${src} (tersedia: ${have})`);
      }
    }
    const added = []; let addTotal = 0; let extCost = 0;
    for (const ni of newItems) {
      const src = ni.source || 'gudang_toko'; const q = Math.trunc(num(ni.quantity)); const price = num(ni.price);
      const wid = ni.warehouse_id || (src !== 'external' ? src : '');
      if (['gudang_utama', 'gudang_toko'].includes(src)) await incStock(ni.product_id, src, -q);
      const wh = wid ? await db.warehouses.findOne({ id: wid }) : null;
      const unit = wh?.unit || 'satuan';
      const p = await db.products.findOne({ id: ni.product_id }, { items_per_box: 1 });
      const subtotal = unit === 'dus' ? price * q * (num(p?.items_per_box, 1) || 1) : price * q;
      const doc = { product_id: ni.product_id, product_name: ni.product_name, quantity: q, price, subtotal, warehouse_id: wid, unit: unit === 'dus' ? 'dus' : 'pcs', is_addition: true, source: src, added_at: witaIso() };
      if (src === 'external') { doc.external_cost = num(ni.external_cost); extCost += num(ni.external_cost) * q; }
      added.push(doc); addTotal += subtotal;
    }
    await db.partner_orders.updateOne({ id: params.id }, { $set: {
      items: [...(o.items || []), ...added], total: num(o.total) + addTotal, remaining: num(o.remaining) + addTotal, subtotal: num(o.subtotal ?? o.total) + addTotal,
    } });
    await addDebt(o.partner_store_id, addTotal);
    if (extCost > 0) {
      await db.canvasser_expenses.insertOne({
        id: uuid(), type: 'external_purchase', order_id: params.id, order_number: o.order_number, canvasser_id: o.canvasser_id || '', canvasser_name: o.canvasser_name || '',
        partner_store_name: o.partner_store_name || '', items: added.filter(i => i.source === 'external'), total_cost: extCost, created_at: witaIso(), date: businessDate(),
      });
    }
    await logAudit(user, 'TAMBAH_ITEM_PESANAN', 'partner_order', params.id, {
      order_number: o.order_number, partner_store_name: o.partner_store_name,
      added_items: added.map(i => ({ name: i.product_name, qty: i.quantity, source: i.source })), total_addition: addTotal, external_cost: extCost,
    });
    return db.partner_orders.findOne({ id: params.id });
  });

  route('DELETE', '/partner-orders/:id', async ({ user, params }) => {
    requirePanel(user);
    const o = await db.partner_orders.findOne({ id: params.id });
    if (!o) notFound('Order not found');
    if (num(o.remaining) > 0) await addDebt(o.partner_store_id, -num(o.remaining), true);
    await db.partner_orders.deleteOne({ id: params.id });
    await db.returns.deleteMany({ source_id: params.id });
    return { message: 'Pesanan berhasil dihapus' };
  });

  route('POST', '/partner-orders/:id/pay', async ({ params, query }) => {
    const amount = num(query.amount);
    const o = await db.partner_orders.findOne({ id: params.id });
    if (!o) notFound('Order not found');
    const newPaid = num(o.paid) + amount;
    const r = await db.partner_orders.findOneAndUpdate({ id: params.id }, { $set: { paid: newPaid, remaining: num(o.total) - newPaid } });
    await addDebt(o.partner_store_id, -amount, true);
    return r;
  });

  // ---------- harga khusus kios ----------
  route('GET', '/partner-prices', async ({ query }) => db.partner_prices.find(query.partner_store_id ? { partner_store_id: query.partner_store_id } : {}).toArray());
  route('PUT', '/partner-prices', async ({ user, query }) => {
    requirePanel(user);
    await db.partner_prices.updateOne({ partner_store_id: query.partner_store_id, product_id: query.product_id }, { $set: { custom_price: num(query.custom_price), updated_at: nowIso() } }, { upsert: true });
    return { message: 'Harga mitra diperbarui' };
  });
  route('DELETE', '/partner-prices', async ({ user, query }) => {
    requirePanel(user);
    await db.partner_prices.deleteOne({ partner_store_id: query.partner_store_id, product_id: query.product_id });
    return { message: 'Harga mitra dihapus' };
  });

  // ---------- settlement: kanvaser melaporkan yang laku, sisa kembali ----------
  route('POST', '/partner-orders/:id/settle', async ({ params, body }) => {
    const o = await db.partner_orders.findOne({ id: params.id });
    if (!o) notFound('Pesanan tidak ditemukan');
    if (o.is_settled) badRequest('Pesanan sudah diselesaikan');
    const canv = o.canvasser_id ? await db.canvassers.findOne({ id: o.canvasser_id }) : null;
    const vehicleId = canv?.vehicle_id || '';
    const vehicle = vehicleId ? await db.vehicles.findOne({ id: vehicleId }) : null;
    const toWarehouse = (body.return_to || 'vehicle') === 'warehouse';
    const returnItems = []; let newTotal = 0;
    const settled = [];
    for (const si of body.items || []) {
      const s = { product_id: si.product_id, product_name: si.product_name, qty_sold: Math.trunc(num(si.qty_sold)), original_qty: Math.trunc(num(si.original_qty)), price: num(si.price) };
      settled.push(s);
      const p = await db.products.findOne({ id: s.product_id }, { items_per_box: 1 });
      const ipb = num(p?.items_per_box, 1) || 1;
      const oi = (o.items || []).find(x => x.product_id === s.product_id);
      const whId = oi?.warehouse_id || o.warehouse_id || 'gudang_toko';
      const unit = (await db.warehouses.findOne({ id: whId }))?.unit || 'satuan';
      const origSat = unit === 'dus' ? s.original_qty * ipb : s.original_qty;
      const remaining = origSat - s.qty_sold;
      newTotal += s.qty_sold * s.price;
      if (remaining <= 0) continue;
      if (!toWarehouse && vehicleId && vehicle) {
        const ex = await db.vehicle_stock.findOne({ vehicle_id: vehicleId, product_id: s.product_id, remaining_qty: { $gt: 0 } });
        if (ex) await db.vehicle_stock.updateOne({ id: ex.id }, { $inc: { remaining_qty: remaining, quantity: remaining } });
        else await db.vehicle_stock.insertOne({
          id: uuid(), vehicle_id: vehicleId, vehicle_name: vehicle.name || '', product_id: s.product_id, product_name: s.product_name,
          quantity: remaining, remaining_qty: remaining, sold_qty: 0, returned_qty: 0, price: s.price, warehouse_id: whId,
          loaded_at: nowIso(), notes: `Retur dari pesanan ${o.order_number || ''}`, status: 'active',
        });
        returnItems.push({ product_id: s.product_id, product_name: s.product_name, quantity: remaining, unit: 'satuan', warehouse_id: `vehicle:${vehicleId}`, vehicle_name: vehicle.name || '' });
      } else if (unit === 'dus') {
        const boxes = Math.floor(remaining / ipb); const pcs = remaining - boxes * ipb;
        if (boxes > 0) { await incStock(s.product_id, 'gudang_utama', boxes); returnItems.push({ product_id: s.product_id, product_name: s.product_name, quantity: boxes, unit: 'dus', warehouse_id: 'gudang_utama' }); }
        if (pcs > 0) { await incStock(s.product_id, 'gudang_toko', pcs); returnItems.push({ product_id: s.product_id, product_name: s.product_name, quantity: pcs, unit: 'satuan', warehouse_id: 'gudang_toko' }); }
      } else {
        await incStock(s.product_id, whId, remaining);
        returnItems.push({ product_id: s.product_id, product_name: s.product_name, quantity: remaining, unit: 'satuan', warehouse_id: whId });
      }
    }
    const oldTotal = num(o.total); const diff = oldTotal - newTotal;
    await db.partner_orders.updateOne({ id: params.id }, { $set: {
      is_settled: true, settled_at: nowIso(), settled_items: settled, original_total: oldTotal, total: newTotal, subtotal: newTotal,
      remaining: Math.max(0, newTotal - num(o.paid)), return_items: returnItems,
    } });
    if (diff > 0) await addDebt(o.partner_store_id, -diff);
    return { message: 'Pesanan berhasil diselesaikan', new_total: newTotal, return_items: returnItems, debt_reduced: diff };
  });

  // ---------- oper pesanan ke kios lain ----------
  route('POST', '/partner-orders/:id/transfer', async ({ user, params, body }) => {
    const newStoreId = body.new_partner_store_id; const items = body.items || []; const payType = body.payment_type || 'bon';
    if (!newStoreId || !items.length) badRequest('Data oper pesanan tidak lengkap');
    const o = await db.partner_orders.findOne({ id: params.id });
    if (!o) notFound('Pesanan tidak ditemukan');
    const ns = await db.partner_stores.findOne({ id: newStoreId });
    if (!ns) notFound('Kios mitra tujuan tidak ditemukan');
    let remainingItems = [...(o.items || [])]; const newItems = []; let total = 0; let oldReduce = 0;
    for (const ti of items) {
      const q = Math.trunc(num(ti.quantity)); const np = num(ti.new_price);
      const i = remainingItems.findIndex(x => x.product_id === ti.product_id);
      if (i < 0) continue;
      const oi = remainingItems[i];
      if (q > num(oi.quantity)) badRequest(`Qty oper melebihi qty pesanan untuk ${oi.product_name}`);
      oldReduce += q * num(oi.price);
      remainingItems[i] = { ...oi, quantity: num(oi.quantity) - q, subtotal: (num(oi.quantity) - q) * num(oi.price) };
      newItems.push({ product_id: ti.product_id, product_name: oi.product_name, quantity: q, price: np, subtotal: q * np, warehouse_id: oi.warehouse_id || o.warehouse_id || 'gudang_toko' });
      total += q * np;
    }
    remainingItems = remainingItems.filter(x => num(x.quantity) > 0);
    const oldNew = sum(remainingItems, x => x.subtotal);
    await db.partner_orders.updateOne({ id: params.id }, { $set: { items: remainingItems, subtotal: oldNew, total: oldNew, remaining: Math.max(0, oldNew - num(o.paid)) } });
    if (oldReduce > 0 && num(o.remaining) > 0) await addDebt(o.partner_store_id, -Math.min(oldReduce, num(o.remaining)));
    const existing = await db.partner_orders.findOne({ partner_store_id: newStoreId, status: { $nin: CANCELLED }, is_settled: { $ne: true } });
    let targetId;
    if (existing) {
      const upd = [...(existing.items || [])];
      for (const ni of newItems) {
        const j = upd.findIndex(x => x.product_id === ni.product_id);
        if (j >= 0) { const q = num(upd[j].quantity) + ni.quantity; upd[j] = { ...upd[j], quantity: q, price: ni.price, subtotal: q * ni.price }; } else upd.push(ni);
      }
      const t = sum(upd, x => x.subtotal);
      await db.partner_orders.updateOne({ id: existing.id }, { $set: { items: upd, subtotal: t, total: t, remaining: t - num(existing.paid) } });
      targetId = existing.id;
    } else {
      const now = new Date();
      const doc = {
        id: uuid(), order_number: `TR-${stamp(now)}`, partner_store_id: newStoreId, partner_store_name: ns.name, canvasser_id: o.canvasser_id || '',
        canvasser_name: o.canvasser_name || '', delivery_date: witaDate(now), date: witaDate(now), items: newItems, subtotal: total, discount: 0, total,
        paid: payType === 'cash' ? total : 0, remaining: payType === 'cash' ? 0 : total, status: 'delivered', order_type: 'transfer', source_order_id: params.id,
        warehouse_id: o.warehouse_id || 'gudang_toko', is_settled: false, return_items: [], created_at: witaIso(now),
      };
      await db.partner_orders.insertOne(doc);
      targetId = doc.id;
    }
    if (payType === 'bon') await addDebt(newStoreId, total);
    await logAudit(user, 'TRANSFER_ORDER', 'partner_orders', params.id, {
      from_store: o.partner_store_name || '', to_store: ns.name, items: newItems.map(n => ({ name: n.product_name, qty: n.quantity, price: n.price })),
      payment_type: payType, total, merged_to_existing: !!existing,
    });
    return { message: `Pesanan berhasil dioper ke ${ns.name}` + (existing ? ' (ditambahkan ke pesanan yang ada)' : ''), target_order_id: targetId, total_transferred: total, old_order_new_total: oldNew };
  });
}
