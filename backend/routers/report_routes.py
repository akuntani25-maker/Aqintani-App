from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import os

from database import db
from auth import get_current_user, require_admin, require_admin_panel_access

router = APIRouter()


@router.get("/dashboard/stats")
async def get_dashboard_stats(admin: dict = Depends(require_admin_panel_access)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_transactions = await db.transactions.find({"date": today}, {"_id": 0}).to_list(10000)
    today_sales = sum(t.get("total", 0) for t in today_transactions)
    total_products = await db.products.count_documents({})
    low_stock_count = await db.products.count_documents({"$expr": {"$lte": ["$stock", "$min_stock_alert"]}})

    last_7_days = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        day_txns = await db.transactions.find({"date": d}, {"_id": 0}).to_list(10000)
        day_total = sum(t.get("total", 0) for t in day_txns)
        last_7_days.append({"date": d, "total": day_total, "count": len(day_txns)})

    # Warehouse inventory value + chart
    warehouses = await db.warehouses.find({}, {"_id": 0}).to_list(100)
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
        cost_per_unit = (prod.get("cost_price", 0) or 0) / ipb
        warehouse_values[wid] = warehouse_values.get(wid, 0) + stk * cost_per_unit

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
    stock_out_today = sum(
        sum(item.get("cost_price", 0) * item.get("quantity", 0) for item in t.get("items", []))
        for t in today_transactions
    )

    # Debts
    unpaid_purchases = await db.purchases.find({"remaining": {"$gt": 0}}, {"_id": 0}).to_list(10000)
    total_supplier_debt = sum(p.get("remaining", 0) for p in unpaid_purchases)
    partner_stores = await db.partner_stores.find({}, {"_id": 0, "current_debt": 1}).to_list(10000)
    total_partner_debt = sum(ps.get("current_debt", 0) for ps in partner_stores)

    # Personal loans (piutang pribadi) & farmer debts (hutang petani)
    personal_loans = await db.personal_loans.find({"remaining": {"$gt": 0}}, {"_id": 0, "remaining": 1}).to_list(10000)
    total_personal_loans = sum(l.get("remaining", 0) for l in personal_loans)
    farmers = await db.farmers.find({}, {"_id": 0, "current_debt": 1}).to_list(10000)
    total_farmer_debt = sum(f.get("current_debt", 0) for f in farmers)

    total_assets = total_inventory + total_partner_debt + total_personal_loans + total_farmer_debt - total_supplier_debt

    # Due this month
    now = datetime.now(timezone.utc)
    month_start = now.strftime("%Y-%m-01")
    month_end = f"{now.strftime('%Y-%m')}-31"
    due_this_month = await db.purchases.find(
        {"due_date": {"$gte": month_start, "$lte": month_end}, "remaining": {"$gt": 0}}, {"_id": 0}
    ).to_list(100)

    return {
        "today_sales": today_sales, "today_transactions": len(today_transactions),
        "total_products": total_products, "low_stock_count": low_stock_count,
        "last_7_days": last_7_days, "inventory_value": total_inventory,
        "warehouse_chart": warehouse_chart, "stock_in_today": stock_in_today,
        "stock_out_today": stock_out_today, "total_supplier_debt": total_supplier_debt,
        "total_partner_debt": total_partner_debt, "total_personal_loans": total_personal_loans,
        "total_farmer_debt": total_farmer_debt, "total_assets": total_assets,
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
async def get_daily_report(date: str, admin: dict = Depends(require_admin)):
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
async def get_monthly_report(year: int, month: int, admin: dict = Depends(require_admin)):
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
async def get_sales_detail_report(date_from: str, date_to: str, admin: dict = Depends(require_admin)):
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
            product = products.get(item["product_id"], {})
            ipb = product.get("items_per_box", 1) or 1
            cost_per_unit = (product.get("cost_price", 0) or 0) / ipb
            sell_price = item["price"]
            qty = item["quantity"]
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
async def get_partner_sales_detail_report(date_from: str, date_to: str, admin: dict = Depends(require_admin)):
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
        for item in o.get("items", []):
            product = products.get(item["product_id"], {})
            ipb = product.get("items_per_box", 1) or 1
            item_wh_id = item.get("warehouse_id") or o.get("warehouse_id", "gudang_utama")
            wh = wh_map.get(item_wh_id, {})
            wh_unit = wh.get("unit", "satuan")
            qty_satuan = item["quantity"] * ipb if wh_unit == "dus" else item["quantity"]
            cost_per_unit = (product.get("cost_price", 0) or 0) / ipb
            sell_price_per_unit = item["price"] / ipb if wh_unit == "dus" else item["price"]
            total_sell = item["price"] * item["quantity"]
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
async def get_best_sellers_report(date_from: str, date_to: str, admin: dict = Depends(require_admin)):
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
        for item in o.get("items", []):
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
async def get_product_analytics(admin: dict = Depends(require_admin)):
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
async def get_analytics_summary(admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    this_month_start = now.strftime("%Y-%m-01")
    thirty_days_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    month_transactions = await db.transactions.find({"date": {"$gte": this_month_start}}, {"_id": 0}).to_list(10000)
    monthly_sales = sum(t["total"] for t in month_transactions)
    monthly_cost = sum(
        sum(item.get("price", 0) * item.get("quantity", 0) * 0.7 for item in t.get("items", []))
        for t in month_transactions
    )
    month_purchases = await db.purchases.find({"date": {"$gte": this_month_start}}, {"_id": 0}).to_list(10000)
    monthly_purchases_total = sum(p.get("total", 0) for p in month_purchases)
    monthly_purchases_unpaid = sum(p.get("remaining", 0) for p in month_purchases)
    all_partner_orders = await db.partner_orders.find({}, {"_id": 0}).to_list(10000)
    total_partner_sales = sum(o.get("total", 0) for o in all_partner_orders)
    total_partner_unpaid = sum(o.get("remaining", 0) for o in all_partner_orders)
    daily_sales = {}
    for i in range(29, -1, -1):
        date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_sales[date] = {"sales": 0, "transactions": 0}
    all_30_transactions = await db.transactions.find({"date": {"$gte": thirty_days_ago}}, {"_id": 0}).to_list(10000)
    for t in all_30_transactions:
        d = t.get("date", "")
        if d in daily_sales:
            daily_sales[d]["sales"] += t.get("total", 0)
            daily_sales[d]["transactions"] += 1
    chart_data = [{"date": k, **v} for k, v in daily_sales.items()]
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    cat_map = {c["id"]: c["name"] for c in categories}
    category_stock = {}
    for p in products:
        cat_name = cat_map.get(p.get("category_id", ""), "Tanpa Kategori")
        if cat_name not in category_stock:
            category_stock[cat_name] = {"name": cat_name, "count": 0, "stock_value": 0}
        category_stock[cat_name]["count"] += 1
        category_stock[cat_name]["stock_value"] += p.get("stock", 0) * p.get("cost_price", 0)
    return {
        "monthly_sales": monthly_sales, "monthly_transactions": len(month_transactions),
        "monthly_purchases": monthly_purchases_total, "monthly_purchases_unpaid": monthly_purchases_unpaid,
        "total_partner_sales": total_partner_sales, "total_partner_unpaid": total_partner_unpaid,
        "estimated_margin": monthly_sales - monthly_cost,
        "chart_data": chart_data, "category_breakdown": list(category_stock.values())
    }


# ============= AI STOCK FORECAST =============
@router.post("/forecast/stock")
async def forecast_stock(admin: dict = Depends(require_admin)):
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
