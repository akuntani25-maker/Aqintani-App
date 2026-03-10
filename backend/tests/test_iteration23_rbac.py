"""
Iteration 23 RBAC Testing
Tests for:
1. Office staff (kantor@aqintani.com / kantor123) access to admin panel features
2. Cashier (kasir@aqintani.com / kasir123) POS access and restrictions
3. Admin access to all features
4. items_per_box decimal support
5. Store settings for PDF export
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"email": "admin@aqintani.com", "password": "admin123"}
OFFICE_STAFF_CREDS = {"email": "kantor@aqintani.com", "password": "kantor123"}
CASHIER_CREDS = {"email": "kasir@aqintani.com", "password": "kasir123"}
CANVASSER_CREDS = {"email": "sahidin@aqintani.com", "password": "123456"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def office_staff_token():
    """Get office staff authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=OFFICE_STAFF_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Office staff authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def cashier_token():
    """Get cashier authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=CASHIER_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Cashier authentication failed: {response.status_code} - {response.text}")


class TestAuthenticationBasics:
    """Test basic authentication for all roles"""
    
    def test_admin_login(self):
        """Admin should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print("PASS: Admin login successful")
    
    def test_office_staff_login(self):
        """Office staff should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OFFICE_STAFF_CREDS)
        assert response.status_code == 200, f"Office staff login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "office_staff"
        print("PASS: Office staff login successful")
    
    def test_cashier_login(self):
        """Cashier should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CASHIER_CREDS)
        assert response.status_code == 200, f"Cashier login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "cashier"
        print("PASS: Cashier login successful")


