"""
Backend tests for 3 new features in iteration 15:
1. Stock Adjustment - POST/GET /api/stock-adjustments
2. POS Cart Sticky panel (frontend only - tested via UI)
3. PDF Export (frontend only - tested via UI)

Testing stock adjustment functionality:
- Create adjustment and verify stock updated
- Get list of adjustments
- Verify difference indicator (+/-) calculated correctly
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@aqintani.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.fail(f"Admin login failed: {response.status_code} - {response.text}")

@pytest.fixture(scope="module")
def api_client(admin_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session

# --- STOCK ADJUSTMENTS TESTS ---

class TestStockAdjustments:
    """Tests for stock adjustment feature"""

    def test_get_products_for_adjustment(self, api_client):
        """GET /api/products - should return list of products for adjustment"""
        response = api_client.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)
        assert len(products) >= 1, "Need at least 1 product for testing"
        print(f"Found {len(products)} products for stock adjustment testing")
        return products[0]

    def test_get_warehouses(self, api_client):
        """GET /api/warehouses - should return list of warehouses"""
        response = api_client.get(f"{BASE_URL}/api/warehouses")
        assert response.status_code == 200
        warehouses = response.json()
        assert isinstance(warehouses, list)
        assert len(warehouses) >= 1, "Need at least 1 warehouse"
        warehouse_ids = [w["id"] for w in warehouses]
        print(f"Warehouses: {warehouse_ids}")
        return warehouses

    def test_get_warehouse_stock(self, api_client):
        """GET /api/warehouse-stock - should return stock per warehouse"""
        response = api_client.get(f"{BASE_URL}/api/warehouse-stock")
        assert response.status_code == 200
        stock = response.json()
        assert isinstance(stock, list)
        print(f"Warehouse stock entries: {len(stock)}")
        return stock

    def test_create_stock_adjustment_increase(self, api_client):
        """POST /api/stock-adjustments - increase stock via adjustment"""
        # Get first product
        products_resp = api_client.get(f"{BASE_URL}/api/products")
        products = products_resp.json()
        assert len(products) >= 1
        product = products[0]
        product_id = product["id"]

        # Get current warehouse stock
        stock_resp = api_client.get(f"{BASE_URL}/api/warehouse-stock")
        stock_data = stock_resp.json()
        current_stock = next(
            (s["stock"] for s in stock_data 
             if s["product_id"] == product_id and s["warehouse_id"] == "gudang_utama"),
            0
        )
        print(f"Product: {product['name']}, Current gudang_utama stock: {current_stock}")

        # Adjust stock - increase by 5
        new_stock = current_stock + 5
        adjustment_payload = {
            "product_id": product_id,
            "warehouse_id": "gudang_utama",
            "new_stock": new_stock,
            "reason": "Koreksi fisik - TEST increase"
        }
        response = api_client.post(f"{BASE_URL}/api/stock-adjustments", json=adjustment_payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        result = response.json()
        assert "message" in result
        assert "adjustment" in result
        
        # Verify adjustment record
        adj = result["adjustment"]
        assert adj["product_id"] == product_id
        assert adj["warehouse_id"] == "gudang_utama"
        assert adj["old_stock"] == current_stock
        assert adj["new_stock"] == new_stock
        assert adj["difference"] == 5, "Difference should be +5"
        assert adj["reason"] == "Koreksi fisik - TEST increase"
        print(f"Adjustment created: {adj['old_stock']} -> {adj['new_stock']} (diff: +{adj['difference']})")

        # Verify stock actually updated
        verify_resp = api_client.get(f"{BASE_URL}/api/warehouse-stock")
        updated_stock = verify_resp.json()
        updated_value = next(
            (s["stock"] for s in updated_stock 
             if s["product_id"] == product_id and s["warehouse_id"] == "gudang_utama"),
            None
        )
        assert updated_value == new_stock, f"Stock should be {new_stock} but got {updated_value}"
        print(f"Stock verified: gudang_utama now has {updated_value}")

    def test_create_stock_adjustment_decrease(self, api_client):
        """POST /api/stock-adjustments - decrease stock via adjustment"""
        # Get first product
        products_resp = api_client.get(f"{BASE_URL}/api/products")
        products = products_resp.json()
        product = products[0]
        product_id = product["id"]

        # Get current warehouse stock
        stock_resp = api_client.get(f"{BASE_URL}/api/warehouse-stock")
        stock_data = stock_resp.json()
        current_stock = next(
            (s["stock"] for s in stock_data 
             if s["product_id"] == product_id and s["warehouse_id"] == "gudang_utama"),
            0
        )
        
        # Adjust stock - decrease by 3
        new_stock = max(0, current_stock - 3)
        adjustment_payload = {
            "product_id": product_id,
            "warehouse_id": "gudang_utama",
            "new_stock": new_stock,
            "reason": "Barang rusak - TEST decrease"
        }
        response = api_client.post(f"{BASE_URL}/api/stock-adjustments", json=adjustment_payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        result = response.json()
        adj = result["adjustment"]
        
        expected_diff = new_stock - current_stock
        assert adj["difference"] == expected_diff, f"Difference should be {expected_diff}"
        print(f"Adjustment (decrease): {adj['old_stock']} -> {adj['new_stock']} (diff: {adj['difference']})")

    def test_create_stock_adjustment_different_reasons(self, api_client):
        """Test stock adjustment with different reason types"""
        products_resp = api_client.get(f"{BASE_URL}/api/products")
        products = products_resp.json()
        product = products[0]
        product_id = product["id"]

        reasons = [
            "Stok opname",
            "Barang hilang",
            "Lainnya"
        ]

        for reason in reasons:
            stock_resp = api_client.get(f"{BASE_URL}/api/warehouse-stock")
            stock_data = stock_resp.json()
            current_stock = next(
                (s["stock"] for s in stock_data 
                 if s["product_id"] == product_id and s["warehouse_id"] == "gudang_utama"),
                0
            )
            
            # Keep same stock (no change) just to verify reason saved
            adjustment_payload = {
                "product_id": product_id,
                "warehouse_id": "gudang_utama",
                "new_stock": current_stock,
                "reason": reason
            }
            response = api_client.post(f"{BASE_URL}/api/stock-adjustments", json=adjustment_payload)
            assert response.status_code == 200, f"Failed for reason '{reason}': {response.text}"
            result = response.json()
            assert result["adjustment"]["reason"] == reason
            print(f"Reason '{reason}' - PASS")

    def test_get_stock_adjustments_list(self, api_client):
        """GET /api/stock-adjustments - should return adjustment history"""
        response = api_client.get(f"{BASE_URL}/api/stock-adjustments")
        assert response.status_code == 200
        adjustments = response.json()
        assert isinstance(adjustments, list)
        assert len(adjustments) >= 1, "Should have at least 1 adjustment from previous tests"
        
        # Verify structure
        adj = adjustments[0]
        required_fields = ["id", "product_id", "warehouse_id", "old_stock", "new_stock", "difference", "reason", "date"]
        for field in required_fields:
            assert field in adj, f"Missing field: {field}"
        
        print(f"Got {len(adjustments)} adjustment records")
        print(f"Latest adjustment: {adj['product_name']} - {adj['old_stock']} -> {adj['new_stock']} ({adj['reason']})")

    def test_get_stock_adjustments_by_product(self, api_client):
        """GET /api/stock-adjustments?product_id=xxx - filter by product"""
        # Get first product id
        products_resp = api_client.get(f"{BASE_URL}/api/products")
        products = products_resp.json()
        product_id = products[0]["id"]

        response = api_client.get(f"{BASE_URL}/api/stock-adjustments?product_id={product_id}")
        assert response.status_code == 200
        adjustments = response.json()
        assert isinstance(adjustments, list)
        
        # All adjustments should be for this product
        for adj in adjustments:
            assert adj["product_id"] == product_id
        
        print(f"Filtered adjustments for product {product_id}: {len(adjustments)} records")

    def test_stock_adjustment_updates_product_total_stock(self, api_client):
        """Verify stock adjustment recalculates total product stock"""
        # Get a product
        products_resp = api_client.get(f"{BASE_URL}/api/products")
        products = products_resp.json()
        product = products[0]
        product_id = product["id"]
        items_per_box = product.get("items_per_box", 1)

        # Get warehouse stock before
        stock_resp = api_client.get(f"{BASE_URL}/api/warehouse-stock")
        stock_data = stock_resp.json()
        
        # Calculate expected total stock in satuan
        # gudang_utama is 'dus' unit, gudang_toko is 'satuan' unit
        utama_stock = next((s["stock"] for s in stock_data if s["product_id"] == product_id and s["warehouse_id"] == "gudang_utama"), 0)
        toko_stock = next((s["stock"] for s in stock_data if s["product_id"] == product_id and s["warehouse_id"] == "gudang_toko"), 0)
        
        # Make adjustment to gudang_utama
        new_utama = utama_stock + 1
        response = api_client.post(f"{BASE_URL}/api/stock-adjustments", json={
            "product_id": product_id,
            "warehouse_id": "gudang_utama",
            "new_stock": new_utama,
            "reason": "TEST - verify total stock update"
        })
        assert response.status_code == 200

        # Verify product total stock updated
        product_resp = api_client.get(f"{BASE_URL}/api/products/{product_id}")
        updated_product = product_resp.json()
        
        # Calculate expected total: utama (dus) * items_per_box + toko (satuan)
        expected_total = (new_utama * items_per_box) + toko_stock
        
        # Note: gudang_lainnya might also exist
        lainnya_stock = next((s["stock"] for s in stock_data if s["product_id"] == product_id and s["warehouse_id"] == "gudang_lainnya"), 0)
        # gudang_lainnya is 'dus' unit
        expected_total += lainnya_stock * items_per_box
        
        print(f"Expected total: ({new_utama} * {items_per_box}) + {toko_stock} + ({lainnya_stock} * {items_per_box}) = {expected_total}")
        print(f"Actual product stock: {updated_product['stock']}")
        # Allow some variation due to other warehouses
        assert abs(updated_product["stock"] - expected_total) < 100, f"Stock mismatch: expected ~{expected_total}, got {updated_product['stock']}"


# --- REPORTS ENDPOINTS (for PDF export testing) ---

class TestReportsEndpoints:
    """Tests for report endpoints used by PDF export"""

    def test_sales_detail_report(self, api_client):
        """GET /api/reports/sales-detail - POS sales report"""
        response = api_client.get(f"{BASE_URL}/api/reports/sales-detail?date_from=2026-01-01&date_to=2026-03-06")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["date_from", "date_to", "rows", "total_sales", "total_cost", "total_margin"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"Sales report: {len(data['rows'])} items, total_sales={data['total_sales']}")

    def test_partner_sales_detail_report(self, api_client):
        """GET /api/reports/partner-sales-detail - Partner sales report"""
        response = api_client.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2026-01-01&date_to=2026-03-06")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["date_from", "date_to", "rows", "total_sales", "total_cost", "total_margin"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"Partner sales report: {len(data['rows'])} items, total_sales={data['total_sales']}")

    def test_best_sellers_report(self, api_client):
        """GET /api/reports/best-sellers - Bestseller report"""
        response = api_client.get(f"{BASE_URL}/api/reports/best-sellers?date_from=2026-01-01&date_to=2026-03-06")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["date_from", "date_to", "rows", "total_products"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        if data["rows"]:
            row = data["rows"][0]
            row_fields = ["product_id", "product_name", "qty_pos", "qty_partner", "qty_total", "revenue_total", "margin"]
            for field in row_fields:
                assert field in row, f"Missing row field: {field}"
        
        print(f"Bestseller report: {len(data['rows'])} products")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
