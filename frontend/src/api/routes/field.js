// Pengganti canvasser_routes.py, vehicle_stock_routes.py, loan_farmer_routes.py, dan bagian armada di admin_routes.py
import {
  db, uuid, nowIso, witaDate, witaIso, businessDate, stamp, num, sum, notFound, badRequest, HttpError,
  requireAdmin, requireAdminOrManager, requirePanel, requirePos, incStock, getStock, logAudit, unitCost,
} from '../core';

const requireCanvasser = u => { if (u?.role !== 'canvasser') throw new HttpError(403, 'Canvasser access only'); };

export default function register(route) {
  // ---------- kanvaser ----------
  route('GET', '/canvassers', async () => db.canvassers.find({}).sort('name', 1).toArray());
  const canvFields = b => ({ name: b.name, phone: b.phone || '', vehicle_number: b.vehicle_number || '', vehicle_type: b.vehicle_type || 'Mobil Box', ...(b.vehicle_id !== undefined ? { vehicle_id: b.vehicle_id } : {}) });
  route('POST', '/canvassers', async ({ user, body }) => {
    requireAdmin(user);
    const doc = { id: uuid(), ...canvFields(body), is_active: true, created_at: nowIso() };
    await db.canvassers.insertOne(doc);
    return doc;
  });
  route('PUT', '/canvassers/:id', async ({ user, params, body }) => {
    requireAdmin(user);
    const r = await db.canvassers.findOneAndUpdate({ id: params.id }, { $set: canvFields(body) });
    if (!r) notFound('Canvasser not found');
    return r;
  });
  route('DELETE', '/canvassers/:id', async ({ user, params }) => {
    requireAdmin(user);
    const r = await db.canvassers.deleteOne({ id: params.id });
    if (!r.deletedCount) notFound('Canvasser not found');
    return { message: 'Canvasser deleted' };
  });

  route('GET', '/canvassers/my-orders', async ({ user }) => {
    requireCanvasser(user);
    if (!user.canvasser_id) badRequest('Canvasser ID not found');
    const orders = await db.partner_orders.find({ canvasser_id: user.canvasser_id }).sort('created_at', -1).toArray();
    const sids = [...new Set(orders.map(o => o.partner_store_id).filter(Boolean))];
    const debt = Object.fromEntries((sids.length ? await db.partner_stores.find({ id: { $in: sids } }, { id: 1, current_debt: 1 }).toArray() : []).map(s => [s.id, s.current_debt || 0]));
    const pids = new Set(), wids = new Set();
    orders.forEach(o => (o.items || []).forEach(i => { pids.add(i.product_id); wids.add(i.warehouse_id || o.warehouse_id || 'gudang_utama'); }));
    const ipb = Object.fromEntries((pids.size ? await db.products.find({ id: { $in: [...pids].filter(Boolean) } }, { id: 1, items_per_box: 1 }).toArray() : []).map(p => [p.id, num(p.items_per_box, 1) || 1]));
    const wu = Object.fromEntries((await db.warehouses.find({}, { id: 1, unit: 1 }).toArray()).map(w => [w.id, w.unit || 'satuan']));
    return orders.map(o => ({
      ...o, store_current_debt: debt[o.partner_store_id] || 0,
      items: (o.items || []).map(i => ({ ...i, items_per_box: ipb[i.product_id] || 1, warehouse_unit: wu[i.warehouse_id || o.warehouse_id || 'gudang_utama'] || 'satuan' })),
    }));
  });
  route('GET', '/canvassers/notifications', async ({ user }) => {
    requireCanvasser(user);
    const cid = user.canvasser_id;
    if (!cid) return { new_orders: 0, pending_orders: 0, total_remaining: 0 };
    const pending = await db.partner_orders.countDocuments({ canvasser_id: cid, status: 'pending' });
    const orders = await db.partner_orders.find({ canvasser_id: cid }, { remaining: 1 }).toArray();
    const today = await db.partner_orders.countDocuments({ canvasser_id: cid, date: witaDate() });
    return { new_orders: today, pending_orders: pending, total_remaining: sum(orders, o => o.remaining) };
  });
  route('GET', '/canvassers/my-recap', async ({ user, query }) => {
    requireCanvasser(user);
    const cid = user.canvasser_id;
    if (!cid) badRequest('Canvasser ID not found');
    const date = query.date || witaDate();
    const orders = await db.partner_orders.find({ canvasser_id: cid, date }).toArray();
    const expenses = await db.canvasser_expenses.find({ canvasser_id: cid, date }).toArray();
    const totalValue = sum(orders, o => o.total), totalPaid = sum(orders, o => o.paid), ext = sum(expenses, e => e.total_cost);
    return {
      date, total_orders: orders.length, total_settled: orders.filter(o => o.is_settled).length, total_value: totalValue, total_paid: totalPaid,
      total_remaining: totalValue - totalPaid, stores_visited: [...new Set(orders.map(o => o.partner_store_name).filter(Boolean))],
      return_items: orders.flatMap(o => o.return_items || []),
      store_details: orders.map(o => ({ order_number: o.order_number, partner_store_name: o.partner_store_name, total: o.total || 0, paid: o.paid || 0, remaining: o.remaining || 0, status: o.status || '', order_type: o.order_type || 'regular', is_settled: !!o.is_settled, items_count: (o.items || []).length })),
      total_external_cost: ext, net_sales: totalPaid - ext,
    };
  });
  route('GET', '/canvassers/product-search', async ({ query }) => {
    if (!query.q) return [];
    const products = await db.products.find({ name: { $icontains: query.q } }).sort('name', 1).limit(50).toArray();
    const wn = Object.fromEntries((await db.warehouses.find({}).toArray()).map(w => [w.id, w.name]));
    const stocks = products.length ? await db.warehouse_stock.find({ product_id: { $in: products.map(p => p.id) } }).toArray() : [];
    return products.map(p => ({
      id: p.id, name: p.name, barcode: p.barcode || '', stock: p.stock || 0, price: p.price || 0, box_price: p.box_price || 0,
      items_per_box: p.items_per_box || 1, cost_price: p.cost_price || 0,
      warehouse_stock: stocks.filter(s => s.product_id === p.id && num(s.stock) > 0).map(s => ({ warehouse: wn[s.warehouse_id] || s.warehouse_id, stock: s.stock })),
    }));
  });

  // ---------- armada ----------
  const vFields = b => ({ name: b.name, plate_number: b.plate_number || '', area_route: b.area_route || '', driver_name: b.driver_name || '', canvasser_id: b.canvasser_id || '' });
  route('GET', '/vehicles', async () => db.vehicles.find({}).sort('name', 1).toArray());
  route('POST', '/vehicles', async ({ user, body }) => {
    requireAdminOrManager(user);
    const doc = { id: uuid(), ...vFields(body), created_at: nowIso() };
    await db.vehicles.insertOne(doc);
    await logAudit(user, 'create', 'vehicle', doc.id, { name: doc.name, plate: doc.plate_number });
    return doc;
  });
  route('PUT', '/vehicles/:id', async ({ user, params, body }) => {
    requireAdminOrManager(user);
    const r = await db.vehicles.findOneAndUpdate({ id: params.id }, { $set: vFields(body) });
    if (!r) notFound('Armada tidak ditemukan');
    await logAudit(user, 'update', 'vehicle', params.id, vFields(body));
    return r;
  });
  route('DELETE', '/vehicles/:id', async ({ user, params }) => {
    requireAdminOrManager(user);
    const r = await db.vehicles.deleteOne({ id: params.id });
    if (!r.deletedCount) notFound('Armada tidak ditemukan');
    await db.partner_stores.updateMany({ vehicle_id: params.id }, { $set: { vehicle_id: '' } });
    await logAudit(user, 'delete', 'vehicle', params.id, {});
    return { message: 'Armada berhasil dihapus' };
  });

  // ---------- stok mobil box ----------
  route('GET', '/vehicle-stock', async ({ query }) => db.vehicle_stock.find(query.vehicle_id ? { vehicle_id: query.vehicle_id } : {}).sort('loaded_at', -1).toArray());
  route('GET', '/vehicle-stock/summary', async () => {
    const vehicles = await db.vehicles.find({}).toArray();
    const stocks = await db.vehicle_stock.find({ remaining_qty: { $gt: 0 } }).toArray();
    const pids = [...new Set(stocks.map(s => s.product_id))];
    const pm = Object.fromEntries((pids.length ? await db.products.find({ id: { $in: pids } }, { id: 1, cost_price: 1, items_per_box: 1 }).toArray() : []).map(p => [p.id, p]));
    return vehicles.map(v => {
      const st = stocks.filter(s => s.vehicle_id === v.id);
      return { vehicle_id: v.id, vehicle_name: v.name || '', plate_number: v.plate_number || '', total_items: st.length, total_value: Math.round(sum(st, s => unitCost(pm[s.product_id]) * num(s.remaining_qty))), stocks: st };
    });
  });
  route('GET', '/vehicle-stock/total-value', async () => {
    const stocks = await db.vehicle_stock.find({ remaining_qty: { $gt: 0 } }).toArray();
    const pids = [...new Set(stocks.map(s => s.product_id))];
    const pm = Object.fromEntries((pids.length ? await db.products.find({ id: { $in: pids } }, { id: 1, cost_price: 1, items_per_box: 1 }).toArray() : []).map(p => [p.id, p]));
    return { total_value: Math.round(sum(stocks, s => unitCost(pm[s.product_id]) * num(s.remaining_qty))) };
  });
  route('POST', '/vehicle-stock/load', async ({ user, body }) => {
    requirePanel(user);
    const items = body.items || [];
    if (!body.vehicle_id || !items.length) badRequest('Vehicle dan items harus diisi');
    const vehicle = await db.vehicles.findOne({ id: body.vehicle_id });
    if (!vehicle) notFound('Kendaraan tidak ditemukan');
    const loaded = [];
    for (const it of items) {
      const q = Math.trunc(num(it.quantity)); const wid = it.warehouse_id || 'gudang_toko';
      const p = await db.products.findOne({ id: it.product_id });
      if (!p) continue;
      const have = await getStock(p.id, wid);
      const unit = (await db.warehouses.findOne({ id: wid }))?.unit || 'satuan';
      const pcs = unit === 'dus' ? q * (num(p.items_per_box, 1) || 1) : q;
      if (have < q) badRequest(`Stok ${p.name} di gudang tidak cukup (${have} tersedia, butuh ${q})`);
      await incStock(p.id, wid, -q);
      const ex = await db.vehicle_stock.findOne({ vehicle_id: body.vehicle_id, product_id: p.id, remaining_qty: { $gt: 0 } });
      if (ex) await db.vehicle_stock.updateOne({ id: ex.id }, { $inc: { quantity: pcs, remaining_qty: pcs } });
      else await db.vehicle_stock.insertOne({
        id: uuid(), vehicle_id: body.vehicle_id, vehicle_name: vehicle.name || '', product_id: p.id, product_name: p.name, quantity: pcs, remaining_qty: pcs,
        sold_qty: 0, returned_qty: 0, price: it.price ?? p.price ?? 0, warehouse_id: wid, loaded_at: witaIso(), notes: body.notes || '', status: 'active',
      });
      loaded.push({ product_name: p.name, quantity: pcs });
    }
    await logAudit(user, 'LOAD_VEHICLE_STOCK', 'vehicle_stock', body.vehicle_id, { vehicle_name: vehicle.name || '', items: loaded, notes: body.notes || '' });
    return { message: `${loaded.length} item dimuat ke ${vehicle.name || ''}` };
  });
  route('POST', '/vehicle-stock/:id/sell', async ({ user, params, body }) => {
    requirePos(user);
    const q = Math.trunc(num(body.quantity)); const payType = body.payment_type || 'bon';
    if (!body.partner_store_id || q <= 0) badRequest('Data penjualan tidak valid');
    const st = await db.vehicle_stock.findOne({ id: params.id });
    if (!st) notFound('Stok kendaraan tidak ditemukan');
    if (q > num(st.remaining_qty)) badRequest(`Stok tidak cukup (tersedia: ${st.remaining_qty})`);
    const store = await db.partner_stores.findOne({ id: body.partner_store_id });
    if (!store) notFound('Kios mitra tidak ditemukan');
    const subtotal = q * num(st.price); const now = new Date();
    await db.vehicle_stock.updateOne({ id: params.id }, { $inc: { remaining_qty: -q, sold_qty: q } });
    const order = {
      id: uuid(), order_number: `VS-${stamp(now)}`, partner_store_id: store.id, partner_store_name: store.name, canvasser_id: '', canvasser_name: '',
      delivery_date: witaDate(now), date: witaDate(now),
      items: [{ product_id: st.product_id, product_name: st.product_name, quantity: q, price: st.price, subtotal, warehouse_id: st.warehouse_id }],
      subtotal, discount: 0, total: subtotal, paid: payType === 'cash' ? subtotal : 0, remaining: payType === 'cash' ? 0 : subtotal,
      status: 'delivered', order_type: 'kondisional', warehouse_id: st.warehouse_id, source: 'vehicle_stock', vehicle_stock_id: params.id, is_settled: true,
      settled_items: [{ product_id: st.product_id, product_name: st.product_name, qty_sold: q, original_qty: q, price: st.price }], return_items: [], created_at: witaIso(now),
    };
    await db.partner_orders.insertOne(order);
    if (payType === 'bon') await db.partner_stores.updateOne({ id: store.id }, { $inc: { current_debt: subtotal } });
    else await db.payment_history.insertOne({ id: uuid(), type: 'partner_store_cash', reference_id: store.id, partner_store_name: store.name, amount: subtotal, notes: `Pembayaran tunai dari stok mobil: ${st.product_name} x${q}`, created_at: witaIso(now), date: witaDate(now) });
    return { message: `${q}x ${st.product_name} terjual ke ${store.name} (${payType})`, order_id: order.id, subtotal };
  });
  route('POST', '/vehicle-stock/:id/return', async ({ user, params, body }) => {
    requirePos(user);
    const dus = Math.trunc(num(body.return_dus) || num(body.quantity)); const pcs = Math.trunc(num(body.return_pcs));
    if (!dus && !pcs) badRequest('Jumlah retur harus > 0');
    const st = await db.vehicle_stock.findOne({ id: params.id });
    if (!st) notFound('Stok kendaraan tidak ditemukan');
    const p = await db.products.findOne({ id: st.product_id }, { items_per_box: 1 });
    const total = dus * (num(p?.items_per_box, 1) || 1) + pcs;
    if (total <= 0) badRequest('Jumlah retur harus > 0');
    if (total > num(st.remaining_qty)) badRequest(`Jumlah retur melebihi sisa stok (tersedia: ${st.remaining_qty} pcs, retur: ${total} pcs)`);
    await db.vehicle_stock.updateOne({ id: params.id }, { $inc: { remaining_qty: -total, returned_qty: total } });
    const parts = [];
    if (dus > 0) { await incStock(st.product_id, 'gudang_utama', dus); parts.push(`${dus} dus ke Gudang Utama`); }
    if (pcs > 0) { await incStock(st.product_id, 'gudang_toko', pcs); parts.push(`${pcs} pcs ke Gudang Toko`); }
    await logAudit(user, 'RETURN_VEHICLE_STOCK', 'vehicle_stock', params.id, { product_name: st.product_name, return_dus: dus, return_pcs: pcs, total_pcs: total, notes: body.notes || '', vehicle_name: st.vehicle_name || '' });
    return { message: parts.length ? `${st.product_name}: ${parts.join(' + ')}` : `Retur ${total} pcs`, new_remaining: num(st.remaining_qty) - total };
  });
  route('PUT', '/vehicle-stock/:id/edit-price', async ({ user, params, body }) => {
    requirePos(user);
    const price = num(body.price);
    if (price < 0) badRequest('Harga tidak boleh negatif');
    const st = await db.vehicle_stock.findOne({ id: params.id });
    if (!st) notFound('Stok kendaraan tidak ditemukan');
    await db.vehicle_stock.updateOne({ id: params.id }, { $set: { price } });
    return { message: `Harga ${st.product_name} diubah ke ${price}`, new_price: price };
  });

  // ---------- piutang pribadi ----------
  route('GET', '/personal-loans/overview', async ({ user }) => {
    requireAdminOrManager(user);
    const loans = await db.personal_loans.find({}).sort('created_at', -1).toArray();
    return { loans, total_lent: sum(loans, l => l.amount), total_paid: sum(loans, l => l.paid), total_remaining: sum(loans, l => l.remaining), active_count: loans.filter(l => num(l.remaining) > 0).length, total_count: loans.length };
  });
  route('POST', '/personal-loans', async ({ user, query }) => {
    requireAdminOrManager(user);
    const amount = num(query.amount); const paid = Math.min(num(query.initial_paid), amount);
    const doc = { id: uuid(), borrower_name: query.borrower_name, borrower_phone: query.borrower_phone || '', loan_type: query.loan_type || 'cash', description: query.description || '', amount, paid, remaining: amount - paid, status: paid >= amount ? 'lunas' : 'aktif', created_by: user?.name || '', created_at: nowIso(), date: witaDate() };
    await db.personal_loans.insertOne(doc);
    return doc;
  });
  route('PUT', '/personal-loans/:id', async ({ user, params, query }) => {
    requireAdminOrManager(user);
    const loan = await db.personal_loans.findOne({ id: params.id });
    if (!loan) notFound('Piutang tidak ditemukan');
    const upd = {};
    ['borrower_name', 'borrower_phone', 'description'].forEach(k => { if (query[k] != null) upd[k] = query[k]; });
    if (query.amount != null && query.amount !== '') { upd.amount = num(query.amount); upd.remaining = upd.amount - num(loan.paid); upd.status = upd.remaining <= 0 ? 'lunas' : 'aktif'; }
    if (!Object.keys(upd).length) badRequest('Tidak ada data yang diubah');
    return db.personal_loans.findOneAndUpdate({ id: params.id }, { $set: upd });
  });
  route('DELETE', '/personal-loans/:id', async ({ user, params }) => {
    requireAdminOrManager(user);
    const r = await db.personal_loans.deleteOne({ id: params.id });
    if (!r.deletedCount) notFound('Piutang tidak ditemukan');
    await db.loan_payments.deleteMany({ loan_id: params.id });
    return { message: 'Piutang berhasil dihapus' };
  });
  route('POST', '/personal-loans/:id/pay', async ({ user, params, query }) => {
    requireAdminOrManager(user);
    const amount = num(query.amount);
    const loan = await db.personal_loans.findOne({ id: params.id });
    if (!loan) notFound('Piutang tidak ditemukan');
    if (amount <= 0) badRequest('Jumlah harus lebih dari 0');
    const newPaid = num(loan.paid) + amount; const rem = Math.max(0, num(loan.amount) - newPaid); const status = rem <= 0 ? 'lunas' : 'aktif';
    await db.personal_loans.updateOne({ id: params.id }, { $set: { paid: newPaid, remaining: rem, status } });
    await db.loan_payments.insertOne({ id: uuid(), loan_id: params.id, borrower_name: loan.borrower_name, amount, notes: query.notes || '', recorded_by: user?.name || '', created_at: nowIso(), date: witaDate() });
    return { message: 'Pembayaran berhasil', new_paid: newPaid, new_remaining: rem, status };
  });
  route('GET', '/personal-loans/:id/payments', async ({ user, params }) => { requireAdminOrManager(user); return db.loan_payments.find({ loan_id: params.id }).sort('created_at', -1).toArray(); });

  // ---------- petani & hutang petani ----------
  route('GET', '/farmers', async () => db.farmers.find({}).sort('name', 1).toArray());
  route('POST', '/farmers', async ({ query }) => {
    const doc = { id: uuid(), name: query.name, phone: query.phone || '', address: query.address || '', debt_limit: num(query.debt_limit), current_debt: 0, created_at: nowIso() };
    await db.farmers.insertOne(doc);
    return doc;
  });
  route('PUT', '/farmers/:id', async ({ params, query }) => {
    const f = await db.farmers.findOne({ id: params.id });
    if (!f) notFound('Petani tidak ditemukan');
    const upd = {};
    ['name', 'phone', 'address'].forEach(k => { if (query[k] != null) upd[k] = query[k]; });
    if (query.debt_limit != null && query.debt_limit !== '') upd.debt_limit = num(query.debt_limit);
    if (!Object.keys(upd).length) badRequest('Tidak ada data yang diubah');
    return db.farmers.findOneAndUpdate({ id: params.id }, { $set: upd });
  });
  route('DELETE', '/farmers/:id', async ({ user, params }) => {
    requireAdminOrManager(user);
    const r = await db.farmers.deleteOne({ id: params.id });
    if (!r.deletedCount) notFound('Petani tidak ditemukan');
    return { message: 'Petani berhasil dihapus' };
  });
  route('GET', '/farmer-debts/overview', async () => {
    const farmers = await db.farmers.find({}).sort('name', 1).toArray();
    return { farmers, total_debt: sum(farmers, f => f.current_debt), active_debtors: farmers.filter(f => num(f.current_debt) > 0).length, total_farmers: farmers.length };
  });
  route('POST', '/farmer-debts/transaction', async ({ user, body }) => {
    const f = await db.farmers.findOne({ id: body.farmer_id });
    if (!f) notFound('Petani tidak ditemukan');
    const total = num(body.total), paid = num(body.paid), debt = total - paid;
    if (num(f.debt_limit) > 0 && num(f.current_debt) + debt > num(f.debt_limit)) {
      badRequest(`Melebihi limit hutang (${Math.round(num(f.current_debt) + debt).toLocaleString('en-US')} > ${Math.round(num(f.debt_limit)).toLocaleString('en-US')})`);
    }
    for (const it of body.items || []) {
      if (it.product_id && num(it.quantity) > 0 && await getStock(it.product_id, 'gudang_toko') < num(it.quantity)) {
        badRequest(`Stok Gudang Toko tidak cukup untuk ${it.product_name || ''} (tersedia: ${await getStock(it.product_id, 'gudang_toko')})`);
      }
    }
    for (const it of body.items || []) if (it.product_id && num(it.quantity) > 0) await incStock(it.product_id, 'gudang_toko', -num(it.quantity));
    const doc = { id: uuid(), farmer_id: f.id, farmer_name: f.name, items: body.items || [], total, paid, remaining: debt, notes: body.notes || '', cashier_name: user?.name || '', created_at: witaIso(), date: businessDate() };
    await db.farmer_transactions.insertOne(doc);
    await db.farmers.updateOne({ id: f.id }, { $inc: { current_debt: debt } });
    return doc;
  });
  route('GET', '/farmer-debts/:id/transactions', async ({ params }) => db.farmer_transactions.find({ farmer_id: params.id }).sort('created_at', -1).toArray());
  route('GET', '/farmer-debts/:id/payments', async ({ params }) => db.farmer_payments.find({ farmer_id: params.id }).sort('created_at', -1).toArray());
  route('POST', '/farmer-debts/:id/pay', async ({ user, params, query }) => {
    const amount = num(query.amount);
    const f = await db.farmers.findOne({ id: params.id });
    if (!f) notFound('Petani tidak ditemukan');
    if (amount <= 0) badRequest('Jumlah harus lebih dari 0');
    const nd = Math.max(0, num(f.current_debt) - amount);
    await db.farmers.updateOne({ id: params.id }, { $set: { current_debt: nd } });
    let left = amount;
    for (const t of await db.farmer_transactions.find({ farmer_id: params.id, remaining: { $gt: 0 } }).sort('created_at', 1).toArray()) {
      if (left <= 0) break;
      const pay = Math.min(left, num(t.remaining)); const np = num(t.paid) + pay;
      await db.farmer_transactions.updateOne({ id: t.id }, { $set: { paid: np, remaining: Math.max(0, num(t.total) - np) } });
      left -= pay;
    }
    await db.farmer_payments.insertOne({ id: uuid(), farmer_id: params.id, farmer_name: f.name, amount, notes: query.notes || '', recorded_by: user?.name || '', created_at: nowIso(), date: witaDate() });
    return { message: 'Pembayaran berhasil', new_debt: nd };
  });
  route('PUT', '/farmer-debts/:id/correct', async ({ user, params, body }) => {
    requireAdminOrManager(user);
    const nd = num(body.new_debt);
    if (nd < 0) badRequest('Nilai hutang tidak boleh negatif');
    const f = await db.farmers.findOne({ id: params.id });
    if (!f) notFound('Petani tidak ditemukan');
    const old = num(f.current_debt);
    if (old === nd) return { message: 'Tidak ada perubahan', old_debt: old, new_debt: nd };
    await db.farmers.updateOne({ id: params.id }, { $set: { current_debt: nd } });
    await db.farmer_payments.insertOne({
      id: uuid(), farmer_id: params.id, farmer_name: f.name, amount: old - nd,
      notes: body.notes ? `[KOREKSI] ${body.notes}` : `[KOREKSI] ${Math.round(old).toLocaleString('en-US')} -> ${Math.round(nd).toLocaleString('en-US')}`,
      recorded_by: user?.name || '', created_at: witaIso(), date: witaDate(),
    });
    return { message: 'Hutang petani berhasil dikoreksi', old_debt: old, new_debt: nd };
  });
}
