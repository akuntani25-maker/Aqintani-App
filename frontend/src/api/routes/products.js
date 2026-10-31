// Pengganti backend/routers/product_routes.py
import {
  db, supabase, uuid, nowIso, witaDate, num, notFound, badRequest, HttpError,
  requirePanel, ensureWarehouseStock, incStock, logAudit, lowStockProducts,
} from '../core';

const BUCKET = 'product-images';

async function whUnit(warehouseId) {
  const wh = await db.warehouses.findOne({ id: warehouseId });
  return wh?.unit;
}

export default function register(route) {
  // ---------- foto produk (Supabase Storage) ----------
  route('POST', '/products/upload-image/:id', async ({ user, params, body }) => {
    requirePanel(user);
    const product = await db.products.findOne({ id: params.id });
    if (!product) notFound('Produk tidak ditemukan');
    const file = body instanceof FormData ? body.get('file') : body?.file;
    if (!file) badRequest('File gambar tidak ada');
    const ext = (file.name || 'x.jpg').split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) badRequest('Format gambar tidak didukung (jpg/png/webp)');
    const path = `${params.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || `image/${ext}` });
    if (error) throw new HttpError(500, `Gagal upload gambar: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    await db.products.updateOne({ id: params.id }, { $set: { image_url: data.publicUrl } });
    return { image_url: data.publicUrl };
  });

  route('DELETE', '/products/image/:id', async ({ user, params }) => {
    requirePanel(user);
    const product = await db.products.findOne({ id: params.id });
    if (!product) notFound('Produk tidak ditemukan');
    const url = product.image_url || '';
    const marker = `/${BUCKET}/`;
    if (url.includes(marker)) await supabase.storage.from(BUCKET).remove([url.split(marker)[1]]);
    await db.products.updateOne({ id: params.id }, { $set: { image_url: '' } });
    return { message: 'Gambar berhasil dihapus' };
  });

  // ---------- kategori ----------
  route('GET', '/categories', async () => db.categories.find({}).sort('name', 1).toArray());
  route('POST', '/categories', async ({ user, body }) => {
    requirePanel(user);
    const doc = { id: uuid(), name: body.name, description: body.description || '', created_at: nowIso() };
    await db.categories.insertOne(doc);
    return doc;
  });
  route('PUT', '/categories/:id', async ({ user, params, body }) => {
    requirePanel(user);
    const r = await db.categories.findOneAndUpdate({ id: params.id }, { $set: { name: body.name, description: body.description || '' } });
    if (!r) notFound('Category not found');
    return r;
  });
  route('DELETE', '/categories/:id', async ({ user, params }) => {
    requirePanel(user);
    const r = await db.categories.deleteOne({ id: params.id });
    if (!r.deletedCount) notFound('Category not found');
    return { message: 'Category deleted' };
  });

  // ---------- produk ----------
  route('GET', '/products', async ({ query }) => {
    const filter = {};
    if (query.search) filter.$or = [{ name: { $icontains: query.search } }, { barcode: { $icontains: query.search } }];
    if (query.category_id) filter.category_id = query.category_id;
    if (query.page != null && query.page !== '') {
      const page = Math.max(1, num(query.page, 1)); const per = num(query.per_page, 15) || 15;
      const total = await db.products.countDocuments(filter);
      const data = await db.products.find(filter).sort('name', 1).skip((page - 1) * per).limit(per).toArray();
      return { data, total, page, per_page: per, total_pages: Math.ceil(total / per) };
    }
    return db.products.find(filter).sort('name', 1).toArray();
  });

  route('GET', '/products/barcode/:barcode', async ({ params }) => {
    const p = await db.products.findOne({ barcode: params.barcode });
    if (!p) notFound('Product not found');
    return p;
  });

  const autocomplete = async ({ query }) => {
    const q = query.q || '';
    if (!q) return [];
    const products = await db.products.find({ $or: [{ name: { $icontains: q } }, { barcode: { $icontains: q } }] }).sort('name', 1).limit(15).toArray();
    const sids = [...new Set(products.map(p => p.supplier_id).filter(Boolean))];
    const sups = sids.length ? await db.suppliers.find({ id: { $in: sids } }, { id: 1, name: 1 }).toArray() : [];
    const supMap = Object.fromEntries(sups.map(s => [s.id, s.name]));
    return products.map(p => ({
      id: p.id, name: p.name, barcode: p.barcode || '', stock: p.stock || 0,
      category_id: p.category_id || '', supplier_id: p.supplier_id || '',
      supplier_name: supMap[p.supplier_id] || '-', price: p.price || 0, cost_price: p.cost_price || 0,
      supplier_cost_price: p.supplier_cost_price || 0, box_price: p.box_price || 0,
      items_per_box: p.items_per_box || 1, min_stock_alert: p.min_stock_alert ?? 10,
      expiry_date: p.expiry_date || '', batch_number: p.batch_number || '', description: p.description || '',
      image_url: p.image_url || '',
    }));
  };
  route('GET', '/products/search-autocomplete', autocomplete);
  route('GET', '/products/search', autocomplete); // dipakai salah satu halaman lama; dulu tidak ada (404)

  route('GET', '/products/low-stock', async ({ query }) => {
    const list = await lowStockProducts();
    if (String(query.count_only) === 'true') return { count: list.length };
    return list;
  });

  route('POST', '/products/bulk', async ({ user, body }) => {
    requirePanel(user);
    const supplierId = body.supplier_id || '';
    const items = body.items || [];
    const initialPaid = num(body.initial_paid);
    const warehouseId = body.warehouse_id || 'gudang_utama';
    if (!supplierId || !items.length) badRequest('Supplier dan item harus diisi');
    const supplier = await db.suppliers.findOne({ id: supplierId });
    if (!supplier) notFound('Supplier tidak ditemukan');
    const unit = await whUnit(warehouseId);
    const now = nowIso();
    let totalPurchase = 0;
    const purchaseItems = []; const created = [];
    for (const item of items) {
      const stockDus = Math.trunc(num(item.stock));
      const ipb = num(item.items_per_box, 1) || 1;
      const supplierCost = num(item.supplier_cost_price);
      const costPrice = num(item.cost_price);
      const totalSatuan = Math.trunc(stockDus * ipb);
      if (stockDus <= 0) continue;
      const uc = supplierCost || costPrice;
      const qty = unit === 'satuan' ? totalSatuan : stockDus;
      if (item.existing_product_id) {
        const existing = await db.products.findOne({ id: item.existing_product_id });
        if (!existing) continue;
        await incStock(existing.id, warehouseId, qty);
        const upd = { updated_at: now };
        if (supplierCost > 0) upd.supplier_cost_price = supplierCost;
        await db.products.updateOne({ id: existing.id }, { $set: upd });
        purchaseItems.push({ product_id: existing.id, product_name: existing.name, quantity: stockDus, cost_price: uc, subtotal: uc * stockDus });
        created.push({ id: existing.id, name: existing.name, action: 'restock' });
      } else {
        const id = uuid();
        await db.products.insertOne({
          id, name: item.name || '', barcode: item.barcode || '', category_id: item.category_id || '', supplier_id: supplierId,
          stock: 0, price: num(item.price), cost_price: costPrice, supplier_cost_price: supplierCost || costPrice,
          box_price: num(item.box_price), items_per_box: ipb, expiry_date: '', batch_number: '', description: '',
          min_stock_alert: 10, image_url: '', created_at: now, updated_at: now,
        });
        await ensureWarehouseStock(id);
        await db.warehouse_stock.updateOne({ product_id: id, warehouse_id: warehouseId }, { $set: { stock: qty } }, { upsert: true });
        purchaseItems.push({ product_id: id, product_name: item.name || '', quantity: stockDus, cost_price: uc, subtotal: uc * stockDus });
        created.push({ id, name: item.name, action: 'new' });
      }
      totalPurchase += uc * stockDus;
    }
    if (purchaseItems.length) {
      const paid = Math.min(initialPaid, totalPurchase); const remaining = totalPurchase - paid;
      await db.purchases.insertOne({
        id: uuid(), purchase_number: body.invoice_number || '', supplier_id: supplierId, supplier_name: supplier.name,
        items: purchaseItems, total: totalPurchase, paid, remaining, warehouse_id: warehouseId,
        notes: `Pembelian bulk - ${purchaseItems.length} item` + (remaining > 0 ? ' (Tempo)' : ''),
        due_date: body.due_date || '', source: 'bulk_entry', created_at: now, date: witaDate(),
      });
      await logAudit(user, 'bulk_create', 'products', '', { supplier: supplier.name, items_count: created.length, total_purchase: totalPurchase });
    }
    return { message: `${created.length} barang berhasil diproses`, products: created, total_purchase: totalPurchase, remaining_debt: Math.max(0, totalPurchase - initialPaid) };
  });

  route('POST', '/products', async ({ user, body: data }) => {
    requirePanel(user);
    const now = nowIso();
    const ipb = num(data.items_per_box, 1) || 1;
    const warehouseId = data.warehouse_id || 'gudang_utama';
    const stock = Math.trunc(num(data.stock));
    const supplierCost = num(data.supplier_cost_price) || num(data.cost_price);
    const unit = await whUnit(warehouseId);
    const qty = unit === 'satuan' ? stock * ipb : stock;

    const addPurchase = async (productId, productName, source, note) => {
      if (!data.supplier_id || stock <= 0) return;
      const supplier = await db.suppliers.findOne({ id: data.supplier_id });
      const total = supplierCost * stock; const paid = Math.min(num(data.initial_paid), total); const remaining = total - paid;
      await db.purchases.insertOne({
        id: uuid(), purchase_number: data.invoice_number || '', supplier_id: data.supplier_id, supplier_name: supplier?.name || '',
        items: [{ product_id: productId, product_name: productName, quantity: stock, cost_price: supplierCost, subtotal: total }],
        total, paid, remaining, warehouse_id: warehouseId, notes: note + (remaining > 0 ? ' (Tempo)' : ''),
        due_date: data.due_date || '', source, created_at: now, date: witaDate(),
      });
    };

    if (data.is_restock && data.existing_product_id) {
      const existing = await db.products.findOne({ id: data.existing_product_id });
      if (!existing) notFound('Produk tidak ditemukan');
      if (stock > 0) {
        await incStock(existing.id, warehouseId, qty);
        await addPurchase(existing.id, existing.name, 'product_restock', `Restok - ${existing.name}`);
      }
      const upd = { updated_at: now };
      if (num(data.supplier_cost_price)) upd.supplier_cost_price = num(data.supplier_cost_price);
      await db.products.updateOne({ id: existing.id }, { $set: upd });
      await logAudit(user, 'restock', 'product', existing.id, { name: existing.name, qty: stock });
      return db.products.findOne({ id: existing.id });
    }

    const doc = {
      id: uuid(), name: data.name, barcode: data.barcode || '', category_id: data.category_id || '', supplier_id: data.supplier_id || '',
      stock: 0, price: num(data.price), cost_price: num(data.cost_price), supplier_cost_price: supplierCost,
      box_price: num(data.box_price), items_per_box: ipb, expiry_date: data.expiry_date || '', batch_number: data.batch_number || '',
      description: data.description || '', image: data.image || '', min_stock_alert: Math.trunc(num(data.min_stock_alert, 10)),
      invoice_number: data.invoice_number || '', due_date: data.due_date || '', initial_paid: num(data.initial_paid),
      created_at: now, updated_at: now,
    };
    await db.products.insertOne(doc);
    await ensureWarehouseStock(doc.id);
    if (stock > 0) {
      await db.warehouse_stock.updateOne({ product_id: doc.id, warehouse_id: warehouseId }, { $set: { stock: qty } }, { upsert: true });
      await addPurchase(doc.id, data.name, 'product_entry', `Pembelian awal - ${data.name}`);
    }
    return db.products.findOne({ id: doc.id });
  });

  route('PUT', '/products/:id', async ({ user, params, body: data }) => {
    requirePanel(user);
    const old = await db.products.findOne({ id: params.id });
    if (!old) notFound('Product not found');
    const upd = { ...data };
    ['warehouse_id', 'stock', 'initial_paid', 'id', '_id', 'is_restock', 'existing_product_id'].forEach(k => delete upd[k]);
    ['price', 'cost_price', 'supplier_cost_price', 'box_price', 'items_per_box'].forEach(k => { if (k in upd) upd[k] = num(upd[k]); });
    if ('items_per_box' in upd) upd.items_per_box = upd.items_per_box || 1;
    if ('min_stock_alert' in upd) upd.min_stock_alert = Math.trunc(num(upd.min_stock_alert));
    upd.updated_at = nowIso();
    if (num(old.cost_price) !== num(data.cost_price) || num(old.price) !== num(data.price)) {
      await db.price_history.insertOne({
        id: uuid(), product_id: params.id, product_name: data.name, old_cost_price: old.cost_price || 0, new_cost_price: num(data.cost_price),
        old_price: old.price || 0, new_price: num(data.price), changed_by: user?.name || '', changed_at: nowIso(),
      });
    }
    await db.products.updateOne({ id: params.id }, { $set: upd });
    await ensureWarehouseStock(params.id);
    await logAudit(user, 'update', 'product', params.id, { name: data.name });
    return db.products.findOne({ id: params.id });
  });

  route('GET', '/products/:id/price-history', async ({ params }) =>
    db.price_history.find({ product_id: params.id }).sort('changed_at', -1).limit(100).toArray());

  route('GET', '/products/:id/price-comparison', async ({ user, params }) => {
    requirePanel(user);
    const purchases = await db.purchases.find({}).toArray();
    const out = {};
    for (const pu of purchases) {
      for (const it of pu.items || []) {
        if (it.product_id !== params.id) continue;
        const sid = pu.supplier_id;
        out[sid] = out[sid] || { supplier_id: sid, supplier_name: pu.supplier_name, prices: [], last_price: 0, total_qty: 0 };
        out[sid].prices.push({ price: it.cost_price || 0, date: pu.date || '', quantity: it.quantity || 0 });
        out[sid].last_price = it.cost_price || 0;
        out[sid].total_qty += num(it.quantity);
      }
    }
    return Object.values(out);
  });

  route('DELETE', '/products/:id', async ({ user, params }) => {
    requirePanel(user);
    const p = await db.products.findOne({ id: params.id });
    const r = await db.products.deleteOne({ id: params.id });
    if (!r.deletedCount) notFound('Product not found');
    await db.warehouse_stock.deleteMany({ product_id: params.id });
    await logAudit(user, 'delete', 'product', params.id, { name: p?.name || '' });
    return { message: 'Product deleted' };
  });

  route('GET', '/products/:id', async ({ params }) => {
    const p = await db.products.findOne({ id: params.id });
    if (!p) notFound('Product not found');
    return p;
  });
}

export { HttpError };
