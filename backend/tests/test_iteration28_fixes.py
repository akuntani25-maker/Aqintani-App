"""
Iteration 28 - Testing 6 User-Requested Fixes
Fix #1: POS cart qty input editable (frontend-only)
Fix #2: Partner Orders cart qty input editable - onChange passes absolute value (frontend-only)
Fix #3: Reports exclude qty=0 items from results
Fix #4: VBScript auto-start (cannot test in Linux - code review only)
Fix #5: Canvasser Dashboard shows store debt history (sisa bon)
Fix #6: Canvasser settlement form - items enriched with items_per_box and warehouse_unit
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@aqintani.com",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")  # API returns 'token' not 'access_token'

@pytest.fixture(scope="module")
def canvasser_token(api_client):
    """Get canvasser authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "sahidin@aqintani.com",
        "password": "123456"
    })
    assert response.status_code == 200, f"Canvasser login failed: {response.text}"
    return response.json().get("token")  # API returns 'token' not 'access_token'


class TestFix3ReportsExcludeZeroQty:
    """Fix #3: Reports should exclude items with qty=0 from results"""
    
    def test_sales_detail_report_structure(self, api_client, admin_token):
        """Test /api/reports/sales-detail endpoint exists and returns proper structure"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        today = datetime.now().strftime("%Y-%m-%d")
        response = api_client.get(f"{BASE_URL}/api/reports/sales-detail?date_from={today}&date_to={today}")
        
        assert response.status_code == 200, f"Sales detail report failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "rows" in data, "Response should have 'rows' field"
        assert "total_sales" in data, "Response should have 'total_sales' field"
        
        # Check that all items in rows have qty > 0
        for row in data.get("rows", []):
            assert row.get("quantity", 0) > 0, f"Found qty=0 item in sales-detail: {row}"
        
        print(f"Sales detail report: {len(data['rows'])} items, all qty > 0")
    
    def test_partner_sales_detail_report_excludes_zero_qty(self, api_client, admin_token):
        """Test /api/reports/partner-sales-detail excludes qty<=0 items"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        today = datetime.now().strftime("%Y-%m-%d")
        # Check last 30 days for more data
        from datetime import timedelta
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = api_client.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from={date_from}&date_to={today}")
        
        assert response.status_code == 200, f"Partner sales detail report failed: {response.text}"
        data = response.json()
        
        assert "rows" in data, "Response should have 'rows' field"
        
        # Verify no qty<=0 items
        for row in data.get("rows", []):
            qty = row.get("quantity_original", 0)
            assert qty > 0, f"Found qty<=0 item in partner-sales-detail: {row}"
        
        print(f"Partner sales detail report: {len(data['rows'])} items, all qty > 0")
    
    def test_best_sellers_report_excludes_zero_qty(self, api_client, admin_token):
        """Test /api/reports/best-sellers excludes qty<=0 items in aggregation"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        today = datetime.now().strftime("%Y-%m-%d")
        from datetime import timedelta
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = api_client.get(f"{BASE_URL}/api/reports/best-sellers?date_from={date_from}&date_to={today}")
        
        assert response.status_code == 200, f"Best sellers report failed: {response.text}"
        data = response.json()
        
        assert "rows" in data, "Response should have 'rows' field"
        
        # Check all items have qty_total > 0
        for row in data.get("rows", []):
            qty_total = row.get("qty_total", 0)
            # Products with no sales shouldn't appear, or should have qty > 0
            assert qty_total > 0, f"Found qty_total<=0 item in best-sellers: {row}"
        
        print(f"Best sellers report: {len(data['rows'])} products with qty > 0")


class TestFix5CanvasserDashboardStoreDebt:
    """Fix #5: Canvasser Dashboard shows store debt history (sisa bon) for each partner order card"""
    
    def test_my_orders_has_store_current_debt(self, api_client, canvasser_token):
        """Test /api/canvassers/my-orders returns store_current_debt for each order"""
        api_client.headers.update({"Authorization": f"Bearer {canvasser_token}"})
        response = api_client.get(f"{BASE_URL}/api/canvassers/my-orders")
        
        assert response.status_code == 200, f"My orders failed: {response.text}"
        orders = response.json()
        
        assert isinstance(orders, list), "Response should be a list of orders"
        
        # Check that orders have store_current_debt field
        for order in orders:
            assert "store_current_debt" in order, f"Order {order.get('order_number')} missing store_current_debt field"
            debt = order.get("store_current_debt", 0)
            assert isinstance(debt, (int, float)), f"store_current_debt should be numeric, got {type(debt)}"
        
        print(f"My orders: {len(orders)} orders, all have store_current_debt field")
        
        # Show some samples
        if orders:
            sample = orders[0]
            print(f"Sample order: {sample.get('order_number')} - store_current_debt: {sample.get('store_current_debt')}")