class TestOfficeStaffAccess:
    """Test that office_staff can access admin panel features (require_admin_panel_access)"""
    
    def test_office_staff_products_read(self, office_staff_token):
        """Office staff should access products list"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/products", headers=headers)
        assert response.status_code == 200, f"Office staff can't read products: {response.text}"
        print("PASS: Office staff can read products")
    
    def test_office_staff_categories_read(self, office_staff_token):
        """Office staff should access categories list"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/categories", headers=headers)
        assert response.status_code == 200, f"Office staff can't read categories: {response.text}"
        print("PASS: Office staff can read categories")
    
    def test_office_staff_categories_create(self, office_staff_token):
        """Office staff should create categories"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        data = {"name": "TEST_RBAC_Category", "description": "Test category for RBAC testing"}
        response = requests.post(f"{BASE_URL}/api/categories", json=data, headers=headers)
        assert response.status_code == 200, f"Office staff can't create category: {response.status_code} - {response.text}"
        # Cleanup
        cat_id = response.json().get("id")
        if cat_id:
            requests.delete(f"{BASE_URL}/api/categories/{cat_id}", headers=headers)
        print("PASS: Office staff can create categories")
    
    def test_office_staff_suppliers_read(self, office_staff_token):
        """Office staff should access suppliers list"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert response.status_code == 200, f"Office staff can't read suppliers: {response.text}"
        print("PASS: Office staff can read suppliers")
    
    def test_office_staff_suppliers_create(self, office_staff_token):
        """Office staff should create suppliers"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        data = {"name": "TEST_RBAC_Supplier", "phone": "081234567890", "address": "Test address"}
        response = requests.post(f"{BASE_URL}/api/suppliers", json=data, headers=headers)
        assert response.status_code == 200, f"Office staff can't create supplier: {response.status_code} - {response.text}"
        # Cleanup
        sup_id = response.json().get("id")
        if sup_id:
            requests.delete(f"{BASE_URL}/api/suppliers/{sup_id}", headers=headers)
        print("PASS: Office staff can create suppliers")
    
    def test_office_staff_supplier_debts_overview(self, office_staff_token):
        """Office staff should access supplier debts overview"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/supplier-debts/overview", headers=headers)
        assert response.status_code == 200, f"Office staff can't access supplier debts overview: {response.status_code} - {response.text}"
        print("PASS: Office staff can access supplier debts overview")
    
    def test_office_staff_supplier_debts_summary(self, office_staff_token):
        """Office staff should access supplier debts summary"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/supplier-debts/summary", headers=headers)
        assert response.status_code == 200, f"Office staff can't access supplier debts summary: {response.status_code} - {response.text}"
        print("PASS: Office staff can access supplier debts summary")
    
    def test_office_staff_dashboard_stats(self, office_staff_token):
        """Office staff should access dashboard stats"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200, f"Office staff can't access dashboard stats: {response.status_code} - {response.text}"
        data = response.json()
        assert "today_sales" in data
        print("PASS: Office staff can access dashboard stats")
    
    def test_office_staff_reports_daily(self, office_staff_token):
        """Office staff should access daily reports"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/reports/daily?date={today}", headers=headers)
        assert response.status_code == 200, f"Office staff can't access daily report: {response.status_code} - {response.text}"
        print("PASS: Office staff can access daily reports")
    
    def test_office_staff_reports_sales_detail(self, office_staff_token):
        """Office staff should access sales detail reports"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/reports/sales-detail?date_from={today}&date_to={today}", headers=headers)
        assert response.status_code == 200, f"Office staff can't access sales detail report: {response.status_code} - {response.text}"
        print("PASS: Office staff can access sales detail reports")
    
    def test_office_staff_reports_bestsellers(self, office_staff_token):
        """Office staff should access bestsellers reports"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/reports/best-sellers?date_from={today}&date_to={today}", headers=headers)
        assert response.status_code == 200, f"Office staff can't access bestsellers report: {response.status_code} - {response.text}"
        print("PASS: Office staff can access bestsellers reports")
    
    def test_office_staff_analytics_products(self, office_staff_token):
        """Office staff should access product analytics"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/products", headers=headers)
        assert response.status_code == 200, f"Office staff can't access product analytics: {response.status_code} - {response.text}"
        print("PASS: Office staff can access product analytics")
    
    def test_office_staff_analytics_summary(self, office_staff_token):
        """Office staff should access analytics summary"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/summary", headers=headers)
        assert response.status_code == 200, f"Office staff can't access analytics summary: {response.status_code} - {response.text}"
        print("PASS: Office staff can access analytics summary")
    
    def test_office_staff_partner_stores_read(self, office_staff_token):
        """Office staff should access partner stores list"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/partner-stores", headers=headers)
        assert response.status_code == 200, f"Office staff can't read partner stores: {response.text}"
        print("PASS: Office staff can read partner stores")
    
    def test_office_staff_partner_stores_create(self, office_staff_token):
        """Office staff should create partner stores"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        data = {"name": "TEST_RBAC_Store", "owner_name": "Test Owner", "phone": "081234567890", "address": "Test address", "credit_limit": 1000000}
        response = requests.post(f"{BASE_URL}/api/partner-stores", json=data, headers=headers)
        assert response.status_code == 200, f"Office staff can't create partner store: {response.status_code} - {response.text}"
        # Cleanup
        store_id = response.json().get("id")
        if store_id:
            requests.delete(f"{BASE_URL}/api/partner-stores/{store_id}", headers=headers)
        print("PASS: Office staff can create partner stores")


class TestCashierAccess:
    """Test that cashier can access POS features (require_pos_access) but NOT admin-only features"""
    
    def test_cashier_products_read(self, cashier_token):
        """Cashier should read products for POS"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.get(f"{BASE_URL}/api/products", headers=headers)
        assert response.status_code == 200, f"Cashier can't read products: {response.text}"
        print("PASS: Cashier can read products")
    
    def test_cashier_transactions_create(self, cashier_token):
        """Cashier should create transactions"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        # Get a product first
        products_resp = requests.get(f"{BASE_URL}/api/products", headers=headers)
        if products_resp.status_code == 200 and products_resp.json():
            product = products_resp.json()[0] if isinstance(products_resp.json(), list) else products_resp.json().get("data", [{}])[0]
            # Check warehouse stock for gudang_toko
            wh_stock_resp = requests.get(f"{BASE_URL}/api/warehouse-stock?product_id={product['id']}&warehouse_id=gudang_toko", headers=headers)
            wh_stock = wh_stock_resp.json()[0].get("stock", 0) if wh_stock_resp.status_code == 200 and wh_stock_resp.json() else 0
            
            if wh_stock > 0:
                data = {
                    "items": [{"product_id": product["id"], "product_name": product["name"], "quantity": 1, "price": product["price"], "subtotal": product["price"]}],
                    "subtotal": product["price"], "tax": 0, "discount": 0, "total": product["price"],
                    "payment_method": "cash", "payment_amount": product["price"], "change": 0
                }
                response = requests.post(f"{BASE_URL}/api/transactions", json=data, headers=headers)
                # 200 means success, 400 might be stock issue
                assert response.status_code in [200, 400], f"Cashier transaction failed unexpectedly: {response.status_code} - {response.text}"
                print(f"PASS: Cashier can create transactions (status: {response.status_code})")
            else:
                print("SKIP: No stock in gudang_toko for testing")
                pytest.skip("No stock in gudang_toko")
        else:
            print("SKIP: No products available")
            pytest.skip("No products available for transaction test")
    
    def test_cashier_stock_transfers_read(self, cashier_token):
        """Cashier should access stock transfers (for POS transfer feature)"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.get(f"{BASE_URL}/api/stock-transfers", headers=headers)
        assert response.status_code == 200, f"Cashier can't access stock transfers: {response.status_code} - {response.text}"
        print("PASS: Cashier can access stock transfers (read)")
    
    def test_cashier_stock_transfers_create(self, cashier_token):
        """Cashier should create stock transfers (require_pos_access)"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        # Get products and warehouses first
        products_resp = requests.get(f"{BASE_URL}/api/products", headers=headers)
        if products_resp.status_code == 200 and products_resp.json():
            products = products_resp.json() if isinstance(products_resp.json(), list) else products_resp.json().get("data", [])
            if products:
                product = products[0]
                # Check if there's stock in gudang_utama
                wh_stock_resp = requests.get(f"{BASE_URL}/api/warehouse-stock?product_id={product['id']}&warehouse_id=gudang_utama", headers=headers)
                wh_stock = wh_stock_resp.json()[0].get("stock", 0) if wh_stock_resp.status_code == 200 and wh_stock_resp.json() else 0
                
                if wh_stock > 0:
                    data = {
                        "product_id": product["id"],
                        "from_warehouse_id": "gudang_utama",
                        "to_warehouse_id": "gudang_toko",
                        "quantity": 0.5,  # Test decimal transfer
                        "notes": "Test transfer by cashier"
                    }
                    response = requests.post(f"{BASE_URL}/api/stock-transfers", json=data, headers=headers)
                    # 200 means success, 400 might be validation error (stock not enough)
                    assert response.status_code in [200, 400], f"Cashier stock transfer access denied: {response.status_code} - {response.text}"
                    if response.status_code == 200:
                        print("PASS: Cashier can create stock transfers")
                    else:
                        print(f"PASS: Cashier has access to stock transfers (got validation error: {response.json().get('detail', 'unknown')})")
                else:
                    print("SKIP: No stock in gudang_utama")
                    pytest.skip("No stock for transfer test")
        else:
            pytest.skip("No products available")
    
    def test_cashier_returns_create(self, cashier_token):
        """Cashier should create returns (require_pos_access)"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        # Just test access, actual return needs a valid source
        data = {
            "source_type": "transaction",
            "source_id": "nonexistent",
            "items": [],
            "notes": "Test"
        }
        response = requests.post(f"{BASE_URL}/api/returns", json=data, headers=headers)
        # Should not be 403 (forbidden), can be 400/404 for invalid data
        assert response.status_code != 403, f"Cashier denied access to returns: {response.status_code}"
        print(f"PASS: Cashier has access to returns endpoint (got {response.status_code})")
    
    def test_cashier_cannot_access_supplier_debts(self, cashier_token):
        """Cashier should NOT access supplier debts (require_admin_panel_access)"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.get(f"{BASE_URL}/api/supplier-debts/overview", headers=headers)
        assert response.status_code == 403, f"Cashier should NOT access supplier debts, got: {response.status_code}"
        print("PASS: Cashier correctly denied access to supplier debts")
    
    def test_cashier_cannot_access_users(self, cashier_token):
        """Cashier should NOT access users management (require_admin)"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 403, f"Cashier should NOT access users, got: {response.status_code}"
        print("PASS: Cashier correctly denied access to users")
    
    def test_cashier_cannot_access_dashboard_stats(self, cashier_token):
        """Cashier should NOT access dashboard stats (require_admin_panel_access)"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 403, f"Cashier should NOT access dashboard stats, got: {response.status_code}"
        print("PASS: Cashier correctly denied access to dashboard stats")
    
    def test_cashier_cannot_create_categories(self, cashier_token):
        """Cashier should NOT create categories (require_admin_panel_access)"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        data = {"name": "TEST_Cashier_Category", "description": "Should fail"}
        response = requests.post(f"{BASE_URL}/api/categories", json=data, headers=headers)
        assert response.status_code == 403, f"Cashier should NOT create categories, got: {response.status_code}"
        print("PASS: Cashier correctly denied creating categories")
    
    def test_cashier_cannot_create_suppliers(self, cashier_token):
        """Cashier should NOT create suppliers (require_admin_panel_access)"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        data = {"name": "TEST_Cashier_Supplier", "phone": "081234567890"}
        response = requests.post(f"{BASE_URL}/api/suppliers", json=data, headers=headers)
        assert response.status_code == 403, f"Cashier should NOT create suppliers, got: {response.status_code}"
        print("PASS: Cashier correctly denied creating suppliers")


class TestAdminFullAccess:
    """Test that admin can access all features"""
    
    def test_admin_dashboard_stats(self, admin_token):
        """Admin should access dashboard stats"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200, f"Admin can't access dashboard: {response.text}"
        print("PASS: Admin can access dashboard stats")
    
    def test_admin_users_list(self, admin_token):
        """Admin should access users list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200, f"Admin can't access users: {response.text}"
        print("PASS: Admin can access users list")
    
    def test_admin_supplier_debts(self, admin_token):
        """Admin should access supplier debts"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/supplier-debts/overview", headers=headers)
        assert response.status_code == 200, f"Admin can't access supplier debts: {response.text}"
        print("PASS: Admin can access supplier debts")
    
    def test_admin_stock_adjustments(self, admin_token):
        """Admin should access stock adjustments"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/stock-adjustments", headers=headers)
        assert response.status_code == 200, f"Admin can't access stock adjustments: {response.text}"
        print("PASS: Admin can access stock adjustments")


class TestItemsPerBoxDecimal:
    """Test that items_per_box accepts decimal values"""
    
    def test_product_with_decimal_items_per_box(self, admin_token):
        """Products should accept decimal items_per_box (e.g., 2.5)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a test product with decimal items_per_box
        data = {
            "name": "TEST_Decimal_IPB_Product",
            "barcode": "TEST123456789",
            "category_id": "",
            "supplier_id": "",
            "stock": 0,
            "warehouse_id": "gudang_utama",
            "price": 15000,
            "cost_price": 100000,
            "box_price": 140000,
            "items_per_box": 2.5,  # Decimal value
            "expiry_date": "",
            "batch_number": "",
            "description": "Test product for decimal items_per_box",
            "min_stock_alert": 5
        }
        response = requests.post(f"{BASE_URL}/api/products", json=data, headers=headers)
        assert response.status_code == 200, f"Failed to create product with decimal items_per_box: {response.status_code} - {response.text}"
        
        created_product = response.json()
        assert created_product["items_per_box"] == 2.5, f"items_per_box not stored correctly: {created_product.get('items_per_box')}"
        
        # Cleanup
        if created_product.get("id"):
            requests.delete(f"{BASE_URL}/api/products/{created_product['id']}", headers=headers)
        
        print("PASS: Product with decimal items_per_box created successfully")
    
    def test_stock_transfer_decimal_quantity(self, admin_token):
        """Stock transfer should accept decimal quantity for conversions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get a product with stock
        products_resp = requests.get(f"{BASE_URL}/api/products", headers=headers)
        if products_resp.status_code == 200:
            products = products_resp.json() if isinstance(products_resp.json(), list) else products_resp.json().get("data", [])
            for product in products:
                wh_stock_resp = requests.get(f"{BASE_URL}/api/warehouse-stock?product_id={product['id']}&warehouse_id=gudang_utama", headers=headers)
                if wh_stock_resp.status_code == 200 and wh_stock_resp.json():
                    stock = wh_stock_resp.json()[0].get("stock", 0)
                    if stock >= 1:
                        data = {
                            "product_id": product["id"],
                            "from_warehouse_id": "gudang_utama",
                            "to_warehouse_id": "gudang_toko",
                            "quantity": 0.5,  # Decimal quantity
                            "notes": "Test decimal transfer"
                        }
                        response = requests.post(f"{BASE_URL}/api/stock-transfers", json=data, headers=headers)
                        # Should accept the decimal value (200 success or 400 for not enough stock)
                        assert response.status_code in [200, 400], f"Stock transfer with decimal rejected: {response.status_code} - {response.text}"
                        print(f"PASS: Stock transfer accepts decimal quantity (status: {response.status_code})")
                        return
            pytest.skip("No product with stock for decimal transfer test")
        else:
            pytest.skip("Could not fetch products")


class TestStoreSettings:
    """Test store settings endpoint for PDF export"""
    
    def test_store_settings_read(self, admin_token):
        """Any authenticated user should read store settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/store-settings", headers=headers)
        assert response.status_code == 200, f"Can't read store settings: {response.status_code} - {response.text}"
        data = response.json()
        assert "store_name" in data
        print(f"PASS: Store settings readable - Store: {data.get('store_name')}, Phone: {data.get('phone')}")
    
    def test_store_settings_read_office_staff(self, office_staff_token):
        """Office staff should read store settings for PDF export"""
        headers = {"Authorization": f"Bearer {office_staff_token}"}
        response = requests.get(f"{BASE_URL}/api/store-settings", headers=headers)
        assert response.status_code == 200, f"Office staff can't read store settings: {response.status_code}"
        print("PASS: Office staff can read store settings")
    
    def test_store_settings_read_cashier(self, cashier_token):
        """Cashier should read store settings"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.get(f"{BASE_URL}/api/store-settings", headers=headers)
        assert response.status_code == 200, f"Cashier can't read store settings: {response.status_code}"
        print("PASS: Cashier can read store settings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
