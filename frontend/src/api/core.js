// Inti lapisan data: klien Supabase + "db" yang meniru perintah MongoDB.
// Semua logika lama (FastAPI + MongoDB) dipindah ke src/api/routes/*.js dan
// memakai `db.<koleksi>.find/insertOne/updateOne/...` persis seperti versi Python.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL || 'http://localhost:54321', SUPABASE_ANON_KEY || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'aqintani-auth' },
});

// ---------- error ala FastAPI: halaman membaca error.response.data.detail ----------
export class HttpError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : JSON.stringify(detail));
    this.status = status;
    this.response = { status, data: { detail } };
  }
}
export const notFound = (msg = 'Not found') => { throw new HttpError(404, msg); };
export const badRequest = (msg) => { throw new HttpError(400, msg); };

function rpcError(error) {
  const msg = error?.message || 'Terjadi kesalahan pada server';
  if (/row-level security|permission denied/i.test(msg)) return new HttpError(403, 'Anda tidak punya akses untuk tindakan ini');
  if (/JWT|not authenticated|Belum login/i.test(msg)) return new HttpError(401, 'Sesi berakhir, silakan login ulang');
  return new HttpError(400, msg);
}

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw rpcError(error);
  return data;
}

// ---------- utilitas umum ----------
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));
export const sum = (arr, f = x => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
export const round = (v, digits = 0) => { const p = 10 ** digits; return Math.round((Number(v) || 0) * p) / p; };

// Zona waktu toko: WITA (UTC+8). Hari bisnis kasir berganti jam 20:00 WITA.
const WITA_MS = 8 * 3600 * 1000;
const pad = n => String(n).padStart(2, '0');
export function witaParts(d = new Date()) {
  const w = new Date(d.getTime() + WITA_MS);
  return { y: w.getUTCFullYear(), m: w.getUTCMonth() + 1, d: w.getUTCDate(), H: w.getUTCHours(), M: w.getUTCMinutes(), S: w.getUTCSeconds() };
}
export const witaDate = (d = new Date()) => { const p = witaParts(d); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
export const addDays = (ymd, n) => { const t = new Date(ymd + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export const businessDate = (d = new Date()) => (witaParts(d).H >= 20 ? addDays(witaDate(d), 1) : witaDate(d));
export const witaIso = (d = new Date()) => {
  const p = witaParts(d); const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.H)}:${pad(p.M)}:${pad(p.S)}.${ms}+08:00`;
};
export const stamp = (d = new Date()) => { const p = witaParts(d); return `${p.y}${pad(p.m)}${pad(p.d)}${pad(p.H)}${pad(p.M)}${pad(p.S)}`; };
export const nowIso = () => new Date().toISOString();
export const daysAgo = (n) => addDays(witaDate(), -n);

// ---------- "db" ala MongoDB ----------
const PAGE = 1000; // batas baris per permintaan di Supabase

class Cursor {
  constructor(coll, filter, proj) { this.coll = coll; this.filter = filter || {}; this.proj = proj || null; this._sort = null; this._skip = 0; this._limit = null; }
  sort(key, dir = 1) {
    if (Array.isArray(key)) this._sort = key; else this._sort = [...(this._sort || []), [key, dir]];
    return this;
  }
  skip(n) { this._skip = n; return this; }
  limit(n) { this._limit = n; return this; }
  async toArray(max) {
    const want = [this._limit, max].filter(x => x != null && x > 0);
    const limit = want.length ? Math.min(...want) : null;
    const out = [];
    let skip = this._skip || 0;
    for (;;) {
      const chunk = limit == null ? PAGE : Math.min(PAGE, limit - out.length);
      if (chunk <= 0) break;
      const rows = await rpc('mq_find', {
        p_coll: this.coll, p_filter: this.filter, p_sort: this._sort,
        p_skip: skip, p_limit: chunk, p_proj: this.proj,
      });
      out.push(...rows);
      if (rows.length < chunk) break;
      skip += rows.length;
    }
    return out;
  }
  then(resolve, reject) { return this.toArray().then(resolve, reject); }
}

class Collection {
  constructor(name) { this.name = name; }
  find(filter = {}, proj = null) { return new Cursor(this.name, filter, proj); }
  async findOne(filter = {}, proj = null) { const r = await this.find(filter, proj).limit(1).toArray(); return r[0] || null; }
  async countDocuments(filter = {}) { return Number(await rpc('mq_count', { p_coll: this.name, p_filter: filter })); }
  async distinct(key, filter = {}) { return rpc('mq_distinct', { p_coll: this.name, p_key: key, p_filter: filter }); }
  async insertOne(doc) { await rpc('mq_insert', { p_coll: this.name, p_docs: [doc] }); return { insertedId: doc.id }; }
  async insertMany(docs) { if (!docs.length) return { insertedCount: 0 }; let n = 0; for (let i = 0; i < docs.length; i += 500) n += await rpc('mq_insert', { p_coll: this.name, p_docs: docs.slice(i, i + 500) }); return { insertedCount: n }; }
  async _update(filter, update, multi, opts = {}) {
    const r = await rpc('mq_update', { p_coll: this.name, p_filter: filter, p_update: update, p_multi: multi, p_upsert: !!opts.upsert, p_return: opts.returnDoc || null });
    return { matchedCount: r.matched, modifiedCount: r.modified, upserted: r.upserted, doc: r.doc };
  }
  updateOne(filter, update, opts) { return this._update(filter, update, false, opts); }
  updateMany(filter, update, opts) { return this._update(filter, update, true, opts); }
  async findOneAndUpdate(filter, update, opts = {}) { const r = await this._update(filter, update, false, { ...opts, returnDoc: opts.returnDoc || 'after' }); return r.doc || null; }
  async deleteOne(filter) { return { deletedCount: await rpc('mq_delete', { p_coll: this.name, p_filter: filter, p_multi: false }) }; }
  async deleteMany(filter) { return { deletedCount: await rpc('mq_delete', { p_coll: this.name, p_filter: filter, p_multi: true }) }; }
}

export const db = new Proxy({}, {
  get(target, name) {
    if (typeof name !== 'string') return undefined;
    if (!target[name]) target[name] = new Collection(name);
    return target[name];
  },
});
export const callRpc = rpc;

// ---------- aturan stok & biaya (sama dengan backend/metrics.py) ----------
export const ipbOf = p => num(p?.items_per_box, 1) || 1;
export const unitCost = p => (p ? num(p.cost_price) / ipbOf(p) : 0);

export async function productMap(ids, extra = []) {
  const proj = { id: 1, name: 1, cost_price: 1, items_per_box: 1, category_id: 1 };
  extra.forEach(f => { proj[f] = 1; });
  const filter = ids ? { id: { $in: [...ids].filter(Boolean) } } : {};
  if (ids && !filter.id.$in.length) return {};
  const docs = await db.products.find(filter, proj).toArray();
  return Object.fromEntries(docs.map(p => [p.id, p]));
}
export async function warehouseUnits() {
  const whs = await db.warehouses.find({}, { id: 1, unit: 1 }).toArray();
  return Object.fromEntries(whs.map(w => [w.id, w.unit || 'satuan']));
}
export function itemUnits(item, prod, whUnits, defaultWh = 'gudang_toko') {
  const qty = num(item.quantity);
  const wh = item.warehouse_id || defaultWh;
  return whUnits[wh] === 'dus' ? qty * ipbOf(prod) : qty;
}
export function posCost(t, pmap) {
  return sum(t.items || [], it => {
    const cu = it.cost_price_unit != null ? num(it.cost_price_unit) : unitCost(pmap[it.product_id]);
    return cu * num(it.quantity);
  });
}
export function orderCost(o, pmap, whUnits) {
  if (o.is_settled && (o.settled_items || []).length) {
    return sum(o.settled_items, si => (num(si.qty_sold) > 0 ? num(si.qty_sold) * unitCost(pmap[si.product_id]) : 0));
  }
  const dwh = o.warehouse_id || 'gudang_toko';
  return sum(o.items || [], it => {
    if (it.source === 'external') return num(it.external_cost) * num(it.quantity);
    const p = pmap[it.product_id];
    return itemUnits(it, p, whUnits, dwh) * unitCost(p);
  });
}
export function orderUnitsSold(o, pmap, whUnits) {
  if (o.is_settled && (o.settled_items || []).length) return sum(o.settled_items, si => Math.max(0, num(si.qty_sold)));
  const dwh = o.warehouse_id || 'gudang_toko';
  return sum(o.items || [], it => itemUnits(it, pmap[it.product_id], whUnits, dwh));
}
export const isLow = p => num(p.stock) <= num(p.min_stock_alert);
export async function lowStockProducts(limit) {
  const docs = await db.products.find({}, { id: 1, name: 1, barcode: 1, stock: 1, min_stock_alert: 1, items_per_box: 1, category_id: 1, price: 1 }).toArray();
  const low = docs.filter(isLow).map(p => ({ stock: 0, min_stock_alert: 0, items_per_box: 1, ...p }));
  low.sort((a, b) => num(a.stock) - num(b.stock));
  return limit ? low.slice(0, limit) : low;
}

// Stok gudang: ubah dengan $inc (atomik di database). Stok total produk dihitung trigger.
export async function incStock(productId, warehouseId, delta) {
  return db.warehouse_stock.updateOne({ product_id: productId, warehouse_id: warehouseId }, { $inc: { stock: delta } }, { upsert: true });
}
export async function getStock(productId, warehouseId) {
  const s = await db.warehouse_stock.findOne({ product_id: productId, warehouse_id: warehouseId });
  return s ? num(s.stock) : 0;
}
export async function ensureWarehouseStock(productId) {
  const whs = await db.warehouses.find({}, { id: 1 }).toArray();
  const have = new Set((await db.warehouse_stock.find({ product_id: productId }, { warehouse_id: 1 }).toArray()).map(s => s.warehouse_id));
  const missing = whs.filter(w => !have.has(w.id)).map(w => ({ product_id: productId, warehouse_id: w.id, stock: 0 }));
  if (missing.length) await db.warehouse_stock.insertMany(missing);
}

export async function logAudit(user, action, entityType, entityId, details) {
  try {
    await db.audit_log.insertOne({
      id: uuid(), user_id: user?.id || '', user_name: user?.name || user?.email || '', user_role: user?.role || '',
      action, entity_type: entityType, entity_id: entityId || '', details: details || {}, timestamp: nowIso(),
    });
  } catch (e) { /* log aktivitas tidak boleh menggagalkan transaksi */ }
}

// ---------- peran ----------
export const ROLE_PERMISSIONS = {
  admin: ['dashboard', 'products', 'categories', 'suppliers', 'supplier_debts', 'partner_stores', 'partner_orders', 'canvassers', 'analytics', 'reports', 'users', 'store_settings', 'import_data', 'printer', 'profile', 'vehicles', 'vehicle_stock', 'audit_log', 'pos', 'personal_loans'],
  manager: ['dashboard', 'products', 'categories', 'suppliers', 'supplier_debts', 'partner_stores', 'partner_orders', 'canvassers', 'analytics', 'reports', 'store_settings', 'import_data', 'printer', 'profile', 'vehicles', 'vehicle_stock', 'audit_log', 'pos', 'personal_loans'],
  office_staff: ['dashboard', 'products', 'categories', 'suppliers', 'supplier_debts', 'partner_stores', 'partner_orders', 'analytics', 'reports', 'profile', 'vehicles', 'vehicle_stock', 'pos'],
  cashier: ['pos', 'profile'],
  canvasser: ['canvasser_dashboard', 'profile'],
};
const PANEL = ['admin', 'manager', 'office_staff'];
export const requireRole = (user, roles, msg = 'Anda tidak punya akses untuk tindakan ini') => {
  if (!user || !roles.includes(user.role)) throw new HttpError(403, msg);
};
export const requireAdmin = u => requireRole(u, ['admin'], 'Hanya admin');
export const requireAdminOrManager = u => requireRole(u, ['admin', 'manager'], 'Hanya admin atau manager');
export const requirePanel = u => requireRole(u, PANEL, 'Akses panel admin diperlukan');
export const requirePos = u => requireRole(u, [...PANEL, 'cashier'], 'Akses kasir diperlukan');
