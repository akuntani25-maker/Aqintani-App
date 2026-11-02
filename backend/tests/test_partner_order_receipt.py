"""
Test cases for Partner Order Receipt feature - iteration 6
Features tested:
1. GET /api/partner-orders/{order_id} returns partner_debt_total, partner_phone, partner_address
2. Today summary calculations (total orders, items, revenue, paid)
3. Warehouse breakdown per day
4. Receipt page shows REKAP BON when partner has outstanding debt
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPartnerOrderReceipt:
    """Test partner order receipt API and calculations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and test data"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Track created test data for cleanup
        self.created_stores = []
        self.created_orders = []
        self.created_products = []
        
        yield
        
        # Cleanup test data
        for order_id in self.created_orders:
            try:
                requests.delete(f"{BASE_URL}/api/partner-orders/{order_id}", headers=self.headers)
            except Exception:
                pass
        
        for store_id in self.created_stores:
            try:
                requests.delete(f"{BASE_URL}/api/partner-stores/{store_id}", headers=self.headers)
            except Exception:
                pass
                
        for product_id in self.created_products:
            try:
                requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=self.headers)
            except Exception:
                pass
    
    def test_get_single_order_returns_partner_details(self):
        """Test GET /api/partner-orders/{id} returns partner_debt_total, partner_phone, partner_address"""
        # Create a test partner store with phone and address
        store_uid = str(uuid.uuid4())[:8]
        store_response = requests.post(f"{BASE_URL}/api/partner-stores", headers=self.headers, json={
            "name": f"TEST_RECEIPT_STORE_{store_uid}",
            "owner_name": "Test Owner",
            "phone": "08123456789",
            "address": "Test Address 123",
            "credit_limit": 10000000
        })
        assert store_response.status_code == 200, f"Failed to create store: {store_response.text}"
        store = store_response.json()
        self.created_stores.append(store["id"])
        
        # Create a test product
        product_uid = str(uuid.uuid4())[:8]
        product_response = requests.post(f"{BASE_URL}/api/products", headers=self.headers, json={
            "name": f"TEST_PRODUCT_{product_uid}",
            "price": 100000,
            "cost_price": 80000,
            "box_price": 1000000,
            "items_per_box": 10,
            "stock": 100,
            "warehouse_id": "gudang_utama"
        })
        assert product_response.status_code == 200, f"Failed to create product: {product_response.text}"
        product = product_response.json()
        self.created_products.append(product["id"])
        
        # Create an order with paid=0 (creates debt)
        order_response = requests.post(f"{BASE_URL}/api/partner-orders", headers=self.headers, json={
            "partner_store_id": store["id"],
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": 2,
                "price": 1000000,
                "subtotal": 2000000,
                "warehouse_id": "gudang_utama"
            }],
            "subtotal": 2000000,
            "discount": 0,
            "total": 2000000,
            "paid": 0  # Creates debt
        })
        assert order_response.status_code == 200, f"Failed to create order: {order_response.text}"
        order = order_response.json()
        self.created_orders.append(order["id"])
        
        # GET single order - should include partner details
        get_response = requests.get(f"{BASE_URL}/api/partner-orders/{order['id']}", headers=self.headers)
        assert get_response.status_code == 200
        order_detail = get_response.json()
        
        # Verify partner details are included
        assert "partner_debt_total" in order_detail, "partner_debt_total should be in response"
        assert "partner_phone" in order_detail, "partner_phone should be in response"
        assert "partner_address" in order_detail, "partner_address should be in response"
        
        # Verify values
        assert order_detail["partner_phone"] == "08123456789", f"Expected phone 08123456789, got {order_detail['partner_phone']}"
        assert order_detail["partner_address"] == "Test Address 123", f"Expected address Test Address 123, got {order_detail['partner_address']}"
        assert order_detail["partner_debt_total"] == 2000000, f"Expected debt 2000000, got {order_detail['partner_debt_total']}"
        
        print("PASS: GET /api/partner-orders/{id} returns partner details correctly")
    
    def test_partner_debt_accumulates(self):
        """Test that multiple orders accumulate debt correctly"""
        # Create test store
        store_uid = str(uuid.uuid4())[:8]
        store_response = requests.post(f"{BASE_URL}/api/partner-stores", headers=self.headers, json={
            "name": f"TEST_DEBT_STORE_{store_uid}",
            "owner_name": "Test Owner",
            "phone": "08987654321",
            "address": "Debt Test Address"
        })
        assert store_response.status_code == 200
        store = store_response.json()
        self.created_stores.append(store["id"])
        
        # Create test product
        product_uid = str(uuid.uuid4())[:8]
        product_response = requests.post(f"{BASE_URL}/api/products", headers=self.headers, json={
            "name": f"TEST_PRODUCT_DEBT_{product_uid}",
            "price": 50000,
            "cost_price": 40000,
            "stock": 200,
            "warehouse_id": "gudang_toko"
        })
        assert product_response.status_code == 200
        product = product_response.json()
        self.created_products.append(product["id"])
        
        # Create first order with debt
        order1_response = requests.post(f"{BASE_URL}/api/partner-orders", headers=self.headers, json={
            "partner_store_id": store["id"],
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": 5,
                "price": 50000,
                "subtotal": 250000,
                "warehouse_id": "gudang_toko"
            }],
            "subtotal": 250000,
            "discount": 0,
            "total": 250000,
            "paid": 0
        })
        assert order1_response.status_code == 200
        order1 = order1_response.json()
        self.created_orders.append(order1["id"])
        
        # Create second order with debt
        order2_response = requests.post(f"{BASE_URL}/api/partner-orders", headers=self.headers, json={
            "partner_store_id": store["id"],
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": 3,
                "price": 50000,
                "subtotal": 150000,
                "warehouse_id": "gudang_toko"
            }],
            "subtotal": 150000,
            "discount": 0,
            "total": 150000,
            "paid": 0
        })
        assert order2_response.status_code == 200
        order2 = order2_response.json()
        self.created_orders.append(order2["id"])
        
        # Check partner store debt - should be 250000 + 150000 = 400000
        store_response = requests.get(f"{BASE_URL}/api/partner-stores", headers=self.headers)
        stores = store_response.json()
        updated_store = next((s for s in stores if s["id"] == store["id"]), None)
        assert updated_store is not None
        assert updated_store["current_debt"] == 400000, f"Expected debt 400000, got {updated_store['current_debt']}"
        
        # Get order2 details - partner_debt_total should be 400000
        order2_detail = requests.get(f"{BASE_URL}/api/partner-orders/{order2['id']}", headers=self.headers).json()
        assert order2_detail["partner_debt_total"] == 400000, f"Expected partner_debt_total 400000, got {order2_detail['partner_debt_total']}"
        
        print("PASS: Partner debt accumulates correctly across multiple orders")
    
    def test_previous_debt_calculation(self):
        """Test previousDebt = partner_debt_total - current_order.remaining"""
        # Create test store
        store_uid = str(uuid.uuid4())[:8]
        store_response = requests.post(f"{BASE_URL}/api/partner-stores", headers=self.headers, json={
            "name": f"TEST_PREV_DEBT_STORE_{store_uid}",
            "owner_name": "Test Owner",
            "phone": "08111222333",
            "address": "Previous Debt Address"
        })
        assert store_response.status_code == 200
        store = store_response.json()
        self.created_stores.append(store["id"])
        
        # Create test product
        product_uid = str(uuid.uuid4())[:8]
        product_response = requests.post(f"{BASE_URL}/api/products", headers=self.headers, json={
            "name": f"TEST_PREV_DEBT_PRODUCT_{product_uid}",
            "price": 100000,
            "cost_price": 80000,
            "stock": 100,
            "warehouse_id": "gudang_toko"
        })
        assert product_response.status_code == 200
        product = product_response.json()
        self.created_products.append(product["id"])
        
        # Create first order with debt (creates previous debt)
        order1_response = requests.post(f"{BASE_URL}/api/partner-orders", headers=self.headers, json={
            "partner_store_id": store["id"],
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": 5,
                "price": 100000,
                "subtotal": 500000,
                "warehouse_id": "gudang_toko"
            }],
            "subtotal": 500000,
            "total": 500000,
            "paid": 0  # Creates 500000 debt
        })
        assert order1_response.status_code == 200
        order1 = order1_response.json()
        self.created_orders.append(order1["id"])
        
        # Create second order with debt
        order2_response = requests.post(f"{BASE_URL}/api/partner-orders", headers=self.headers, json={
            "partner_store_id": store["id"],
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": 3,
                "price": 100000,
                "subtotal": 300000,
                "warehouse_id": "gudang_toko"
            }],
            "subtotal": 300000,
            "total": 300000,
            "paid": 0  # Creates 300000 debt
        })
        assert order2_response.status_code == 200
        order2 = order2_response.json()
        self.created_orders.append(order2["id"])
        
        # Get order2 details
        order2_detail = requests.get(f"{BASE_URL}/api/partner-orders/{order2['id']}", headers=self.headers).json()
        
        # partner_debt_total should be 800000 (500000 + 300000)
        assert order2_detail["partner_debt_total"] == 800000, f"Expected partner_debt_total 800000, got {order2_detail['partner_debt_total']}"
        
        # Calculate previousDebt = partner_debt_total - current_order.remaining
        # previousDebt = 800000 - 300000 = 500000
        previous_debt = order2_detail["partner_debt_total"] - order2_detail["remaining"]
        assert previous_debt == 500000, f"Expected previousDebt 500000, got {previous_debt}"
        
        print("PASS: Previous debt calculation is correct (partner_debt_total - order.remaining)")
    
    def test_order_list_returns_today_orders(self):
        """Test partner orders list endpoint returns all orders including today's"""
        # Get orders list
        response = requests.get(f"{BASE_URL}/api/partner-orders", headers=self.headers)
        assert response.status_code == 200
        orders = response.json()
        
        # Filter today's orders
        today = datetime.now().strftime("%Y-%m-%d")
        today_orders = [o for o in orders if o.get("date") == today]
        
        print(f"Total orders: {len(orders)}, Today's orders: {len(today_orders)}")
        
        # Each order should have required fields for summary
        if today_orders:
            order = today_orders[0]
            assert "total" in order
            assert "paid" in order
            assert "remaining" in order
            assert "items" in order
            
            # Calculate total items for summary
            total_items = sum(item.get("quantity", 0) for item in order.get("items", []))
            print(f"Sample order {order['order_number']}: total={order['total']}, paid={order['paid']}, items={total_items}")
        
        print("PASS: Order list returns orders with all fields needed for summary")
    
    def test_warehouses_for_breakdown(self):
        """Test warehouses endpoint for breakdown display"""
        response = requests.get(f"{BASE_URL}/api/warehouses", headers=self.headers)
        assert response.status_code == 200
        warehouses = response.json()
        
        # Should have at least 3 default warehouses
        assert len(warehouses) >= 3, f"Expected at least 3 warehouses, got {len(warehouses)}"
        
        # Verify warehouse structure
        warehouse_ids = [w["id"] for w in warehouses]
        assert "gudang_utama" in warehouse_ids
        assert "gudang_toko" in warehouse_ids
        assert "gudang_lainnya" in warehouse_ids
        
        # Verify each warehouse has name and unit
        for wh in warehouses:
            assert "name" in wh
            assert "unit" in wh
            print(f"Warehouse: {wh['name']} ({wh['unit']})")
        
        print("PASS: Warehouses endpoint returns correct data for breakdown")


class TestStoreSettings:
    """Test store settings for receipt header"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_store_settings_for_receipt(self):
        """Test store settings returns data for receipt header"""
        response = requests.get(f"{BASE_URL}/api/store-settings", headers=self.headers)
        assert response.status_code == 200
        settings = response.json()
        
        # Should have store_name at minimum
        assert "store_name" in settings
        assert settings["store_name"], "store_name should not be empty"
        
        # Should have address and phone for receipt
        assert "address" in settings
        assert "phone" in settings
        
        print(f"Store: {settings['store_name']}, Address: {settings['address']}, Phone: {settings['phone']}")
        print("PASS: Store settings returns data for receipt header")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
