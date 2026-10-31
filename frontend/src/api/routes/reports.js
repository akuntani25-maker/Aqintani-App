// Pengganti backend/routers/report_routes.py (versi v2 yang sudah diperbaiki)
import {
  db, num, sum, round, witaDate, businessDate, addDays, requirePanel, lowStockProducts,
  productMap, warehouseUnits, posCost, orderCost, orderUnitsSold, itemUnits, unitCost, ipbOf,
} from '../core';

const CANCELLED = ['cancelled', 'canceled'];
const pad = n => String(n).padStart(2, '0');

export default function register(route) {
  route('GET', '/dashboard/stats', async ({ user }) => {
    requirePanel(user);
    const today = businessDate();
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const [todayTx, weekTx, low, total_products, whs, prods, stocks] = await Promise.all([
      db.transactions.find({ date: today }).toArray(),
      db.transactions.find({ date: { $gte: days[0], $lte: today } }, { date: 1, total: 1 }).toArray(),
      lowStockProducts(),
      db.products.countDocuments({}),
      db.warehouses.find({}).toArray(),
      db.products.find({}, { id: 1, cost_price: 1, items_per_box: 1 }).toArray(),
      db.warehouse_stock.find({}, { product_id: 1, warehouse_id: 1, stock: 1 }).toArray(),
    ]);
    const pm = Object.fromEntries(prods.map(p => [p.id, p]));
    const unitOf = Object.fromEntries(whs.map(w => [w.id, w.unit || 'satuan']));
    const byDay = Object.fromEntries(days.map(d => [d, { date: d, sales: 0, count: 0 }]));
    weekTx.forEach(t => { if (byDay[t.date]) { byDay[t.date].sales += num(t.total); byDay[t.date].count += 1; } });

    const whVal = {};
    for (const s of stocks) {
      const p = pm[s.product_id]; if (!p) continue;
      const v = unitOf[s.warehouse_id] === 'dus' ? num(s.stock) * num(p.cost_price) : num(s.stock) * unitCost(p);
      whVal[s.warehouse_id] = (whVal[s.warehouse_id] || 0) + v;
    }
    let inventory = 0; const chart = [];
    for (const w of whs) { const v = whVal[w.id] || 0; inventory += v; if (v > 0) chart.push({ name: w.name || w.id, value: Math.round(v) }); }

    const [purchToday, partnerToday, farmerToday, unpaidPurch, stores, vehicles, loans, farmers, vstocks, due] = await Promise.all([
      db.purchases.find({ date: today, source: { $ne: 'import' } }, { items: 1 }).toArray(),
      db.partner_orders.find({ date: today }).toArray(),
      db.farmer_transactions.find({ date: today }, { items: 1 }).toArray(),
      db.purchases.find({ remaining: { $gt: 0 } }, { remaining: 1 }).toArray(),
      db.partner_stores.find({}, { id: 1, current_debt: 1, vehicle_id: 1 }).toArray(),
      db.vehicles.find({}, { id: 1, name: 1 }).toArray(),
      db.personal_loans.find({ remaining: { $gt: 0 } }, { remaining: 1 }).toArray().catch(() => []),
      db.farmers.find({}, { current_debt: 1 }).toArray(),
      db.vehicle_stock.find({ remaining_qty: { $gt: 0 } }, { product_id: 1, remaining_qty: 1 }).toArray(),
      db.purchases.find({ due_date: { $gte: today.slice(0, 7) + '-01', $lte: today.slice(0, 7) + '-31' }, remaining: { $gt: 0 } }).limit(100).toArray(),
    ]);
    const stockIn = sum(purchToday, p => sum(p.items || [], i => i.subtotal));
    const posOut = sum(todayTx, t => sum(t.items || [], i => unitCost(pm[i.product_id]) * num(i.quantity)));
    const partnerOut = sum(partnerToday, o => sum(o.items || [], i => {
      const p = pm[i.product_id]; if (!p) return 0;
      const wid = i.warehouse_id || o.warehouse_id || 'gudang_toko';
      return unitOf[wid] === 'dus' ? num(i.quantity) * num(p.cost_price) : num(i.quantity) * unitCost(p);
    }));
    const farmerOut = sum(farmerToday, t => sum(t.items || [], i => unitCost(pm[i.product_id]) * num(i.quantity)));
    const supplierDebt = sum(unpaidPurch, p => p.remaining);
    const partnerDebt = sum(stores, s => s.current_debt);
    const vname = Object.fromEntries(vehicles.map(v => [v.id, v.name || v.id]));
    const byVeh = {};
    stores.forEach(s => { const n = s.vehicle_id ? (vname[s.vehicle_id] || 'Belum Ditugaskan') : 'Belum Ditugaskan'; byVeh[n] = (byVeh[n] || 0) + num(s.current_debt); });
    const loansTotal = sum(loans, l => l.remaining), farmerDebt = sum(farmers, f => f.current_debt);
    const vehicleStock = Math.round(sum(vstocks, v => unitCost(pm[v.product_id]) * num(v.remaining_qty)));
    return {
      today_sales: sum(todayTx, t => t.total), today_transactions: todayTx.length, total_products, low_stock_count: low.length,
      low_stock_products: low.slice(0, 10).map(p => ({ id: p.id, name: p.name, stock: p.stock, min_stock_alert: p.min_stock_alert, items_per_box: p.items_per_box })),
      last_7_days: days.map(d => byDay[d]), inventory_value: inventory, warehouse_chart: chart, stock_in_today: stockIn,
      stock_out_today: posOut + partnerOut, stock_out_today_pos: posOut + farmerOut, stock_out_today_partner: partnerOut,
      total_supplier_debt: supplierDebt, total_partner_debt: partnerDebt,
      partner_debt_vehicles: Object.entries(byVeh).filter(([, v]) => v > 0).map(([vehicle, debt]) => ({ vehicle, debt })),
      total_personal_loans: loansTotal, total_farmer_debt: farmerDebt,
      total_assets: inventory + vehicleStock + partnerDebt + loansTotal + farmerDebt - supplierDebt,
      total_vehicle_stock: vehicleStock, due_this_month: due,
    };
  });

  route('GET', '/dashboard/due-calendar', async ({ user, query }) => {
    requirePanel(user);
    const ym = `${String(query.year).padStart(4, '0')}-${pad(query.month)}`;
    return db.purchases.find({ due_date: { $gte: `${ym}-01`, $lte: `${ym}-31` }, remaining: { $gt: 0 } }).limit(1000).toArray();
  });

  route('GET', '/reports/daily', async ({ user, query }) => {
    requirePanel(user);
    const txns = await db.transactions.find({ date: query.date }).toArray();
    const pm = {};
    txns.forEach(t => { pm[t.payment_method] = (pm[t.payment_method] || 0) + num(t.total); });
    return { date: query.date, total_sales: sum(txns, t => t.total), total_transactions: txns.length, payment_methods: pm, transactions: txns };
  });
  route('GET', '/reports/monthly', async ({ user, query }) => {
    requirePanel(user);
    const y = num(query.year), m = num(query.month);
    const start = `${y}-${pad(m)}-01`, end = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    const txns = await db.transactions.find({ date: { $gte: start, $lt: end } }, { date: 1, total: 1 }).toArray();
    const daily = {};
    txns.forEach(t => { daily[t.date] = (daily[t.date] || 0) + num(t.total); });
    return { year: y, month: m, total_sales: sum(txns, t => t.total), total_transactions: txns.length, daily_sales: daily };
  });

  route('GET', '/reports/sales-detail', async ({ user, query }) => {
    requirePanel(user);
    const txns = await db.transactions.find({ date: { $gte: query.date_from, $lte: query.date_to } }).toArray();
    const pm = await productMap(new Set(txns.flatMap(t => (t.items || []).map(i => i.product_id))));
    const rows = []; let ts = 0, tc = 0;
    for (const t of txns) for (const it of t.items || []) {
      const q = num(it.quantity); if (q <= 0) continue;
      const cu = it.cost_price_unit != null ? num(it.cost_price_unit) : unitCost(pm[it.product_id]);
      const sell = num(it.price) * q, cost = cu * q;
      rows.push({ date: t.date, time: t.created_at || '', transaction_number: t.transaction_number || '', product_name: it.product_name, quantity: q, cost_price: round(cu, 2), sell_price: it.price, total_sell: sell, total_cost: round(cost, 2), margin: round(sell - cost, 2) });
      ts += sell; tc += cost;
    }
    return { date_from: query.date_from, date_to: query.date_to, rows, total_sales: round(ts, 2), total_cost: round(tc, 2), total_margin: round(ts - tc, 2), total_items: rows.length };
  });

  route('GET', '/reports/partner-sales-detail', async ({ user, query }) => {
    requirePanel(user);
    const orders = await db.partner_orders.find({ date: { $gte: query.date_from, $lte: query.date_to }, status: { $nin: CANCELLED } }).toArray();
    const pm = await productMap(new Set(orders.flatMap(o => (o.items || []).map(i => i.product_id))));
    const wu = await warehouseUnits();
    const rows = []; let ts = 0, tc = 0;
    const push = (o, name, qOrig, unitOrig, qSat, cu, spu, sell) => {
      const cost = cu * qSat;
      rows.push({ date: o.date, order_number: o.order_number || '', partner_store_name: o.partner_store_name || '', product_name: name, quantity_original: qOrig, unit_original: unitOrig, quantity_satuan: qSat, cost_price_per_unit: round(cu, 2), sell_price_per_unit: round(spu, 2), total_sell: round(sell, 2), total_cost: round(cost, 2), margin: round(sell - cost, 2) });
      ts += sell; tc += cost;
    };
    for (const o of orders) {
      if (o.is_settled && (o.settled_items || []).length) {
        const sm = Object.fromEntries(o.settled_items.map(s => [s.product_id, s]));
        for (const it of o.items || []) {
          const si = sm[it.product_id]; const q = si ? num(si.qty_sold) : num(it.quantity);
          if (q <= 0) continue;
          const spu = si ? num(si.price) : num(it.price);
          push(o, it.product_name, q, 'satuan', q, unitCost(pm[it.product_id]), spu, q * spu);
        }
      } else {
        for (const it of o.items || []) {
          if (num(it.quantity) <= 0) continue;
          const p = pm[it.product_id]; const wid = it.warehouse_id || o.warehouse_id || 'gudang_utama';
          const unit = wu[wid] || 'satuan'; const qSat = itemUnits(it, p, wu, o.warehouse_id || 'gudang_utama');
          const cu = it.source === 'external' ? num(it.external_cost) / (unit === 'dus' ? ipbOf(p) : 1) : unitCost(p);
          push(o, it.product_name, num(it.quantity), unit, qSat, cu, num(it.price), num(it.subtotal) || num(it.price) * qSat);
        }
      }
    }
    return { date_from: query.date_from, date_to: query.date_to, rows, total_sales: round(ts, 2), total_cost: round(tc, 2), total_margin: round(ts - tc, 2), total_items: rows.length };
  });

  route('GET', '/reports/best-sellers', async ({ user, query }) => {
    requirePanel(user);
    const range = { date: { $gte: query.date_from, $lte: query.date_to } };
    const [txns, orders] = await Promise.all([db.transactions.find(range).toArray(), db.partner_orders.find({ ...range, status: { $nin: CANCELLED } }).toArray()]);
    const ids = new Set([...txns.flatMap(t => (t.items || []).map(i => i.product_id)), ...orders.flatMap(o => (o.items || []).map(i => i.product_id))]);
    const pm = await productMap(ids); const wu = await warehouseUnits();
    const agg = {};
    const row = (pid, name) => (agg[pid] = agg[pid] || { product_name: name, qty_pos: 0, qty_partner: 0, revenue_pos: 0, revenue_partner: 0, cost_total: 0 });
    for (const t of txns) for (const it of t.items || []) {
      if (num(it.quantity) <= 0) continue;
      const r = row(it.product_id, it.product_name);
      r.qty_pos += num(it.quantity); r.revenue_pos += num(it.subtotal);
      r.cost_total += (it.cost_price_unit != null ? num(it.cost_price_unit) : unitCost(pm[it.product_id])) * num(it.quantity);
    }
    for (const o of orders) {
      if (o.is_settled && (o.settled_items || []).length) {
        for (const si of o.settled_items) {
          if (num(si.qty_sold) <= 0) continue;
          const r = row(si.product_id, si.product_name);
          r.qty_partner += num(si.qty_sold); r.revenue_partner += num(si.qty_sold) * num(si.price); r.cost_total += unitCost(pm[si.product_id]) * num(si.qty_sold);
        }
      } else for (const it of o.items || []) {
        if (num(it.quantity) <= 0) continue;
        const r = row(it.product_id, it.product_name); const q = itemUnits(it, pm[it.product_id], wu, o.warehouse_id || 'gudang_utama');
        r.qty_partner += q; r.revenue_partner += num(it.subtotal); r.cost_total += unitCost(pm[it.product_id]) * q;
      }
    }
    const rows = Object.entries(agg).map(([pid, d]) => {
      const rev = d.revenue_pos + d.revenue_partner;
      return { product_id: pid, product_name: d.product_name, qty_pos: d.qty_pos, qty_partner: d.qty_partner, qty_total: d.qty_pos + d.qty_partner, revenue_pos: round(d.revenue_pos, 2), revenue_partner: round(d.revenue_partner, 2), revenue_total: round(rev, 2), cost_total: round(d.cost_total, 2), margin: round(rev - d.cost_total, 2) };
    }).sort((a, b) => b.revenue_total - a.revenue_total);
    return { date_from: query.date_from, date_to: query.date_to, rows, total_products: rows.length };
  });

  route('GET', '/analytics/products', async ({ user }) => {
    requirePanel(user);
    const txns = await db.transactions.find({ date: { $gte: addDays(witaDate(), -30) } }, { items: 1 }).toArray();
    const ps = {};
    txns.forEach(t => (t.items || []).forEach(i => { if (!i.product_id) return; const r = (ps[i.product_id] = ps[i.product_id] || { id: i.product_id, name: i.product_name, quantity: 0, revenue: 0 }); r.quantity += num(i.quantity); r.revenue += num(i.subtotal); }));
    const v = Object.values(ps);
    return { fast_moving: [...v].sort((a, b) => b.quantity - a.quantity).slice(0, 10), slow_moving: [...v].sort((a, b) => a.quantity - b.quantity).slice(0, 10) };
  });

  route('GET', '/analytics/summary', async ({ user, query }) => {
    requirePanel(user);
    const days = Math.max(1, Math.min(num(query.days, 30) || 30, 366));
    const today = witaDate(); const start = addDays(today, -(days - 1));
    const [txns, orders, cats] = await Promise.all([
      db.transactions.find({ date: { $gte: start, $lte: today }, status: { $ne: 'returned' } }).toArray(),
      db.partner_orders.find({ date: { $gte: start, $lte: today }, status: { $nin: CANCELLED } }).toArray(),
      db.categories.find({}, { id: 1, name: 1 }).toArray(),
    ]);
    const ids = new Set([...txns.flatMap(t => (t.items || []).map(i => i.product_id)), ...orders.flatMap(o => [...(o.items || []), ...(o.settled_items || [])].map(i => i.product_id))]);
    const pm = await productMap(ids); const wu = await warehouseUnits();
    const cm = Object.fromEntries(cats.map(c => [c.id, c.name]));
    const posRev = sum(txns, t => t.total), kiosRev = sum(orders, o => o.total);
    const cost = sum(txns, t => posCost(t, pm)) + sum(orders, o => orderCost(o, pm, wu));
    const units = sum(txns, t => sum(t.items || [], i => i.quantity)) + sum(orders, o => orderUnitsSold(o, pm, wu));
    const trend = {};
    for (let i = 0; i < days; i++) { const d = addDays(start, i); trend[d] = { date: d, revenue: 0, pos: 0, partner: 0, transactions: 0 }; }
    txns.forEach(t => { const r = trend[t.date]; if (r) { r.revenue += num(t.total); r.pos += num(t.total); r.transactions += 1; } });
    orders.forEach(o => { const r = trend[o.date]; if (r) { r.revenue += num(o.total); r.partner += num(o.total); r.transactions += 1; } });
    const byCat = {}, byProd = {};
    const add = (pid, name, u, v) => {
      const c = cm[pm[pid]?.category_id] || 'Tanpa Kategori'; byCat[c] = (byCat[c] || 0) + v;
      const r = (byProd[pid || name] = byProd[pid || name] || { name: name || pm[pid]?.name || '-', quantity: 0, revenue: 0 }); r.quantity += u; r.revenue += v;
    };
    txns.forEach(t => (t.items || []).forEach(i => add(i.product_id, i.product_name, num(i.quantity), i.subtotal != null ? num(i.subtotal) : num(i.price) * num(i.quantity))));
    orders.forEach(o => (o.items || []).forEach(i => add(i.product_id, i.product_name, itemUnits(i, pm[i.product_id], wu, o.warehouse_id || 'gudang_toko'), num(i.subtotal))));
    const revenue = posRev + kiosRev; const n = txns.length + orders.length;
    const month = today.slice(0, 7) + '-01';
    const mp = await db.purchases.find({ date: { $gte: month } }, { total: 1, remaining: 1 }).toArray();
    const monthTx = txns.filter(t => (t.date || '') >= month);
    return {
      period: { from: start, to: today, days }, total_revenue: Math.round(revenue), pos_revenue: Math.round(posRev), partner_revenue: Math.round(kiosRev),
      total_cost: Math.round(cost), gross_profit: Math.round(revenue - cost), margin_pct: revenue ? round((revenue - cost) / revenue * 100, 1) : 0,
      total_orders: n, pos_transactions: txns.length, partner_orders: orders.length, total_products_sold: round(units, 2), avg_order_value: n ? Math.round(revenue / n) : 0,
      daily_trend: Object.values(trend).map(r => ({ ...r, revenue: Math.round(r.revenue) })),
      category_breakdown: Object.entries(byCat).filter(([, v]) => v > 0).map(([name, v]) => ({ name, value: Math.round(v) })).sort((a, b) => b.value - a.value),
      top_products: Object.values(byProd).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      monthly_sales: sum(monthTx, t => t.total), monthly_transactions: monthTx.length, monthly_purchases: sum(mp, p => p.total), monthly_purchases_unpaid: sum(mp, p => p.remaining),
      estimated_margin: Math.round(revenue - cost), chart_data: Object.values(trend).map(r => ({ date: r.date, sales: r.pos, transactions: r.transactions })),
    };
  });

  route('GET', '/reports/profit-loss', async ({ user, query }) => {
    requirePanel(user);
    const range = { date: { $gte: query.date_from, $lte: query.date_to } };
    const [txns, orders] = await Promise.all([
      db.transactions.find({ ...range, status: { $ne: 'returned' } }).toArray(),
      db.partner_orders.find({ ...range, status: { $nin: CANCELLED } }).toArray(),
    ]);
    const ids = new Set([...txns.flatMap(t => (t.items || []).map(i => i.product_id)), ...orders.flatMap(o => [...(o.items || []), ...(o.settled_items || [])].map(i => i.product_id))]);
    const pm = await productMap(ids); const wu = await warehouseUnits();
    const daily = {}; let pr = 0, pc = 0, kr = 0, kc = 0;
    const dayRow = d => (daily[d] = daily[d] || { date: d, revenue: 0, cogs: 0 });
    txns.forEach(t => { const c = posCost(t, pm); pr += num(t.total); pc += c; const r = dayRow(t.date || ''); r.revenue += num(t.total); r.cogs += c; });
    orders.forEach(o => { const c = orderCost(o, pm, wu); kr += num(o.total); kc += c; const r = dayRow(o.date || ''); r.revenue += num(o.total); r.cogs += c; });
    const tr = pr + kr, tc = pc + kc;
    return {
      period: { from: query.date_from, to: query.date_to }, pos_revenue: Math.round(pr), pos_cogs: Math.round(pc), partner_revenue: Math.round(kr), partner_cogs: Math.round(kc),
      total_revenue: Math.round(tr), total_cogs: Math.round(tc), gross_profit: Math.round(tr - tc), margin_percent: tr ? round((tr - tc) / tr * 100, 1) : 0,
      total_transactions: txns.length, total_partner_orders: orders.length,
      daily_data: Object.values(daily).sort((a, b) => (a.date < b.date ? -1 : 1)).map(v => ({ date: v.date, revenue: Math.round(v.revenue), cogs: Math.round(v.cogs), profit: Math.round(v.revenue - v.cogs) })),
    };
  });

  route('GET', '/reports/canvasser-recap', async ({ query }) => {
    const f = { date: query.date };
    if (query.canvasser_id) f.canvasser_id = query.canvasser_id;
    const orders = await db.partner_orders.find(f).toArray();
    const data = {};
    for (const o of orders) {
      const cid = o.canvasser_id; if (!cid) continue;
      const c = (data[cid] = data[cid] || { canvasser_id: cid, canvasser_name: o.canvasser_name || 'Tanpa Kanvaser', total_orders: 0, total_delivered: 0, total_settled: 0, total_cancelled: 0, total_order_value: 0, total_settled_value: 0, total_payment_received: 0, return_items: [], stores_visited: [], orders: [] });
      c.total_orders += 1; c.total_order_value += num(o.total);
      if (o.status === 'delivered') c.total_delivered += 1; else if (o.status === 'cancelled') c.total_cancelled += 1;
      if (o.is_settled) { c.total_settled += 1; c.total_settled_value += num(o.total); c.return_items.push(...(o.return_items || [])); }
      c.total_payment_received += num(o.paid);
      if (o.partner_store_name && !c.stores_visited.includes(o.partner_store_name)) c.stores_visited.push(o.partner_store_name);
      c.orders.push({ order_number: o.order_number, partner_store_name: o.partner_store_name || '', total: o.total || 0, paid: o.paid || 0, remaining: o.remaining || 0, status: o.status || '', order_type: o.order_type || 'regular', is_settled: !!o.is_settled, items: o.items || [] });
    }
    const result = Object.values(data);
    const canvassers = await db.canvassers.find({}, { id: 1, name: 1 }).toArray();
    return {
      date: query.date, canvassers, data: result,
      summary: {
        total_canvassers: result.length, total_orders: sum(result, c => c.total_orders), total_delivered: sum(result, c => c.total_delivered), total_settled: sum(result, c => c.total_settled),
        total_order_value: sum(result, c => c.total_order_value), total_payment: sum(result, c => c.total_payment_received), total_return_items: sum(result, c => c.return_items.length),
      },
    };
  });
}
