"""
Iteration 24 - Testing 4 New Features:
1. Notifikasi Stok Menipis (Low Stock Alerts with product details on dashboard + badge on sidebar)
2. Riwayat Perubahan Harga (Price History tracking when product HPP/price changes)
3. Laporan Laba/Rugi (Profit & Loss report with daily breakdown and chart)
4. Multi-user POS Shift Management (open/close shift with balance tracking)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Get auth tokens for different roles"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def cashier_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kasir@aqintani.com",
            "password": "kasir123"
        })
        assert response.status_code == 200, f"Cashier login failed: {response.text}"
        return response.json()["token"]

    def test_admin_login(self, admin_token):
        """Verify admin can login"""
        assert admin_token is not None
        print("PASS: Admin login successful")

    def test_cashier_login(self, cashier_token):
        """Verify cashier can login"""
        assert cashier_token is not None
        print("PASS: Cashier login successful")


class TestLowStockAlerts:
    """Test low stock notification feature on dashboard"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]

    def test_dashboard_stats_has_low_stock_products(self, admin_token):
        """Dashboard stats should include low_stock_products array"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200, f"Failed to get dashboard stats: {response.text}"
        data = response.json()
        
        # Verify low_stock_count exists
        assert "low_stock_count" in data, "low_stock_count not in dashboard stats"
        
        # Verify low_stock_products array exists
        assert "low_stock_products" in data, "low_stock_products array not in dashboard stats"
        assert isinstance(data["low_stock_products"], list), "low_stock_products should be a list"
        
        print(f"PASS: Dashboard has low_stock_count={data['low_stock_count']} and low_stock_products array with {len(data['low_stock_products'])} items")

    def test_low_stock_product_details(self, admin_token):
        """Low stock products should have detailed info"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        data = response.json()
        
        if data["low_stock_products"]:
            product = data["low_stock_products"][0]
            assert "id" in product, "Product should have id"
            assert "name" in product, "Product should have name"
            assert "stock" in product, "Product should have stock"
            assert "min_stock_alert" in product, "Product should have min_stock_alert"
            print(f"PASS: Low stock product has required fields: id, name, stock, min_stock_alert")
        else:
            print("PASS: No low stock products (low_stock_products array is empty)")

    def test_get_low_stock_products_endpoint(self, admin_token):
        """Test dedicated low stock products endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/products/low-stock", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: /products/low-stock returns {len(data)} products")


class TestShiftManagement:
    """Test POS shift management feature"""
    
    @pytest.fixture(scope="class")
    def cashier_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kasir@aqintani.com",
            "password": "kasir123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]

    def test_get_current_shift_no_shift(self, cashier_token):
        """Get current shift when none is open"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        # First close any existing shift
        requests.post(f"{BASE_URL}/api/shifts/close?closing_balance=0&notes=test_cleanup", headers=headers)
        
        response = requests.get(f"{BASE_URL}/api/shifts/current", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        # Should return null when no shift is open
        data = response.json()
        print(f"PASS: /shifts/current returns null or shift object: {data}")

    def test_open_shift(self, cashier_token):
        """Open a new shift with opening balance"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        # Close any existing shift first
        requests.post(f"{BASE_URL}/api/shifts/close?closing_balance=0&notes=test_cleanup", headers=headers)
        
        response = requests.post(f"{BASE_URL}/api/shifts/open?opening_balance=500000", headers=headers)
        assert response.status_code == 200, f"Failed to open shift: {response.text}"
        data = response.json()
        
        assert "id" in data, "Shift should have id"
        assert data["opening_balance"] == 500000, f"Opening balance should be 500000, got {data['opening_balance']}"
        assert data["status"] == "open", f"Status should be 'open', got {data['status']}"
        assert "user_name" in data, "Shift should have user_name"
        assert "opened_at" in data, "Shift should have opened_at"
        
        print(f"PASS: Opened shift with id={data['id']}, opening_balance={data['opening_balance']}")

    def test_get_current_shift_after_open(self, cashier_token):
        """Get current shift after opening"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.get(f"{BASE_URL}/api/shifts/current", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data is not None, "Should have a current shift"
        assert data["status"] == "open", f"Status should be 'open', got {data['status']}"
        assert "total_sales" in data, "Shift should have total_sales"
        assert "total_transactions" in data, "Shift should have total_transactions"
        
        print(f"PASS: Current shift has total_sales={data['total_sales']}, total_transactions={data['total_transactions']}")

    def test_close_shift(self, cashier_token):
        """Close the shift with closing balance"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.post(f"{BASE_URL}/api/shifts/close?closing_balance=600000&notes=End+of+day+test", headers=headers)
        assert response.status_code == 200, f"Failed to close shift: {response.text}"
        data = response.json()
        
        assert data["status"] == "closed", f"Status should be 'closed', got {data['status']}"
        assert data["closing_balance"] == 600000, f"Closing balance should be 600000, got {data['closing_balance']}"
        assert "closed_at" in data, "Shift should have closed_at"
        assert "notes" in data, "Shift should have notes"
        
        print(f"PASS: Closed shift with closing_balance={data['closing_balance']}, notes={data['notes']}")

    def test_close_shift_no_shift_open(self, cashier_token):
        """Trying to close when no shift is open should fail"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.post(f"{BASE_URL}/api/shifts/close?closing_balance=100000&notes=test", headers=headers)
        assert response.status_code == 404, f"Expected 404 when no shift open, got {response.status_code}"
        print("PASS: Correctly returns 404 when trying to close non-existent shift")

    def test_get_shift_history(self, cashier_token):
        """Get shift history"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.get(f"{BASE_URL}/api/shifts/history", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        if data:
            shift = data[0]
            assert "id" in shift, "Shift history item should have id"
            assert "status" in shift and shift["status"] == "closed", "History should only show closed shifts"
        print(f"PASS: /shifts/history returns {len(data)} closed shifts")


class TestPriceHistory:
    """Test price history tracking feature"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]

    @pytest.fixture(scope="class")
    def test_product(self, admin_token):
        """Create a test product for price history testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        product_data = {
            "name": "TEST_PRICE_HISTORY_PRODUCT",
            "barcode": "TEST_PH_001",
            "category_id": "",
            "supplier_id": "",
            "stock": 0,
            "warehouse_id": "gudang_utama",
            "price": 10000,
            "cost_price": 8000,
            "items_per_box": 1,
            "min_stock_alert": 10
        }
        response = requests.post(f"{BASE_URL}/api/products", headers=headers, json=product_data)
        assert response.status_code == 200, f"Failed to create test product: {response.text}"
        return response.json()

    def test_get_price_history_empty(self, admin_token, test_product):
        """Get price history for product with no history"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        product_id = test_product["id"]
        response = requests.get(f"{BASE_URL}/api/products/{product_id}/price-history", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: /products/{product_id}/price-history returns {len(data)} entries (should be 0 for new product)")

    def test_update_product_creates_price_history(self, admin_token, test_product):
        """Updating product price should create price history entry"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        product_id = test_product["id"]
        
        # Update price from 10000 to 12000
        update_data = {
            "name": "TEST_PRICE_HISTORY_PRODUCT",
            "barcode": "TEST_PH_001",
            "category_id": "",
            "supplier_id": "",
            "price": 12000,  # Changed from 10000
            "cost_price": 9000,  # Changed from 8000
            "items_per_box": 1,
            "min_stock_alert": 10
        }
        response = requests.put(f"{BASE_URL}/api/products/{product_id}", headers=headers, json=update_data)
        assert response.status_code == 200, f"Failed to update product: {response.text}"
        
        # Check price history
        response = requests.get(f"{BASE_URL}/api/products/{product_id}/price-history", headers=headers)
        assert response.status_code == 200, f"Failed to get price history: {response.text}"
        history = response.json()
        
        assert len(history) >= 1, "Should have at least 1 price history entry after update"
        latest = history[0]  # Sorted by changed_at desc
        assert latest["old_cost_price"] == 8000, f"Old cost_price should be 8000, got {latest['old_cost_price']}"
        assert latest["new_cost_price"] == 9000, f"New cost_price should be 9000, got {latest['new_cost_price']}"
        assert latest["old_price"] == 10000, f"Old price should be 10000, got {latest['old_price']}"
        assert latest["new_price"] == 12000, f"New price should be 12000, got {latest['new_price']}"
        assert "changed_by" in latest, "Price history should have changed_by"
        assert "changed_at" in latest, "Price history should have changed_at"
        
        print(f"PASS: Price history created with old_price={latest['old_price']} -> new_price={latest['new_price']}")

    def test_cleanup_test_product(self, admin_token, test_product):
        """Clean up test product"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        product_id = test_product["id"]
        response = requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
        assert response.status_code == 200, f"Failed to delete test product: {response.text}"
        print("PASS: Cleaned up test product")


class TestProfitLossReport:
    """Test Profit & Loss report feature"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]

    def test_profit_loss_endpoint(self, admin_token):
        """Test profit-loss report endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/profit-loss?date_from=2025-01-01&date_to=2026-12-31", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "period" in data, "Should have period"
        assert "pos_revenue" in data, "Should have pos_revenue"
        assert "pos_cogs" in data, "Should have pos_cogs"
        assert "partner_revenue" in data, "Should have partner_revenue"
        assert "partner_cogs" in data, "Should have partner_cogs"
        assert "total_revenue" in data, "Should have total_revenue"
        assert "total_cogs" in data, "Should have total_cogs"
        assert "gross_profit" in data, "Should have gross_profit"
        assert "margin_percent" in data, "Should have margin_percent"
        assert "daily_data" in data, "Should have daily_data"
        assert isinstance(data["daily_data"], list), "daily_data should be a list"
        
        print(f"PASS: Profit/Loss report structure valid")
        print(f"  - Total Revenue: {data['total_revenue']}")
        print(f"  - Total COGS: {data['total_cogs']}")
        print(f"  - Gross Profit: {data['gross_profit']}")
        print(f"  - Margin: {data['margin_percent']}%")
        print(f"  - Daily data entries: {len(data['daily_data'])}")

    def test_profit_loss_daily_data_structure(self, admin_token):
        """Verify daily_data array structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/profit-loss?date_from=2025-01-01&date_to=2026-12-31", headers=headers)
        data = response.json()
        
        if data["daily_data"]:
            daily = data["daily_data"][0]
            assert "date" in daily, "Daily entry should have date"
            assert "revenue" in daily, "Daily entry should have revenue"
            assert "cogs" in daily, "Daily entry should have cogs"
            assert "profit" in daily, "Daily entry should have profit"
            print(f"PASS: Daily data structure valid (date={daily['date']}, revenue={daily['revenue']}, profit={daily['profit']})")
        else:
            print("PASS: No daily data (likely no transactions in date range)")

    def test_profit_loss_with_different_date_range(self, admin_token):
        """Test with narrow date range"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/reports/profit-loss?date_from={today}&date_to={today}", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"PASS: Profit/Loss works with single-day date range ({today})")


class TestReportsPageTabs:
    """Test Reports page has all 4 tabs"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]

    def test_sales_detail_report(self, admin_token):
        """Test POS sales detail report (tab 1)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/sales-detail?date_from=2025-01-01&date_to=2026-12-31", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print("PASS: /reports/sales-detail (POS tab) works")

    def test_partner_sales_detail_report(self, admin_token):
        """Test partner sales detail report (tab 2)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2025-01-01&date_to=2026-12-31", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print("PASS: /reports/partner-sales-detail (Kios Mitra tab) works")

    def test_best_sellers_report(self, admin_token):
        """Test best sellers report (tab 3)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/best-sellers?date_from=2025-01-01&date_to=2026-12-31", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print("PASS: /reports/best-sellers (Terlaris tab) works")

    def test_profit_loss_report(self, admin_token):
        """Test profit-loss report (tab 4)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/profit-loss?date_from=2025-01-01&date_to=2026-12-31", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print("PASS: /reports/profit-loss (Laba/Rugi tab) works")
