from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import os

from database import db
from metrics import low_stock_products as fetch_low_stock, product_map, warehouse_units, pos_cost, order_cost, order_units_sold, item_units
from auth import get_current_user, require_admin, require_admin_panel_access

router = APIRouter()


@router.get("/dashboard/stats")
async def get_dashboard_stats(admin: dict = Depends(require_admin_panel_access)):
    WITA = timezone(timedelta(hours=8))
    now_wita = datetime.now(WITA)
    today = now_wita.strftime("%Y-%m-%d") if now_wita.hour < 20 else (now_wita + timedelta(days=1)).strftime("%Y-%m-%d")
    today_transactions = await db.transactions.find({"date": today}, {"_id": 0}).to_list(10000)
    today_sales = sum(t.get("total", 0) for t in today_transactions)
    total_products = await db.products.count_documents({})
    low_list = await fetch_low_stock()
    low_stock_count = len(low_list)

    # last 7 days in ONE query instead of seven, ending on the same business date as "today"
    today_dt = datetime.strptime(today, "%Y-%m-%d")
    days = [(today_dt - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    week_txns = await db.transactions.find(
        {"date": {"$gte": days[0], "$lte": days[-1]}}, {"_id": 0, "date": 1, "total": 1}
    ).to_list(100000)
    by_day = {d: {"date": d, "sales": 0, "count": 0} for d in days}
    for t in week_txns:
        if t.get("date") in by_day:
            by_day[t["date"]]["sales"] += t.get("total", 0)
            by_day[t["date"]]["count"] += 1
    last_7_days = [by_day[d] for d in days]

    # Warehouse inventory value + chart
    warehouses = await db.warehouses.find({}, {"_id": 0}).to_list(100)
    wh_unit_map = {w["id"]: w.get("unit", "satuan") for w in warehouses}
    all_products = await db.products.find({}, {"_id": 0, "id": 1, "cost_price": 1, "items_per_box": 1}).to_list(100000)
    prod_map = {p["id"]: p for p in all_products}
    all_wh_stocks = await db.warehouse_stock.find({}, {"_id": 0}).to_list(100000)
    warehouse_values = {}
    for s in all_wh_stocks:
        wid = s.get("warehouse_id", "")
        pid = s.get("product_id", "")
        stk = s.get("stock", 0)
        prod = prod_map.get(pid)
        if not prod:
            continue
        ipb = prod.get("items_per_box", 1) or 1
        cost_price = prod.get("cost_price", 0) or 0
        wh_unit = wh_unit_map.get(wid, "satuan")
        if wh_unit == "dus":
            # Stock in boxes, cost_price is per box
            item_value = stk * cost_price
        else:
            # Stock in units, convert cost_price to per-unit
            item_value = stk * (cost_price / ipb)
        warehouse_values[wid] = warehouse_values.get(wid, 0) + item_value

    warehouse_chart = []
    total_inventory = 0
    for w in warehouses:
        val = warehouse_values.get(w["id"], 0)
        total_inventory += val
        if val > 0:
            warehouse_chart.append({"name": w.get("name", w["id"]), "value": round(val)})

    # Stock movement today - exclude import data
    today_purchases = await db.purchases.find({"date": today, "source": {"$ne": "import"}}, {"_id": 0}).to_list(1000)
    stock_in_today = sum(
        sum(item.get("subtotal", 0) for item in p.get("items", []))
        for p in today_purchases
    )

    # Helper: get cost value per unit for a product
    def get_unit_cost(product_id):
        prod = prod_map.get(product_id)
        if not prod:
            return 0
        cp = prod.get("cost_price", 0) or 0
        ipb = prod.get("items_per_box", 1) or 1
        return cp / ipb  # cost_price is per box, divide by items_per_box for per-unit

    # POS transactions (always satuan/unit from gudang_toko)
    stock_out_today = sum(
        sum(get_unit_cost(item.get("product_id", "")) * item.get("quantity", 0) for item in t.get("items", []))
        for t in today_transactions
    )

    # Partner orders today (barang keluar via kios mitra)
    today_partner_orders = await db.partner_orders.find({"date": today}, {"_id": 0}).to_list(10000)
    partner_stock_out_today = 0
    for o in today_partner_orders:
        for item in o.get("items", []):
            pid = item.get("product_id", "")
            qty = item.get("quantity", 0)
            prod = prod_map.get(pid)
            if not prod:
                continue
            cp = prod.get("cost_price", 0) or 0
            ipb = prod.get("items_per_box", 1) or 1
            wh_id = item.get("warehouse_id") or o.get("warehouse_id", "gudang_toko")
            wh_unit = wh_unit_map.get(wh_id, "satuan")
            if wh_unit == "dus":
                partner_stock_out_today += qty * cp  # cost_price per box
            else:
                partner_stock_out_today += qty * (cp / ipb)  # cost_price per unit

    # Farmer debt transactions (always satuan from gudang_toko)
    today_farmer_txns = await db.farmer_transactions.find({"date": today}, {"_id": 0}).to_list(10000)
    farmer_stock_out = sum(
        sum(get_unit_cost(item.get("product_id", "")) * item.get("quantity", 0) for item in t.get("items", []))
        for t in today_farmer_txns
    )
    stock_out_today_pos = stock_out_today + farmer_stock_out
    stock_out_today_partner = partner_stock_out_today
    stock_out_today_total = stock_out_today + partner_stock_out_today

    # Debts
    unpaid_purchases = await db.purchases.find({"remaining": {"$gt": 0}}, {"_id": 0}).to_list(10000)
    total_supplier_debt = sum(p.get("remaining", 0) for p in unpaid_purchases)
    partner_stores = await db.partner_stores.find({}, {"_id": 0}).to_list(10000)
    total_partner_debt = sum(ps.get("current_debt", 0) for ps in partner_stores)

    # Bon mitra per vehicle
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(100)
    vehicle_map = {v["id"]: v.get("name", v["id"]) for v in vehicles}
    partner_debt_by_vehicle = {}
    for ps in partner_stores:
        vid = ps.get("vehicle_id", "")
        vname = vehicle_map.get(vid, "Belum Ditugaskan") if vid else "Belum Ditugaskan"
        if vname not in partner_debt_by_vehicle:
            partner_debt_by_vehicle[vname] = 0
        partner_debt_by_vehicle[vname] += ps.get("current_debt", 0)
    partner_debt_vehicles = [{"vehicle": k, "debt": v} for k, v in partner_debt_by_vehicle.items() if v > 0]

    # Personal loans (piutang pribadi) & farmer debts (hutang petani)
    personal_loans = await db.personal_loans.find({"remaining": {"$gt": 0}}, {"_id": 0, "remaining": 1}).to_list(10000)
    total_personal_loans = sum(loan.get("remaining", 0) for loan in personal_loans)
    farmers = await db.farmers.find({}, {"_id": 0, "current_debt": 1}).to_list(10000)
    total_farmer_debt = sum(f.get("current_debt", 0) for f in farmers)

    # Vehicle stock value (barang kondisional di mobil)
    v_stocks = await db.vehicle_stock.find({"remaining_qty": {"$gt": 0}}, {"_id": 0}).to_list(10000)
    total_vehicle_stock = 0
    for vs in v_stocks:
        prod = prod_map.get(vs["product_id"])
        if prod:
            cp = prod.get("cost_price", 0) or 0
            ipb = prod.get("items_per_box", 1) or 1
            total_vehicle_stock += (cp / ipb) * vs["remaining_qty"]
    total_vehicle_stock = round(total_vehicle_stock)

    total_assets = total_inventory + total_vehicle_stock + total_partner_debt + total_personal_loans + total_farmer_debt - total_supplier_debt

    # Due this month
    now = datetime.now(timezone.utc)
    month_start = now.strftime("%Y-%m-01")
    month_end = f"{now.strftime('%Y-%m')}-31"
    due_this_month = await db.purchases.find(
        {"due_date": {"$gte": month_start, "$lte": month_end}, "remaining": {"$gt": 0}}, {"_id": 0}
    ).to_list(100)

    # Low stock product details
    low_stock_products = [
        {k: p.get(k) for k in ("id", "name", "stock", "min_stock_alert", "items_per_box")} for p in low_list[:10]
    ]

    return {
        "today_sales": today_sales, "today_transactions": len(today_transactions),
        "total_products": total_products, "low_stock_count": low_stock_count,
        "low_stock_products": low_stock_products,
        "last_7_days": last_7_days, "inventory_value": total_inventory,
        "warehouse_chart": warehouse_chart, "stock_in_today": stock_in_today,
        "stock_out_today": stock_out_today_total,
        "stock_out_today_pos": stock_out_today_pos,
        "stock_out_today_partner": stock_out_today_partner,
        "total_supplier_debt": total_supplier_debt,
        "total_partner_debt": total_partner_debt,
        "partner_debt_vehicles": partner_debt_vehicles,
        "total_personal_loans": total_personal_loans,
        "total_farmer_debt": total_farmer_debt, "total_assets": total_assets,
        "total_vehicle_stock": total_vehicle_stock,
        "due_this_month": [{k: v for k, v in d.items() if k != "_id"} for d in due_this_month]
    }


@router.get("/dashboard/due-calendar")
async def get_due_calendar(year: int, month: int, admin: dict = Depends(require_admin_panel_access)):
    month_start = f"{year:04d}-{month:02d}-01"
    month_end = f"{year:04d}-{month:02d}-31"
    purchases = await db.purchases.find(
        {"due_date": {"$gte": month_start, "$lte": month_end}, "remaining": {"$gt": 0}}, {"_id": 0}
    ).to_list(1000)
    return [{k: v for k, v in p.items() if k != "_id"} for p in purchases]


# ============= REPORTS =============
@router.get("/reports/daily")
async def get_daily_report(date: str, admin: dict = Depends(require_admin_panel_access)):
    transactions = await db.transactions.find({"date": date}, {"_id": 0}).to_list(1000)
    total_sales = sum(t["total"] for t in transactions)
    payment_methods = {}
    for t in transactions:
        method = t["payment_method"]
        payment_methods[method] = payment_methods.get(method, 0) + t["total"]
    return {
        "date": date, "total_sales": total_sales,
        "total_transactions": len(transactions), "payment_methods": payment_methods,
        "transactions": transactions
    }


@router.get("/reports/monthly")
async def get_monthly_report(year: int, month: int, admin: dict = Depends(require_admin_panel_access)):
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year+1}-01-01" if month == 12 else f"{year}-{month+1:02d}-01"
    transactions = await db.transactions.find({"date": {"$gte": start_date, "$lt": end_date}}, {"_id": 0}).to_list(10000)
    total_sales = sum(t["total"] for t in transactions)
    daily_sales = {}
    for t in transactions:
        date = t["date"]
        daily_sales[date] = daily_sales.get(date, 0) + t["total"]
    return {"year": year, "month": month, "total_sales": total_sales, "total_transactions": len(transactions), "daily_sales": daily_sales}


@router.get("/reports/sales-detail")
async def get_sales_detail_report(date_from: str, date_to: str, admin: dict = Depends(require_admin_panel_access)):
    transactions = await db.transactions.find({"date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}).to_list(10000)
    product_ids = set()
    for t in transactions:
        for item in t.get("items", []):
            product_ids.add(item["product_id"])
    products = {}
    if product_ids:
        for p in await db.products.find({"id": {"$in": list(product_ids)}}, {"_id": 0}).to_list(10000):
            products[p["id"]] = p
    rows = []
    total_sales = total_cost = total_margin = 0
    for t in transactions:
        for item in t.get("items", []):
            qty = item["quantity"]
            if qty <= 0:
                continue
            product = products.get(item["product_id"], {})
            ipb = product.get("items_per_box", 1) or 1
            cost_per_unit = (product.get("cost_price", 0) or 0) / ipb
            sell_price = item["price"]
            total_sell = sell_price * qty
            total_cost_item = cost_per_unit * qty
            margin = total_sell - total_cost_item
            rows.append({
                "date": t["date"], "time": t.get("created_at", ""),
                "transaction_number": t.get("transaction_number", ""),
                "product_name": item["product_name"], "quantity": qty,
                "cost_price": round(cost_per_unit, 2), "sell_price": sell_price,
                "total_sell": total_sell, "total_cost": round(total_cost_item, 2),
                "margin": round(margin, 2)
            })
            total_sales += total_sell
            total_cost += total_cost_item
            total_margin += margin
    return {"date_from": date_from, "date_to": date_to, "rows": rows, "total_sales": round(total_sales, 2), "total_cost": round(total_cost, 2), "total_margin": round(total_margin, 2), "total_items": len(rows)}


@router.get("/reports/partner-sales-detail")
async def get_partner_sales_detail_report(date_from: str, date_to: str, admin: dict = Depends(require_admin_panel_access)):
    orders = await db.partner_orders.find({"date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}).to_list(10000)
    product_ids = set()
    for o in orders:
        for item in o.get("items", []):
            product_ids.add(item["product_id"])
    products = {}
    if product_ids:
        for p in await db.products.find({"id": {"$in": list(product_ids)}}, {"_id": 0}).to_list(10000):
            products[p["id"]] = p
    warehouses_list = await db.warehouses.find({}, {"_id": 0}).to_list(100)
    wh_map = {w["id"]: w for w in warehouses_list}
    rows = []
    total_sales = total_cost = total_margin = 0
    for o in orders:
        # Use settled quantities if order was settled
        if o.get("is_settled") and o.get("settled_items"):
            settled_map = {si["product_id"]: si for si in o["settled_items"]}
            for item in o.get("items", []):
                si = settled_map.get(item["product_id"])
                qty_sold = si["qty_sold"] if si else item["quantity"]
                if qty_sold <= 0:
                    continue
                product = products.get(item["product_id"], {})
                ipb = product.get("items_per_box", 1) or 1
                cost_per_unit = (product.get("cost_price", 0) or 0) / ipb
                sell_price_per_unit = si["price"] if si else item["price"]
                total_sell = qty_sold * sell_price_per_unit
                total_cost_item = cost_per_unit * qty_sold
                margin = total_sell - total_cost_item
                rows.append({
                    "date": o["date"], "order_number": o.get("order_number", ""),
                    "partner_store_name": o.get("partner_store_name", ""),
                    "product_name": item["product_name"],
                    "quantity_original": qty_sold, "unit_original": "satuan",
                    "quantity_satuan": qty_sold,
                    "cost_price_per_unit": round(cost_per_unit, 2),
                    "sell_price_per_unit": round(sell_price_per_unit, 2),
                    "total_sell": round(total_sell, 2), "total_cost": round(total_cost_item, 2),
                    "margin": round(margin, 2)
                })
                total_sales += total_sell
                total_cost += total_cost_item
                total_margin += margin
        else:
            for item in o.get("items", []):
                if item["quantity"] <= 0:
                    continue
                product = products.get(item["product_id"], {})
                ipb = product.get("items_per_box", 1) or 1
                item_wh_id = item.get("warehouse_id") or o.get("warehouse_id", "gudang_utama")
                wh = wh_map.get(item_wh_id, {})
                wh_unit = wh.get("unit", "satuan")
                qty_satuan = item["quantity"] * ipb if wh_unit == "dus" else item["quantity"]
                cost_per_unit = (product.get("cost_price", 0) or 0) / ipb
                sell_price_per_unit = item["price"]
                total_sell = item.get("subtotal") or (item["price"] * qty_satuan)
                total_cost_item = cost_per_unit * qty_satuan
                margin = total_sell - total_cost_item
                rows.append({
                    "date": o["date"], "order_number": o.get("order_number", ""),
                    "partner_store_name": o.get("partner_store_name", ""),
                    "product_name": item["product_name"],
                    "quantity_original": item["quantity"], "unit_original": wh_unit,
                    "quantity_satuan": qty_satuan,
                    "cost_price_per_unit": round(cost_per_unit, 2),
                    "sell_price_per_unit": round(sell_price_per_unit, 2),
                    "total_sell": round(total_sell, 2), "total_cost": round(total_cost_item, 2),
                    "margin": round(margin, 2)
                })
                total_sales += total_sell
                total_cost += total_cost_item
                total_margin += margin
    return {"date_from": date_from, "date_to": date_to, "rows": rows, "total_sales": round(total_sales, 2), "total_cost": round(total_cost, 2), "total_margin": round(total_margin, 2), "total_items": len(rows)}


@router.get("/reports/best-sellers")
async def get_best_sellers_report(date_from: str, date_to: str, admin: dict = Depends(require_admin_panel_access)):
    transactions = await db.transactions.find({"date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}).to_list(10000)
    orders = await db.partner_orders.find({"date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}).to_list(10000)
    all_product_ids = set()
    for t in transactions:
        for item in t.get("items", []):
            all_product_ids.add(item["product_id"])
    for o in orders:
        for item in o.get("items", []):
            all_product_ids.add(item["product_id"])
    products = {}
    if all_product_ids:
        for p in await db.products.find({"id": {"$in": list(all_product_ids)}}, {"_id": 0}).to_list(10000):
            products[p["id"]] = p
    warehouses_list = await db.warehouses.find({}, {"_id": 0}).to_list(100)
    wh_map = {w["id"]: w for w in warehouses_list}
    agg = {}
    for t in transactions:
        for item in t.get("items", []):
            if item["quantity"] <= 0:
                continue
            pid = item["product_id"]
            if pid not in agg:
                agg[pid] = {"product_name": item["product_name"], "qty_pos": 0, "qty_partner": 0, "revenue_pos": 0, "revenue_partner": 0, "cost_total": 0}
            agg[pid]["qty_pos"] += item["quantity"]
            agg[pid]["revenue_pos"] += item["subtotal"]
            product = products.get(pid, {})
            ipb = product.get("items_per_box", 1) or 1
            cost_per_unit = (product.get("cost_price", 0) or 0) / ipb
            agg[pid]["cost_total"] += cost_per_unit * item["quantity"]
    for o in orders:
        # Use settled quantities if order was settled
        if o.get("is_settled") and o.get("settled_items"):
            for si in o["settled_items"]:
                if si.get("qty_sold", 0) <= 0:
                    continue
                pid = si["product_id"]
                if pid not in agg:
                    agg[pid] = {"product_name": si["product_name"], "qty_pos": 0, "qty_partner": 0, "revenue_pos": 0, "revenue_partner": 0, "cost_total": 0}
                product = products.get(pid, {})
                ipb = product.get("items_per_box", 1) or 1
                qty_satuan = si["qty_sold"]
                agg[pid]["qty_partner"] += qty_satuan
                agg[pid]["revenue_partner"] += qty_satuan * si["price"]
                cost_per_unit = (product.get("cost_price", 0) or 0) / ipb
                agg[pid]["cost_total"] += cost_per_unit * qty_satuan
        else:
            for item in o.get("items", []):
                if item["quantity"] <= 0:
                    continue
                pid = item["product_id"]
                if pid not in agg:
                    agg[pid] = {"product_name": item["product_name"], "qty_pos": 0, "qty_partner": 0, "revenue_pos": 0, "revenue_partner": 0, "cost_total": 0}
                product = products.get(pid, {})
                ipb = product.get("items_per_box", 1) or 1
                item_wh_id = item.get("warehouse_id") or o.get("warehouse_id", "gudang_utama")
                wh = wh_map.get(item_wh_id, {})
                wh_unit = wh.get("unit", "satuan")
                qty_satuan = item["quantity"] * ipb if wh_unit == "dus" else item["quantity"]
                agg[pid]["qty_partner"] += qty_satuan
                agg[pid]["revenue_partner"] += item["subtotal"]
                cost_per_unit = (product.get("cost_price", 0) or 0) / ipb
                agg[pid]["cost_total"] += cost_per_unit * qty_satuan
    rows = []
    for pid, data in agg.items():
        total_qty = data["qty_pos"] + data["qty_partner"]
        total_revenue = data["revenue_pos"] + data["revenue_partner"]
        total_cost = data["cost_total"]
        margin = total_revenue - total_cost
        rows.append({
            "product_id": pid, "product_name": data["product_name"],
            "qty_pos": data["qty_pos"], "qty_partner": data["qty_partner"],
            "qty_total": total_qty, "revenue_pos": round(data["revenue_pos"], 2),
            "revenue_partner": round(data["revenue_partner"], 2),
            "revenue_total": round(total_revenue, 2), "cost_total": round(total_cost, 2),
            "margin": round(margin, 2)
        })
    rows.sort(key=lambda x: x["revenue_total"], reverse=True)
    return {"date_from": date_from, "date_to": date_to, "rows": rows, "total_products": len(rows)}


# ============= ANALYTICS =============
@router.get("/analytics/products")
async def get_product_analytics(admin: dict = Depends(require_admin_panel_access)):
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    transactions = await db.transactions.find({"date": {"$gte": thirty_days_ago}}, {"_id": 0, "items": 1}).to_list(10000)
    product_sales = {}
    for trans in transactions:
        for item in trans.get("items", []):
            pid = item.get("product_id")
            if pid:
                if pid not in product_sales:
                    product_sales[pid] = {"id": pid, "name": item.get("product_name"), "quantity": 0, "revenue": 0}
                product_sales[pid]["quantity"] += item.get("quantity", 0)
                product_sales[pid]["revenue"] += item.get("subtotal", 0)
    fast_moving = sorted(product_sales.values(), key=lambda x: x["quantity"], reverse=True)[:10]
    slow_moving = sorted(product_sales.values(), key=lambda x: x["quantity"])[:10]
    return {"fast_moving": fast_moving, "slow_moving": slow_moving}


@router.get("/analytics/summary")
async def get_analytics_summary(days: int = 30, admin: dict = Depends(require_admin_panel_access)):
    """Last N days (default 30), POS + partner orders, with real cost per unit.
    Returns the fields the Analytics page reads (total_revenue, daily_trend, ...);
    the old monthly_* fields are kept for anything else that still uses them."""
    days = max(1, min(days, 366))
    WITA = timezone(timedelta(hours=8))
    today = datetime.now(WITA).strftime("%Y-%m-%d")
    start = (datetime.now(WITA) - timedelta(days=days - 1)).strftime("%Y-%m-%d")

    txns = await db.transactions.find(
        {"date": {"$gte": start, "$lte": today}, "status": {"$ne": "returned"}}, {"_id": 0}
    ).to_list(100000)
    orders = await db.partner_orders.find(
        {"date": {"$gte": start, "$lte": today}, "status": {"$nin": ["cancelled", "canceled"]}}, {"_id": 0}
    ).to_list(100000)
    pids = {it.get("product_id") for t in txns for it in t.get("items", [])}
    pids |= {it.get("product_id") for o in orders for it in o.get("items", [])}
    pids |= {si.get("product_id") for o in orders for si in (o.get("settled_items") or [])}
    pmap = await product_map(pids)
    wh_units = await warehouse_units()
    cats = {c["id"]: c["name"] for c in await db.categories.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)}

    pos_rev = sum(t.get("total", 0) for t in txns)
    kios_rev = sum(o.get("total", 0) for o in orders)
    cost = sum(pos_cost(t, pmap) for t in txns) + sum(order_cost(o, pmap, wh_units) for o in orders)
    units_sold = sum(it.get("quantity", 0) or 0 for t in txns for it in t.get("items", []))
    units_sold += sum(order_units_sold(o, pmap, wh_units) for o in orders)

    trend = {}
    d = datetime.strptime(start, "%Y-%m-%d")
    for _ in range(days):
        k = d.strftime("%Y-%m-%d")
        trend[k] = {"date": k, "revenue": 0, "pos": 0, "partner": 0, "transactions": 0}
        d += timedelta(days=1)
    for t in txns:
        row = trend.get(t.get("date"))
        if row:
            row["revenue"] += t.get("total", 0); row["pos"] += t.get("total", 0); row["transactions"] += 1
    for o in orders:
        row = trend.get(o.get("date"))
        if row:
            row["revenue"] += o.get("total", 0); row["partner"] += o.get("total", 0); row["transactions"] += 1

    by_cat, by_prod = {}, {}
    def add_line(pid, name, units, value):
        cname = cats.get((pmap.get(pid) or {}).get("category_id", ""), "Tanpa Kategori")
        by_cat[cname] = by_cat.get(cname, 0) + value
        key = pid or name
        row = by_prod.setdefault(key, {"name": name or (pmap.get(pid) or {}).get("name", "-"), "quantity": 0, "revenue": 0})
        row["quantity"] += units; row["revenue"] += value
    for t in txns:
        for it in t.get("items", []):
            add_line(it.get("product_id"), it.get("product_name"), it.get("quantity", 0) or 0,
                     it.get("subtotal", (it.get("price", 0) or 0) * (it.get("quantity", 0) or 0)))
    for o in orders:
        dwh = o.get("warehouse_id") or "gudang_toko"
        for it in o.get("items", []):
            prod = pmap.get(it.get("product_id", ""))
            add_line(it.get("product_id"), it.get("product_name"), item_units(it, prod, wh_units, dwh),
                     it.get("subtotal", 0) or 0)

    revenue = pos_rev + kios_rev
    n_orders = len(txns) + len(orders)
    month_start = datetime.now(WITA).strftime("%Y-%m-01")
    month_txns = [t for t in txns if t.get("date", "") >= month_start]
    month_purchases = await db.purchases.find({"date": {"$gte": month_start}}, {"_id": 0, "total": 1, "remaining": 1}).to_list(10000)
    return {
        "period": {"from": start, "to": today, "days": days},
        "total_revenue": round(revenue),
        "pos_revenue": round(pos_rev),
        "partner_revenue": round(kios_rev),
        "total_cost": round(cost),
        "gross_profit": round(revenue - cost),
        "margin_pct": round((revenue - cost) / revenue * 100, 1) if revenue else 0,
        "total_orders": n_orders,
        "pos_transactions": len(txns),
        "partner_orders": len(orders),
        "total_products_sold": round(units_sold, 2),
        "avg_order_value": round(revenue / n_orders) if n_orders else 0,
        "daily_trend": [{**v, "revenue": round(v["revenue"])} for v in trend.values()],
        "category_breakdown": sorted(
            [{"name": k, "value": round(v)} for k, v in by_cat.items() if v > 0], key=lambda x: -x["value"]),
        "top_products": sorted(by_prod.values(), key=lambda x: -x["quantity"])[:10],
        # legacy keys
        "monthly_sales": sum(t.get("total", 0) for t in month_txns),
        "monthly_transactions": len(month_txns),
        "monthly_purchases": sum(p.get("total", 0) for p in month_purchases),
        "monthly_purchases_unpaid": sum(p.get("remaining", 0) for p in month_purchases),
        "estimated_margin": round(revenue - cost),
        "chart_data": [{"date": v["date"], "sales": v["pos"], "transactions": v["transactions"]} for v in trend.values()],
    }


# ============= PROFIT & LOSS REPORT =============
@router.get("/reports/profit-loss")
async def get_profit_loss_report(date_from: str, date_to: str, admin: dict = Depends(require_admin_panel_access)):
    """Laporan Laba/Rugi berdasarkan HPP aktual per produk"""
    # POS Transactions
    transactions = await db.transactions.find(
        {"date": {"$gte": date_from, "$lte": date_to}, "status": {"$ne": "returned"}},
        {"_id": 0}
    ).to_list(100000)

    # Partner Orders (cancelled orders are not sales)
    partner_orders = await db.partner_orders.find(
        {"date": {"$gte": date_from, "$lte": date_to}, "status": {"$nin": ["cancelled", "canceled"]}},
        {"_id": 0}
    ).to_list(100000)

    # one batched product lookup; costs follow the shared rules in metrics.py
    # (items taken from a "dus" warehouse are converted to units before costing)
    pids = {it.get("product_id") for t in transactions for it in t.get("items", [])}
    pids |= {it.get("product_id") for o in partner_orders for it in o.get("items", [])}
    pids |= {si.get("product_id") for o in partner_orders for si in (o.get("settled_items") or [])}
    pmap = await product_map(pids)
    wh_units = await warehouse_units()

    daily = {}
    pos_revenue = pos_cogs = 0
    for t in transactions:
        c = pos_cost(t, pmap)
        pos_revenue += t.get("total", 0)
        pos_cogs += c
        row = daily.setdefault(t.get("date", ""), {"date": t.get("date", ""), "revenue": 0, "cogs": 0})
        row["revenue"] += t.get("total", 0)
        row["cogs"] += c

    partner_revenue = partner_cogs = 0
    for o in partner_orders:
        c = order_cost(o, pmap, wh_units)
        partner_revenue += o.get("total", 0)
        partner_cogs += c
        row = daily.setdefault(o.get("date", ""), {"date": o.get("date", ""), "revenue": 0, "cogs": 0})
        row["revenue"] += o.get("total", 0)
        row["cogs"] += c

    total_revenue = pos_revenue + partner_revenue
    total_cogs = pos_cogs + partner_cogs
    gross_profit = total_revenue - total_cogs
    margin_pct = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0

    daily_data = sorted(
        [{"date": v["date"], "revenue": round(v["revenue"]), "cogs": round(v["cogs"]), "profit": round(v["revenue"] - v["cogs"])} for v in daily.values()],
        key=lambda x: x["date"]
    )

    return {
        "period": {"from": date_from, "to": date_to},
        "pos_revenue": round(pos_revenue),
        "pos_cogs": round(pos_cogs),
        "partner_revenue": round(partner_revenue),
        "partner_cogs": round(partner_cogs),
        "total_revenue": round(total_revenue),
        "total_cogs": round(total_cogs),
        "gross_profit": round(gross_profit),
        "margin_percent": round(margin_pct, 1),
        "total_transactions": len(transactions),
        "total_partner_orders": len(partner_orders),
        "daily_data": daily_data,
    }


# ============= AI STOCK FORECAST =============
@router.post("/agriculture/lombok-info")
async def get_lombok_agriculture_info(admin: dict = Depends(get_current_user)):
    """Info cuaca, berita pertanian real, & rekomendasi AI untuk Lombok."""
    import httpx
    from bs4 import BeautifulSoup
    from emergentintegrations.llm.openai import LlmChat, UserMessage

    WMO_CODES = {
        0: "Cerah", 1: "Sebagian Cerah", 2: "Berawan Sebagian", 3: "Berawan",
        45: "Berkabut", 48: "Kabut Tebal",
        51: "Gerimis Ringan", 53: "Gerimis", 55: "Gerimis Lebat",
        61: "Hujan Ringan", 63: "Hujan Sedang", 65: "Hujan Lebat",
        80: "Hujan Singkat", 81: "Hujan Singkat Sedang", 82: "Hujan Singkat Lebat",
        95: "Hujan Petir", 96: "Hujan Petir + Hujan Es", 99: "Hujan Petir Hebat"
    }

    regions = [
        {"name": "Lombok Barat", "city": "Mataram", "lat": -8.5833, "lon": 116.1167},
        {"name": "Lombok Tengah", "city": "Praya", "lat": -8.7167, "lon": 116.2833},
        {"name": "Lombok Timur", "city": "Selong", "lat": -8.6500, "lon": 116.5500},
        {"name": "Lombok Utara", "city": "Tanjung", "lat": -8.3500, "lon": 116.3000},
    ]

    weather_data = []
    news_articles = []

    async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }) as client:
        # 1. Fetch weather
        for region in regions:
            try:
                resp = await client.get("https://api.open-meteo.com/v1/forecast", params={
                    "latitude": region["lat"], "longitude": region["lon"],
                    "current": "temperature_2m,relative_humidity_2m,rain,wind_speed_10m,weather_code",
                    "daily": "temperature_2m_max,temperature_2m_min,rain_sum,precipitation_probability_max",
                    "timezone": "Asia/Makassar", "forecast_days": 7
                })
                data = resp.json()
                current = data.get("current", {})
                daily = data.get("daily", {})
                weather_code = current.get("weather_code", 0)
                weather_data.append({
                    "region": region["name"], "city": region["city"],
                    "temperature": current.get("temperature_2m"),
                    "humidity": current.get("relative_humidity_2m"),
                    "rain": current.get("rain", 0),
                    "wind_speed": current.get("wind_speed_10m"),
                    "weather_code": weather_code,
                    "weather_desc": WMO_CODES.get(weather_code, "Tidak Diketahui"),
                    "forecast_7d": {
                        "dates": daily.get("time", []),
                        "temp_max": daily.get("temperature_2m_max", []),
                        "temp_min": daily.get("temperature_2m_min", []),
                        "rain_sum": daily.get("rain_sum", []),
                        "rain_prob": daily.get("precipitation_probability_max", [])
                    }
                })
            except Exception:
                weather_data.append({
                    "region": region["name"], "city": region["city"],
                    "temperature": None, "humidity": None, "rain": 0,
                    "wind_speed": None, "weather_code": 0,
                    "weather_desc": "Data tidak tersedia", "forecast_7d": {}
                })

        # 2. Fetch news from Google News RSS
        search_queries = [
            "pertanian+lombok+NTB+petani",
            "tanam+panen+lombok+NTB",
            "pupuk+pestisida+lombok+petani",
            "harga+cabai+bawang+lombok+NTB",
            "tembakau+padi+jagung+lombok",
        ]
        seen_titles = set()
        for query in search_queries:
            try:
                rss_url = f"https://news.google.com/rss/search?q={query}&hl=id&gl=ID&ceid=ID:id"
                resp = await client.get(rss_url)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "xml")
                    items = soup.find_all("item")
                    for item in items[:5]:
                        title = item.find("title").text.strip() if item.find("title") else ""
                        if not title or title in seen_titles:
                            continue
                        seen_titles.add(title)
                        description = ""
                        if item.find("description"):
                            desc_soup = BeautifulSoup(item.find("description").text, "html.parser")
                            description = desc_soup.get_text(strip=True)[:300]
                        link = item.find("link").text.strip() if item.find("link") else ""
                        pub_date = item.find("pubDate").text.strip() if item.find("pubDate") else ""
                        source_el = item.find("source")
                        source = source_el.text.strip() if source_el else ""
                        news_articles.append({
                            "title": title, "description": description,
                            "link": link, "date": pub_date, "source": source
                        })
            except Exception:
                continue

        # 3. Scrape ntbprov.go.id for official news
        try:
            resp = await client.get("https://ntbprov.go.id/kategori/pertanian", timeout=10)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                for article in soup.select("article, .post-item, .news-item, .card")[:5]:
                    title_el = article.find("h2") or article.find("h3") or article.find("a")
                    if title_el:
                        title = title_el.get_text(strip=True)
                        if title and title not in seen_titles and len(title) > 15:
                            seen_titles.add(title)
                            link_el = article.find("a", href=True)
                            link = link_el["href"] if link_el else ""
                            if link and not link.startswith("http"):
                                link = "https://ntbprov.go.id" + link
                            news_articles.append({
                                "title": title, "description": "",
                                "link": link, "date": "", "source": "ntbprov.go.id"
                            })
        except Exception:
            pass

        # 4. Scrape lombokpost
        try:
            resp = await client.get("https://lombokpost.jawapos.com/ntb/", timeout=10)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                for article in soup.select("article, .latest__item, .post")[:5]:
                    title_el = article.find("h2") or article.find("h3") or article.find("a")
                    if title_el:
                        title = title_el.get_text(strip=True)
                        if title and title not in seen_titles and len(title) > 15 and any(
                            kw in title.lower() for kw in ["tani", "padi", "jagung", "cabai", "bawang", "pupuk", "panen", "tanam", "pertanian", "petani", "tembakau"]
                        ):
                            seen_titles.add(title)
                            link_el = article.find("a", href=True)
                            link = link_el["href"] if link_el else ""
                            news_articles.append({
                                "title": title, "description": "",
                                "link": link, "date": "", "source": "Lombok Post"
                            })
        except Exception:
            pass

    # Deduplicate and limit
    news_articles = news_articles[:20]

    now = datetime.now(timezone.utc)
    month_name = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                  "Juli", "Agustus", "September", "Oktober", "November", "Desember"][now.month - 1]

    weather_summary = "\n".join([
        f"- {w['region']} ({w['city']}): {w['weather_desc']}, Suhu {w['temperature']}°C, "
        f"Kelembaban {w['humidity']}%, Hujan {w['rain']}mm, Angin {w['wind_speed']}km/h"
        for w in weather_data if w['temperature'] is not None
    ])

    news_summary = "\n".join([
        f"- [{a['source']}] {a['title']}" + (f" - {a['description'][:150]}" if a['description'] else "")
        for a in news_articles[:15]
    ]) or "Tidak ada berita terkini yang ditemukan."

    prompt = f"""Kamu adalah ahli pertanian berpengalaman di Pulau Lombok, Nusa Tenggara Barat, Indonesia.

Bulan saat ini: {month_name} {now.year}

=== CUACA SAAT INI ===
{weather_summary}

=== BERITA PERTANIAN TERKINI DARI BERBAGAI SUMBER ===
{news_summary}

Berdasarkan DATA REAL dari berita terkini di atas DAN kondisi cuaca saat ini, berikan analisis KOMPREHENSIF dalam format JSON (tanpa markdown code block):
{{
  "ringkasan_cuaca": "Deskripsi kondisi cuaca Lombok saat ini dan dampaknya untuk pertanian (2-3 kalimat)",
  "musim": "hujan / kemarau / peralihan",
  "aktivitas_pertanian_terkini": [
    {{
      "tanaman": "Nama tanaman yang SEDANG ditanam/dipanen petani Lombok (berdasarkan berita)",
      "wilayah": "Wilayah di Lombok",
      "status": "sedang tanam / sedang panen / persiapan lahan",
      "detail": "Detail informasi dari berita (luas lahan, produksi, dll)",
      "sumber_info": "Nama media/sumber berita yang melaporkan"
    }}
  ],
  "kondisi_pasar": [
    {{
      "komoditas": "Nama komoditas",
      "harga": "Harga terkini jika ada di berita",
      "tren": "naik / turun / stabil",
      "keterangan": "Konteks harga dan supply"
    }}
  ],
  "tanaman_rekomendasi": [
    {{
      "nama": "Nama tanaman",
      "jenis": "pangan/hortikultura/perkebunan",
      "keterangan": "Kenapa cocok ditanam sekarang BERDASARKAN data real cuaca dan tren berita",
      "wilayah_ideal": "Wilayah di Lombok yang paling cocok",
      "masa_tanam": "Estimasi waktu tanam hingga panen",
      "tips": "Tips singkat"
    }}
  ],
  "kebutuhan_pupuk_obat": [
    {{
      "nama": "Nama pupuk/pestisida/obat",
      "kategori": "pupuk/pestisida/fungisida/herbisida",
      "kegunaan": "Untuk tanaman apa dan kenapa dibutuhkan",
      "dosis": "Dosis yang disarankan",
      "prioritas": "tinggi/sedang/rendah",
      "alasan_prioritas": "Kenapa prioritas ini"
    }}
  ],
  "hama_penyakit_waspada": [
    {{
      "nama": "Nama hama/penyakit",
      "tanaman_target": "Tanaman yang rentan",
      "tanda": "Tanda serangan",
      "pencegahan": "Cara pencegahan"
    }}
  ],
  "tips_musiman": ["Tip 1", "Tip 2", "Tip 3", "Tip 4"],
  "peringatan": ["Peringatan penting jika ada"]
}}

PENTING: Untuk bagian "aktivitas_pertanian_terkini" dan "kondisi_pasar", HANYA gunakan data yang benar-benar ada di berita. Jangan mengarang. Jika tidak ada data, kosongkan array.
Untuk "tanaman_rekomendasi" dan "kebutuhan_pupuk_obat", gunakan kombinasi data berita + pengetahuan ahli.
Berikan minimal 5 tanaman rekomendasi, 6 pupuk/obat, dan 3 hama/penyakit."""

    try:
        llm_key = os.environ.get("EMERGENT_LLM_KEY", "")
        chat = LlmChat(api_key=llm_key, session_id=str(uuid.uuid4()),
            system_message="Kamu adalah ahli pertanian Lombok. Selalu balas dalam format JSON valid tanpa markdown code block. Gunakan bahasa Indonesia.")
        chat = chat.with_model("openai", "gpt-4o")
        chat = chat.with_params(temperature=0.3)
        result_text = await chat.send_message(UserMessage(text=prompt))
        import json as json_module
        try:
            ai_data = json_module.loads(result_text)
        except json_module.JSONDecodeError:
            if "```" in result_text:
                json_str = result_text.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
                ai_data = json_module.loads(json_str.strip())
            else:
                ai_data = {"ringkasan_cuaca": result_text, "musim": "", "aktivitas_pertanian_terkini": [],
                           "kondisi_pasar": [], "tanaman_rekomendasi": [], "kebutuhan_pupuk_obat": [],
                           "hama_penyakit_waspada": [], "tips_musiman": [], "peringatan": []}
        return {"status": "success", "weather": weather_data, "news": news_articles,
                "ai": ai_data, "bulan": f"{month_name} {now.year}"}
    except Exception as e:
        return {"status": "fallback", "weather": weather_data, "news": news_articles,
                "ai": {"ringkasan_cuaca": f"AI tidak tersedia: {str(e)}", "musim": "",
                        "aktivitas_pertanian_terkini": [], "kondisi_pasar": [],
                        "tanaman_rekomendasi": [], "kebutuhan_pupuk_obat": [],
                        "hama_penyakit_waspada": [], "tips_musiman": [], "peringatan": []},
                "bulan": f"{month_name} {now.year}"}


@router.post("/forecast/stock")
async def forecast_stock(admin: dict = Depends(require_admin_panel_access)):
    from emergentintegrations.llm.openai import LlmChat, UserMessage

    now = datetime.now(timezone.utc)
    date_30_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")

    transactions = await db.transactions.find({"date": {"$gte": date_30_ago}}, {"_id": 0, "date": 1, "items": 1}).to_list(100000)
    partner_orders = await db.partner_orders.find({"date": {"$gte": date_30_ago}}, {"_id": 0, "date": 1, "items": 1}).to_list(100000)
    products = await db.products.find({}, {"_id": 0, "id": 1, "name": 1, "stock": 1, "cost_price": 1, "items_per_box": 1, "min_stock_alert": 1}).to_list(1000)

    sales_data = {}
    for t in transactions:
        for item in t.get("items", []):
            pid = item.get("product_id", "")
            qty = item.get("quantity", 0)
            if pid not in sales_data:
                sales_data[pid] = {"pos_qty": 0, "partner_qty": 0, "days": set()}
            sales_data[pid]["pos_qty"] += qty
            sales_data[pid]["days"].add(t.get("date", ""))

    for o in partner_orders:
        for item in o.get("items", []):
            pid = item.get("product_id", "")
            qty = item.get("quantity_satuan", item.get("quantity", 0))
            if pid not in sales_data:
                sales_data[pid] = {"pos_qty": 0, "partner_qty": 0, "days": set()}
            sales_data[pid]["partner_qty"] += qty
            sales_data[pid]["days"].add(o.get("date", ""))

    product_summaries = []
    for p in products:
        sd = sales_data.get(p["id"], {"pos_qty": 0, "partner_qty": 0, "days": set()})
        total_sold = sd["pos_qty"] + sd["partner_qty"]
        active_days = len(sd["days"]) or 1
        avg_daily = total_sold / active_days if active_days > 0 else 0
        days_until_empty = round(p["stock"] / avg_daily) if avg_daily > 0 else 999
        product_summaries.append({
            "name": p["name"], "current_stock": p["stock"],
            "min_stock_alert": p.get("min_stock_alert", 10),
            "cost_per_box": p.get("cost_price", 0),
            "items_per_box": p.get("items_per_box", 1),
            "pos_sold_30d": sd["pos_qty"], "partner_sold_30d": sd["partner_qty"],
            "total_sold_30d": total_sold, "active_sell_days": active_days,
            "avg_daily_sales": round(avg_daily, 2), "est_days_until_empty": days_until_empty
        })

    prompt = f"""Kamu adalah analis inventori UD. AQIN TANI, toko pertanian dan farmasi.
Berikut data penjualan 30 hari terakhir ({date_30_ago} s/d {today}):

{str(product_summaries)}

Berdasarkan data di atas, buatkan analisis dan rekomendasi dalam format JSON (tanpa markdown code block) dengan struktur:
{{
  "summary": "Ringkasan singkat kondisi stok keseluruhan (2-3 kalimat dalam bahasa Indonesia)",
  "forecasts": [
    {{
      "product_name": "nama barang",
      "current_stock": angka,
      "avg_daily_sales": angka,
      "days_until_empty": angka,
      "risk_level": "critical/warning/safe",
      "recommendation": "rekomendasi spesifik dalam bahasa Indonesia",
      "suggested_restock_qty": angka (dalam satuan),
      "suggested_restock_boxes": angka (dalam dus)
    }}
  ],
  "insights": ["insight 1", "insight 2", "insight 3"]
}}

Prioritaskan barang yang risiko kehabisan stok tinggi. Berikan rekomendasi restock untuk 14 hari ke depan.
Jika barang tidak pernah terjual, tandai sebagai "safe" dengan catatan tidak ada penjualan."""

    try:
        llm_key = os.environ.get("EMERGENT_LLM_KEY", "")
        chat = LlmChat(
            api_key=llm_key,
            session_id=str(uuid.uuid4()),
            system_message="Kamu adalah analis inventori profesional. Selalu balas dalam format JSON valid tanpa markdown code block."
        )
        chat = chat.with_model("openai", "gpt-4o")
        chat = chat.with_params(temperature=0.3)
        result_text = await chat.send_message(UserMessage(text=prompt))
        import json as json_module
        try:
            result = json_module.loads(result_text)
        except json_module.JSONDecodeError:
            if "```" in result_text:
                json_str = result_text.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
                result = json_module.loads(json_str.strip())
            else:
                result = {"summary": result_text, "forecasts": [], "insights": []}
        return {"status": "success", "data": result, "raw_stats": product_summaries, "period": f"{date_30_ago} s/d {today}"}
    except Exception as e:
        return {
            "status": "fallback",
            "data": {
                "summary": "AI tidak tersedia. Menampilkan data statistik dasar.",
                "forecasts": sorted([{
                    "product_name": p["name"], "current_stock": p["current_stock"],
                    "avg_daily_sales": p["avg_daily_sales"], "days_until_empty": p["est_days_until_empty"],
                    "risk_level": "critical" if p["est_days_until_empty"] < 7 else ("warning" if p["est_days_until_empty"] < 14 else "safe"),
                    "recommendation": f"Stok akan habis dalam {p['est_days_until_empty']} hari" if p["avg_daily_sales"] > 0 else "Tidak ada penjualan 30 hari terakhir",
                    "suggested_restock_qty": round(p["avg_daily_sales"] * 14),
                    "suggested_restock_boxes": round(p["avg_daily_sales"] * 14 / max(1, p["items_per_box"]))
                } for p in product_summaries], key=lambda x: x["days_until_empty"]),
                "insights": [f"Error AI: {str(e)}"]
            },
            "raw_stats": product_summaries, "period": f"{date_30_ago} s/d {today}"
        }



@router.get("/reports/canvasser-recap")
async def get_canvasser_recap(date: str, canvasser_id: str = "", current_user: dict = Depends(get_current_user)):
    """Rekap harian kanvaser: pesanan, settlement, pembayaran, barang kembali."""
    # Get all partner orders for this date
    query = {"date": date}
    if canvasser_id:
        query["canvasser_id"] = canvasser_id

    orders = await db.partner_orders.find(query, {"_id": 0}).to_list(10000)

    # Group by canvasser
    canvasser_data = {}
    for order in orders:
        cid = order.get("canvasser_id", "")
        cname = order.get("canvasser_name", "Tanpa Kanvaser")
        if not cid:
            continue
        if cid not in canvasser_data:
            canvasser_data[cid] = {
                "canvasser_id": cid,
                "canvasser_name": cname,
                "total_orders": 0,
                "total_delivered": 0,
                "total_settled": 0,
                "total_cancelled": 0,
                "total_order_value": 0,
                "total_settled_value": 0,
                "total_payment_received": 0,
                "return_items": [],
                "stores_visited": [],
                "orders": []
            }

        cd = canvasser_data[cid]
        cd["total_orders"] += 1
        cd["total_order_value"] += order.get("total", 0)

        if order.get("status") == "delivered":
            cd["total_delivered"] += 1
        elif order.get("status") == "cancelled":
            cd["total_cancelled"] += 1

        if order.get("is_settled"):
            cd["total_settled"] += 1
            cd["total_settled_value"] += order.get("total", 0)
            for ri in order.get("return_items", []):
                cd["return_items"].append(ri)

        cd["total_payment_received"] += order.get("paid", 0)

        store_name = order.get("partner_store_name", "")
        if store_name and store_name not in cd["stores_visited"]:
            cd["stores_visited"].append(store_name)

        cd["orders"].append({
            "order_number": order.get("order_number"),
            "partner_store_name": store_name,
            "total": order.get("total", 0),
            "paid": order.get("paid", 0),
            "remaining": order.get("remaining", 0),
            "status": order.get("status", ""),
            "order_type": order.get("order_type", "regular"),
            "is_settled": order.get("is_settled", False),
            "items": order.get("items", []),
        })

    result = list(canvasser_data.values())

    # Get canvasser list for filter dropdown
    canvassers = await db.canvassers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)

    return {
        "date": date,
        "canvassers": canvassers,
        "data": result,
        "summary": {
            "total_canvassers": len(result),
            "total_orders": sum(c["total_orders"] for c in result),
            "total_delivered": sum(c["total_delivered"] for c in result),
            "total_settled": sum(c["total_settled"] for c in result),
            "total_order_value": sum(c["total_order_value"] for c in result),
            "total_payment": sum(c["total_payment_received"] for c in result),
            "total_return_items": sum(len(c["return_items"]) for c in result),
        }
    }