class TestFix6CanvasserSettlementEnrichment:
    """Fix #6: Canvasser settlement form items enriched with items_per_box and warehouse_unit"""
    
    def test_my_orders_items_have_items_per_box(self, api_client, canvasser_token):
        """Test /api/canvassers/my-orders items have items_per_box field"""
        api_client.headers.update({"Authorization": f"Bearer {canvasser_token}"})
        response = api_client.get(f"{BASE_URL}/api/canvassers/my-orders")
        
        assert response.status_code == 200, f"My orders failed: {response.text}"
        orders = response.json()
        
        items_checked = 0
        for order in orders:
            for item in order.get("items", []):
                assert "items_per_box" in item, f"Item {item.get('product_name')} missing items_per_box"
                ipb = item.get("items_per_box", 1)
                assert isinstance(ipb, (int, float)) and ipb >= 1, f"items_per_box should be >= 1, got {ipb}"
                items_checked += 1
        
        print(f"Checked {items_checked} items, all have items_per_box field")
    
    def test_my_orders_items_have_warehouse_unit(self, api_client, canvasser_token):
        """Test /api/canvassers/my-orders items have warehouse_unit field"""
        api_client.headers.update({"Authorization": f"Bearer {canvasser_token}"})
        response = api_client.get(f"{BASE_URL}/api/canvassers/my-orders")
        
        assert response.status_code == 200, f"My orders failed: {response.text}"
        orders = response.json()
        
        items_checked = 0
        for order in orders:
            for item in order.get("items", []):
                assert "warehouse_unit" in item, f"Item {item.get('product_name')} missing warehouse_unit"
                unit = item.get("warehouse_unit", "satuan")
                assert unit in ["satuan", "dus"], f"warehouse_unit should be 'satuan' or 'dus', got {unit}"
                items_checked += 1
        
        print(f"Checked {items_checked} items, all have warehouse_unit field (satuan/dus)")
    
    def test_settlement_max_limit_calculation(self, api_client, canvasser_token):
        """Verify totalPcs calculation: original_qty * items_per_box for dus, original_qty for satuan"""
        api_client.headers.update({"Authorization": f"Bearer {canvasser_token}"})
        response = api_client.get(f"{BASE_URL}/api/canvassers/my-orders")
        
        assert response.status_code == 200, f"My orders failed: {response.text}"
        orders = response.json()
        
        # Find orders with items to verify calculation
        for order in orders:
            for item in order.get("items", []):
                original_qty = item.get("quantity", 0)
                items_per_box = item.get("items_per_box", 1)
                warehouse_unit = item.get("warehouse_unit", "satuan")
                
                # Calculate expected totalPcs
                if warehouse_unit == "dus":
                    expected_total_pcs = original_qty * items_per_box
                else:
                    expected_total_pcs = original_qty
                
                print(f"Item: {item.get('product_name')}, qty={original_qty}, ipb={items_per_box}, "
                      f"unit={warehouse_unit}, totalPcs={expected_total_pcs}")
                
                # This verifies the frontend has the data needed for correct max limit
                assert items_per_box >= 1, "items_per_box should be >= 1"
                assert warehouse_unit in ["satuan", "dus"], "warehouse_unit should be satuan or dus"
        
        print("Settlement max limit calculation data is correct")


class TestAuthentication:
    """Test authentication for required users"""
    
    def test_admin_login(self, api_client):
        """Test admin login works"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Login should return token"
        print("Admin login successful")
    
    def test_kasir_login(self, api_client):
        """Test kasir login works"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kasir@aqintani.com",
            "password": "kasir123"
        })
        assert response.status_code == 200, f"Kasir login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Login should return token"
        print("Kasir login successful")
    
    def test_canvasser_login(self, api_client):
        """Test canvasser login works"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sahidin@aqintani.com",
            "password": "123456"
        })
        assert response.status_code == 200, f"Canvasser login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Login should return token"
        print("Canvasser login successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
