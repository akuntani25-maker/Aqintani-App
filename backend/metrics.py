"""Shared stock & cost helpers.

One place for the rules that were previously copied (and drifted) across routers:
- products.cost_price is the cost of ONE BOX; cost per unit (satuan) = cost_price / items_per_box
- warehouse_stock in a "dus" warehouse is counted in boxes, in a "satuan" warehouse in units
- products.stock is the total in units (see services.recalculate_product_stock)
All lookups are batched (one query per collection) instead of one query per item.
"""
from database import db


async def product_map(ids=None, fields=None):
    """Return {product_id: product} with only the fields needed for costing."""
    proj = {"_id": 0, "id": 1, "name": 1, "cost_price": 1, "items_per_box": 1, "category_id": 1}
    if fields:
        proj.update({f: 1 for f in fields})
    query = {"id": {"$in": list(ids)}} if ids is not None else {}
    docs = await db.products.find(query, proj).to_list(200000)
    return {p["id"]: p for p in docs}


async def warehouse_units():
    whs = await db.warehouses.find({}, {"_id": 0, "id": 1, "unit": 1}).to_list(100)
    return {w["id"]: w.get("unit", "satuan") for w in whs}


def ipb_of(prod):
    return (prod or {}).get("items_per_box", 1) or 1


def unit_cost(prod):
    """Cost of one unit (satuan)."""
    if not prod:
        return 0
    return (prod.get("cost_price", 0) or 0) / ipb_of(prod)


def item_units(item, prod, wh_units, default_wh="gudang_toko"):
    """Quantity of an order/transaction line converted to units (satuan)."""
    qty = item.get("quantity", 0) or 0
    wh = item.get("warehouse_id") or default_wh
    if wh_units.get(wh) == "dus":
        return qty * ipb_of(prod)
    return qty


def pos_cost(transaction, pmap):
    """COGS of a POS transaction. POS always sells units from Gudang Toko.
    Uses the unit cost saved on the line at sale time when present (new transactions),
    otherwise the product's current cost."""
    total = 0
    for it in transaction.get("items", []):
        saved = it.get("cost_price_unit")
        cu = saved if saved is not None else unit_cost(pmap.get(it.get("product_id", "")))
        total += cu * (it.get("quantity", 0) or 0)
    return total


def order_cost(order, pmap, wh_units):
    """COGS of a partner order: settled orders count only what was sold (qty_sold is in units)."""
    total = 0
    if order.get("is_settled") and order.get("settled_items"):
        for si in order["settled_items"]:
            q = si.get("qty_sold", 0) or 0
            if q > 0:
                total += q * unit_cost(pmap.get(si.get("product_id", "")))
        return total
    default_wh = order.get("warehouse_id") or "gudang_toko"
    for it in order.get("items", []):
        if it.get("source") == "external":
            # bought outside for this order: its cost is what was paid for it
            total += (it.get("external_cost", 0) or 0) * (it.get("quantity", 0) or 0)
            continue
        prod = pmap.get(it.get("product_id", ""))
        total += item_units(it, prod, wh_units, default_wh) * unit_cost(prod)
    return total


def order_units_sold(order, pmap, wh_units):
    if order.get("is_settled") and order.get("settled_items"):
        return sum(max(0, si.get("qty_sold", 0) or 0) for si in order["settled_items"])
    default_wh = order.get("warehouse_id") or "gudang_toko"
    return sum(item_units(it, pmap.get(it.get("product_id", "")), wh_units, default_wh) for it in order.get("items", []))


def is_low(prod):
    """Low stock = total units at or below the alert level. Missing fields count as 0."""
    try:
        return float(prod.get("stock", 0) or 0) <= float(prod.get("min_stock_alert", 0) or 0)
    except (TypeError, ValueError):
        return False


async def low_stock_products(limit=None):
    """Products at or below their alert level, lowest stock first.
    Done in Python rather than with $expr so it never fails on odd/missing fields."""
    docs = await db.products.find(
        {}, {"_id": 0, "id": 1, "name": 1, "barcode": 1, "stock": 1, "min_stock_alert": 1,
             "items_per_box": 1, "category_id": 1, "price": 1}
    ).to_list(200000)
    low = [p for p in docs if is_low(p)]
    for p in low:
        p.setdefault("stock", 0)
        p.setdefault("min_stock_alert", 0)
        p.setdefault("items_per_box", 1)
    low.sort(key=lambda p: (p.get("stock", 0) or 0))
    return low[:limit] if limit else low
