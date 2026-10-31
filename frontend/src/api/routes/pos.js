// Pengganti transaction_routes.py, shift_routes.py, warehouse_routes.py
import {
  db, uuid, nowIso, witaDate, witaIso, witaParts, businessDate, stamp, num, sum, round, notFound, badRequest, HttpError,
  requirePanel, requirePos, incStock, getStock, logAudit, productMap, posCost, unitCost,
} from '../core';

const fmtNote = () => { const p = witaParts(); const z = n => String(n).padStart(2, '0'); return `${z(p.d)}/${z(p.m)}/${p.y} ${z(p.H)}:${z(p.M)}`; };

export default function register(route) {
  route('GET', '/pos/business-date', async () => ({ date: businessDate(), wita_today: witaDate() }));

  route('GET', '/pos/daily-summary', async () => {
    const today = businessDate();
    const txns = await db.transactions.find({ date: today, status: { $ne: 'returned' } }).toArray();
    const totalSales = sum(txns, t => t.total);
    const pmap = await productMap(new Set(txns.flatMap(t => (t.items || []).map(i => i.product_id))));
    const totalCost = Math.round(sum(txns, t => posCost(t, pmap)));
    return { count: txns.length, total_sales: totalSales, total_cost: totalCost, total_margin: totalSales - totalCost };
  });

  route('GET', '/pos/daily-transactions', async ({ query }) => {
    const date = query.date || businessDate();
    const txns = await db.transactions.find({ date }).sort('created_at', 1).toArray();
    const farmer = await db.farmer_transactions.find({ date }).sort('created_at', 1).toArray();
    const ts = sum(txns, t => t.total), tf = sum(farmer, t => t.total);
    return { date, transactions: txns, farmer_transactions: farmer, total_sales: ts, total_farmer_sales: tf, grand_total: ts + tf, count: txns.length, farmer_count: farmer.length };
  });

  route('POST', '/transactions', async ({ user, body: data }) => {
    const items = data.items || [];
    const costs = {};
    // cek semua stok dulu, baru potong (supaya tidak setengah jalan bila ada yang kurang)
    for (const it of items) {
      const p = await db.products.findOne({ id: it.product_id });
      if (!p) notFound(`Product ${it.product_name} not found`);
      costs[it.product_id] = unitCost(p);
      const have = await getStock(it.product_id, 'gudang_toko');
      if (have < num(it.quantity)) badRequest(`Stok Gudang Toko tidak cukup untuk ${it.product_name} (tersedia: ${have} satuan)`);
    }
    for (const it of items) await incStock(it.product_id, 'gudang_toko', -num(it.quantity));
    const now = new Date();
    const doc = {
      id: uuid(), transaction_number: `TRX${stamp(now)}`, cashier_id: user.id, cashier_name: user.name,
      items: items.map(it => ({ warehouse_id: '', sell_unit: '', ...it, cost_price_unit: costs[it.product_id] || 0 })),
      subtotal: num(data.subtotal), tax: num(data.tax), discount: num(data.discount), total: num(data.total),
      payment_method: data.payment_method, payment_amount: num(data.payment_amount), change: num(data.change),
      created_at: witaIso(now), date: businessDate(now),
    };
    await db.transactions.insertOne(doc);
    return doc;
  });

  route('GET', '/transactions/search', async ({ query }) => {
    if (!query.q) return [];
    return db.transactions.find({ $or: [{ transaction_number: { $icontains: query.q } }, { id: query.q }] }).sort('created_at', -1).limit(20).toArray();
  });
  route('GET', '/transactions', async ({ query }) => {
    const f = query.start_date && query.end_date ? { date: { $gte: query.start_date, $lte: query.end_date } } : {};
    return db.transactions.find(f).sort('created_at', -1).limit(1000).toArray();
  });
  route('GET', '/transactions/:id', async ({ params }) => {
    const t = await db.transactions.findOne({ id: params.id });
    if (!t) notFound('Transaction not found');
    return t;
  });

  route('PUT', '/transactions/:id/edit-prices', async ({ user, params, body }) => {
    const txn = await db.transactions.findOne({ id: params.id });
    if (!txn) notFound('Transaksi tidak ditemukan');
    const updated = body.items || [];
    const adjustments = [];
    const newItems = (txn.items || []).map(ex => {
      const m = updated.find(u => u.product_id === ex.product_id);
      if (!m) return ex;
      const price = num(m.price); const qty = Math.trunc(num(m.quantity ?? ex.quantity));
      const diff = num(ex.quantity) - qty;
      if (diff) adjustments.push({ product_id: ex.product_id, diff, name: ex.product_name || '' });
      return { ...ex, price, quantity: qty, subtotal: price * qty };
    });
    for (const a of adjustments) {
      if (a.diff < 0) {
        const have = await getStock(a.product_id, 'gudang_toko');
        if (have < -a.diff) badRequest(`Stok tidak cukup untuk ${a.name} (perlu ${-a.diff}, tersedia ${have})`);
      }
    }
    for (const a of adjustments) await incStock(a.product_id, 'gudang_toko', a.diff);
    const sub = sum(newItems, i => i.subtotal);
    const notes = [...(txn.edit_notes || []), `[EDIT ${fmtNote()} oleh ${user?.name || ''}]`];
    await db.transactions.updateOne({ id: params.id }, { $set: { items: newItems, subtotal: sub, total: sub - num(txn.discount) + num(txn.tax), edit_notes: notes } });
    return db.transactions.findOne({ id: params.id });
  });

  // ---------- retur (pesanan kios / transaksi) ----------
  route('POST', '/returns', async ({ user, body: data }) => {
    requirePos(user);
    const vehicleId = data.vehicle_id || null;
    const warehouseId = data.warehouse_id || 'gudang_toko';
    const doc = {
      id: uuid(), return_number: `RTN${stamp()}`, source_type: data.source_type, source_id: data.source_id, items: data.items || [],
      notes: data.notes || '', warehouse_id: vehicleId ? `vehicle:${vehicleId}` : warehouseId, vehicle_id: vehicleId || '',
      created_at: nowIso(), date: witaDate(),
    };
    await db.returns.insertOne(doc);
    if (vehicleId) {
      const vehicle = await db.vehicles.findOne({ id: vehicleId });
      for (const it of doc.items) {
        const ex = await db.vehicle_stock.findOne({ vehicle_id: vehicleId, product_id: it.product_id, remaining_qty: { $gt: 0 } });
        if (ex) await db.vehicle_stock.updateOne({ id: ex.id }, { $inc: { remaining_qty: num(it.quantity), quantity: num(it.quantity) } });
        else await db.vehicle_stock.insertOne({
          id: uuid(), vehicle_id: vehicleId, vehicle_name: vehicle?.name || '', product_id: it.product_id, product_name: it.product_name,
          quantity: num(it.quantity), remaining_qty: num(it.quantity), sold_qty: 0, returned_qty: 0, price: num(it.price),
          warehouse_id: warehouseId, loaded_at: nowIso(), notes: `Retur dari pesanan ${data.source_id}`, status: 'active',
        });
      }
    } else {
      for (const it of doc.items) await incStock(it.product_id, warehouseId, num(it.quantity));
    }
    if (data.source_type === 'transaction') {
      await db.transactions.updateOne({ id: data.source_id }, { $set: { has_return: true } });
    } else if (data.source_type === 'partner_order') {
      const order = await db.partner_orders.findOne({ id: data.source_id });
      if (order) {
        const whs = Object.fromEntries((await db.warehouses.find({}).toArray()).map(w => [w.id, w]));
        const items = order.items || []; const settled = order.settled_items || [];
        let retTotal = 0;
        for (const r of doc.items) {
          const rq = Math.trunc(num(r.quantity));
          if (rq <= 0) continue;
          const target = items.find(oi => oi.product_id === r.product_id && num(oi.quantity) > 0);
          if (!target) continue;
          const q = Math.min(rq, num(target.quantity));
          const unit = whs[target.warehouse_id || order.warehouse_id || '']?.unit || 'satuan';
          const p = await db.products.findOne({ id: r.product_id }, { items_per_box: 1 });
          const mult = unit === 'dus' ? (num(p?.items_per_box, 1) || 1) : 1;
          const price = num(target.price);
          target.quantity = num(target.quantity) - q;
          target.subtotal = price * target.quantity * mult;
          retTotal += price * q * mult;
          if (order.is_settled && settled.length) {
            const st = settled.find(si => si.product_id === r.product_id && num(si.qty_sold) > 0);
            if (st) st.qty_sold = Math.max(0, num(st.qty_sold) - q);
          }
        }
        const upd = {
          has_return: true, items, total: Math.max(0, num(order.total) - retTotal),
          subtotal: Math.max(0, num(order.subtotal ?? order.total) - retTotal), remaining: Math.max(0, num(order.remaining) - retTotal),
        };
        if (order.is_settled && settled.length) upd.settled_items = settled;
        await db.partner_orders.updateOne({ id: data.source_id }, { $set: upd });
        const ps = await db.partner_stores.findOne({ id: order.partner_store_id });
        if (ps) await db.partner_stores.updateOne({ id: order.partner_store_id }, { $set: { current_debt: Math.max(0, num(ps.current_debt) - retTotal) } });
      }
    }
    return doc;
  });
  route('GET', '/returns', async ({ user, query }) => {
    requirePanel(user);
    return db.returns.find(query.source_id ? { source_id: query.source_id } : {}).sort('created_at', -1).toArray();
  });

  route('POST', '/pos/return-exchange', async ({ user, body }) => {
    const txn = await db.transactions.findOne({ id: body.transaction_id });
    if (!txn) notFound('Transaksi tidak ditemukan');
    const created = Date.parse(txn.created_at || '') || Date.now();
    const days = Math.floor((Date.now() - created) / 86400000);
    if (days > 2) badRequest(`Retur/tukar hanya berlaku 2 hari setelah pembelian (transaksi sudah ${days} hari)`);
    const label = (body.action_type || 'return') === 'return' ? 'RETUR' : 'TUKAR';
    const retDetails = []; const exDetails = [];
    for (const ri of body.return_items || []) {
      const qty = Math.trunc(num(ri.quantity));
      if (qty <= 0) continue;
      const orig = (txn.items || []).find(i => i.product_id === ri.product_id);
      if (!orig) badRequest('Barang tidak ditemukan dalam transaksi');
      if (qty > num(orig.quantity)) badRequest(`Jumlah retur (${qty}) melebihi jumlah beli (${orig.quantity}) untuk ${orig.product_name}`);
      retDetails.push({ product_id: ri.product_id, product_name: orig.product_name, quantity: qty, price: orig.price, return_value: num(orig.price) * qty });
    }
    for (const ei of body.exchange_items || []) {
      const qty = Math.trunc(num(ei.quantity));
      if (qty <= 0) continue;
      const p = await db.products.findOne({ id: ei.product_id });
      if (!p) notFound('Barang pengganti tidak ditemukan');
      const have = await getStock(ei.product_id, 'gudang_toko');
      if (have < qty) badRequest(`Stok tidak cukup untuk ${p.name} (tersedia: ${have})`);
      exDetails.push({ product_id: ei.product_id, product_name: p.name, quantity: qty, price: num(ei.price), exchange_value: num(ei.price) * qty });
    }
    for (const r of retDetails) await incStock(r.product_id, 'gudang_toko', r.quantity);
    for (const e of exDetails) await incStock(e.product_id, 'gudang_toko', -e.quantity);
    const totRet = sum(retDetails, r => r.return_value), totEx = sum(exDetails, e => e.exchange_value);
    let items = [...(txn.items || [])];
    for (const r of retDetails) {
      const i = items.findIndex(it => it.product_id === r.product_id);
      if (i < 0) continue;
      const q = num(items[i].quantity) - r.quantity;
      items[i] = q > 0 ? { ...items[i], quantity: q, subtotal: q * num(items[i].price) } : { ...items[i], quantity: 0, subtotal: 0, product_name: `${items[i].product_name} [${label}]` };
    }
    for (const e of exDetails) {
      const i = items.findIndex(it => it.product_id === e.product_id);
      if (i >= 0) { const q = num(items[i].quantity) + e.quantity; items[i] = { ...items[i], quantity: q, subtotal: q * e.price }; }
      else items.push({ product_id: e.product_id, product_name: `${e.product_name} [${label}]`, quantity: e.quantity, price: e.price, subtotal: e.exchange_value, warehouse_id: '', sell_unit: '' });
    }
    items = items.filter(it => num(it.quantity) > 0 || (it.product_name || '').includes('['));
    const sub = sum(items, i => i.subtotal);
    await db.transactions.updateOne({ id: txn.id }, { $set: {
      items, subtotal: sub, total: sub - num(txn.discount) + num(txn.tax), has_return: true,
      return_notes: [...(txn.return_notes || []), `[${label} ${fmtNote()} oleh ${user?.name || ''}]`],
    } });
    const log = {
      id: uuid(), transaction_id: txn.id, transaction_number: txn.transaction_number || '', action_type: body.action_type || 'return',
      return_items: retDetails, exchange_items: exDetails, total_return_value: totRet, total_exchange_value: totEx,
      price_difference: totEx - totRet, processed_by: user?.name || '', created_at: nowIso(), date: witaDate(),
    };
    await db.pos_returns.insertOne(log);
    return { message: `${label} berhasil diproses`, total_return_value: totRet, total_exchange_value: totEx, price_difference: totEx - totRet, return_log_id: log.id };
  });

  // ---------- shift kasir ----------
  const shiftTotals = async (user, shift) => {
    const txns = await db.transactions.find({ cashier_id: user.id, created_at: { $gte: shift.opened_at } }, { total: 1, payment_method: 1 }).toArray();
    return { txns, total: sum(txns, t => t.total) };
  };
  route('POST', '/shifts/open', async ({ user, query }) => {
    requirePos(user);
    const ex = await db.shifts.findOne({ user_id: user.id, status: 'open' });
    if (ex) return ex;
    const doc = { id: uuid(), user_id: user.id, user_name: user.name, opened_at: witaIso(), closed_at: null, opening_balance: num(query.opening_balance), closing_balance: null, total_sales: 0, total_transactions: 0, status: 'open' };
    await db.shifts.insertOne(doc);
    return doc;
  });
  route('GET', '/shifts/current', async ({ user }) => {
    requirePos(user);
    const shift = await db.shifts.findOne({ user_id: user.id, status: 'open' });
    if (!shift) return null;
    const { txns, total } = await shiftTotals(user, shift);
    return { ...shift, total_sales: total, total_transactions: txns.length };
  });
  route('POST', '/shifts/close', async ({ user, query }) => {
    requirePos(user);
    const shift = await db.shifts.findOne({ user_id: user.id, status: 'open' });
    if (!shift) notFound('Tidak ada shift yang terbuka');
    const { txns, total } = await shiftTotals(user, shift);
    await db.shifts.updateOne({ id: shift.id }, { $set: {
      closed_at: witaIso(), closing_balance: num(query.closing_balance), total_sales: total,
      cash_sales: sum(txns.filter(t => t.payment_method === 'cash'), t => t.total), total_transactions: txns.length, notes: query.notes || '', status: 'closed',
    } });
    return db.shifts.findOne({ id: shift.id });
  });
  route('GET', '/shifts/history', async ({ user, query }) => {
    requirePos(user);
    const f = { status: 'closed' };
    if (query.user_id) f.user_id = query.user_id;
    return db.shifts.find(f).sort('closed_at', -1).limit(num(query.limit, 20) || 20).toArray();
  });

  // ---------- gudang ----------
  route('GET', '/warehouses', async () => db.warehouses.find({}).sort('sort_order', 1).toArray());
  route('GET', '/warehouse-stock', async ({ query }) => {
    const f = {};
    if (query.product_id) f.product_id = query.product_id;
    if (query.warehouse_id) f.warehouse_id = query.warehouse_id;
    return db.warehouse_stock.find(f).toArray();
  });
  route('PUT', '/warehouse-stock', async ({ user, query }) => {
    requirePanel(user);
    await db.warehouse_stock.updateOne({ product_id: query.product_id, warehouse_id: query.warehouse_id }, { $set: { stock: Math.trunc(num(query.stock)) } }, { upsert: true });
    return { message: 'Stock updated' };
  });
  route('POST', '/stock-adjustments', async ({ user, body }) => {
    requirePanel(user);
    const p = await db.products.findOne({ id: body.product_id });
    if (!p) notFound('Produk tidak ditemukan');
    const old = await getStock(body.product_id, body.warehouse_id);
    const ns = Math.trunc(num(body.new_stock)); const diff = ns - old;
    const adj = { id: uuid(), product_id: body.product_id, product_name: p.name || '', warehouse_id: body.warehouse_id, old_stock: old, new_stock: ns, difference: diff, reason: body.reason || '', adjusted_by: user?.name || user?.email || '', date: nowIso() };
    await db.stock_adjustments.insertOne(adj);
    await db.warehouse_stock.updateOne({ product_id: body.product_id, warehouse_id: body.warehouse_id }, { $set: { stock: ns } }, { upsert: true });
    return { message: `Stok disesuaikan: ${old} -> ${ns} (${diff >= 0 ? '+' : ''}${diff})`, adjustment: adj };
  });
  route('GET', '/stock-adjustments', async ({ user, query }) => {
    requirePanel(user);
    return db.stock_adjustments.find(query.product_id ? { product_id: query.product_id } : {}).sort('date', -1).limit(200).toArray();
  });
  route('GET', '/stock-transfers', async ({ user, query }) => {
    requirePos(user);
    return db.stock_transfers.find(query.product_id ? { product_id: query.product_id } : {}).sort('created_at', -1).limit(1000).toArray();
  });
  route('POST', '/stock-transfers', async ({ user, body: d }) => {
    requirePos(user);
    const qty = num(d.quantity);
    if (d.from_warehouse_id === d.to_warehouse_id) badRequest('Gudang asal dan tujuan tidak boleh sama');
    if (qty <= 0) badRequest('Jumlah harus lebih dari 0');
    const p = await db.products.findOne({ id: d.product_id });
    if (!p) notFound('Produk tidak ditemukan');
    const from = await db.warehouses.findOne({ id: d.from_warehouse_id }); const to = await db.warehouses.findOne({ id: d.to_warehouse_id });
    if (!from || !to) notFound('Gudang tidak ditemukan');
    const have = await getStock(d.product_id, d.from_warehouse_id);
    if (have < qty) badRequest(`Stok ${from.name} tidak cukup (${have} ${from.unit})`);
    const ipb = num(p.items_per_box, 1) || 1;
    let converted = qty;
    if (from.unit === 'dus' && to.unit === 'satuan') converted = qty * ipb;
    else if (from.unit === 'satuan' && to.unit === 'dus') {
      if (qty % ipb !== 0) badRequest(`Jumlah satuan (${qty}) harus kelipatan ${ipb} untuk konversi ke dus`);
      converted = qty / ipb;
    }
    await incStock(d.product_id, d.from_warehouse_id, -qty);
    await incStock(d.product_id, d.to_warehouse_id, converted);
    const doc = {
      id: uuid(), product_id: d.product_id, product_name: p.name, from_warehouse_id: from.id, from_warehouse_name: from.name,
      to_warehouse_id: to.id, to_warehouse_name: to.name, quantity: qty, from_unit: from.unit, converted_quantity: converted, to_unit: to.unit,
      notes: d.notes || '', created_at: nowIso(), date: witaDate(),
    };
    await db.stock_transfers.insertOne(doc);
    const n = (d.notes || '').toLowerCase();
    await logAudit(user, 'TRANSFER_STOK', 'stock_transfer', doc.id, {
      product_name: p.name, product_id: p.id, from_warehouse: from.name, to_warehouse: to.name, quantity: qty, from_unit: from.unit,
      converted_quantity: converted, to_unit: to.unit, notes: d.notes || '', source_page: (n.includes('kasir') || n.includes('pos') || n.includes('oleh:')) ? 'POS' : 'Admin',
    });
    return doc;
  });
}

export { HttpError, round };
