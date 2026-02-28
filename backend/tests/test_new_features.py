"""
Backend API tests for NEW features in UD. Aqin Tani app
Tests: Purchases, Analytics, Partner Store Payments, Canvasser Notifications
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ===== PURCHASES API TESTS =====
class TestPurchasesAPI:
    """Purchases (from Suppliers) endpoint tests - NEW FEATURE"""
    
    def test_get_purchases(self, admin_token):
        """Test listing purchases"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/purchases", headers=headers)
        assert response.status_code == 200, f"Get purchases failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} purchases")
        return data
    
    def test_create_purchase_and_verify(self, admin_token, test_supplier, test_product):
        """Test creating a new purchase and verify persistence"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        purchase_data = {
            "supplier_id": test_supplier["id"],
            "items": [
                {
                    "product_id": test_product["id"],
                    "product_name": test_product["name"],
                    "quantity": 10,
                    "cost_price": test_product["cost_price"],
                    "subtotal": test_product["cost_price"] * 10
                }
            ],
            "total": test_product["cost_price"] * 10,
            "paid": 50000,
            "notes": "TEST_Purchase for testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/purchases", json=purchase_data, headers=headers)
        assert response.status_code == 200, f"Create purchase failed: {response.text}"
        
        data = response.json()
        assert data["supplier_id"] == test_supplier["id"]
        assert data["supplier_name"] == test_supplier["name"]
        assert data["total"] == purchase_data["total"]
        assert data["paid"] == purchase_data["paid"]
        assert data["remaining"] == purchase_data["total"] - purchase_data["paid"]
        assert "id" in data
        
        print(f"✓ Created purchase: {data['id']} from {data['supplier_name']}")
        print(f"  Total: {data['total']}, Paid: {data['paid']}, Remaining: {data['remaining']}")
        return data
    
    def test_pay_purchase(self, admin_token, test_purchase):
        """Test paying off purchase debt (hutang)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get initial state
        initial_remaining = test_purchase["remaining"]
        payment_amount = 25000
        
        # Pay part of the debt
        response = requests.post(
            f"{BASE_URL}/api/purchases/{test_purchase['id']}/pay?amount={payment_amount}",
            headers=headers
        )
        assert response.status_code == 200, f"Pay purchase failed: {response.text}"
        
        data = response.json()
        expected_remaining = initial_remaining - payment_amount
        assert data["remaining"] == expected_remaining, f"Expected remaining {expected_remaining}, got {data['remaining']}"
        
        print(f"✓ Paid {payment_amount}, remaining: {data['remaining']}")
        return data
    
    def test_delete_purchase(self, admin_token, test_purchase_to_delete):
        """Test deleting a purchase"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.delete(f"{BASE_URL}/api/purchases/{test_purchase_to_delete['id']}", headers=headers)
        assert response.status_code == 200, f"Delete purchase failed: {response.text}"
        
        # Verify deletion
        purchases = requests.get(f"{BASE_URL}/api/purchases", headers=headers).json()
        purchase_ids = [p["id"] for p in purchases]
        assert test_purchase_to_delete["id"] not in purchase_ids
        
        print(f"✓ Deleted purchase: {test_purchase_to_delete['id']}")


# ===== ANALYTICS API TESTS =====
class TestAnalyticsAPI:
    """Analytics endpoint tests - NEW FEATURE"""
    
    def test_analytics_summary(self, admin_token):
        """Test /api/analytics/summary endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/summary", headers=headers)
        assert response.status_code == 200, f"Get analytics summary failed: {response.text}"
        
        data = response.json()
        # Verify all expected fields
        assert "monthly_sales" in data
        assert "monthly_transactions" in data
        assert "monthly_purchases" in data
        assert "monthly_purchases_unpaid" in data
        assert "total_partner_sales" in data
        assert "total_partner_unpaid" in data
        assert "estimated_margin" in data
        assert "chart_data" in data
        assert "category_breakdown" in data
        
        # Verify chart_data has 30 days
        assert len(data["chart_data"]) == 30, f"Expected 30 days of chart data, got {len(data['chart_data'])}"
        
        print(f"✓ Analytics summary:")
        print(f"  Monthly sales: {data['monthly_sales']}")
        print(f"  Monthly purchases: {data['monthly_purchases']}")
        print(f"  Partner sales: {data['total_partner_sales']}")
        print(f"  Estimated margin: {data['estimated_margin']}")
        return data
    
    def test_analytics_products(self, admin_token):
        """Test /api/analytics/products endpoint (fast/slow moving)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/products", headers=headers)
        assert response.status_code == 200, f"Get analytics products failed: {response.text}"
        
        data = response.json()
        assert "fast_moving" in data
        assert "slow_moving" in data
        assert isinstance(data["fast_moving"], list)
        assert isinstance(data["slow_moving"], list)
        
        print(f"✓ Product analytics:")
        print(f"  Fast moving products: {len(data['fast_moving'])}")
        print(f"  Slow moving products: {len(data['slow_moving'])}")
        return data


# ===== PARTNER STORE PAYMENTS API TESTS =====
class TestPartnerStorePaymentsAPI:
    """Partner store setoran/payment tests - NEW FEATURE"""
    
    def test_pay_partner_store(self, admin_token, test_partner_store_with_debt):
        """Test recording setoran (payment) for partner store"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        store = test_partner_store_with_debt
        
        initial_debt = store.get("current_debt", 0)
        payment_amount = 50000
        
        response = requests.post(
            f"{BASE_URL}/api/partner-stores/{store['id']}/pay?amount={payment_amount}&notes=TEST_Setoran",
            headers=headers
        )
        assert response.status_code == 200, f"Pay partner store failed: {response.text}"
        
        data = response.json()
        assert "new_debt" in data
        assert "payment" in data
        
        expected_debt = max(0, initial_debt - payment_amount)
        assert data["new_debt"] == expected_debt
        
        print(f"✓ Partner store payment recorded:")
        print(f"  Store: {store['name']}")
        print(f"  Payment: {payment_amount}, New debt: {data['new_debt']}")
        return data
    
    def test_get_partner_store_payments(self, admin_token, test_partner_store_with_debt):
        """Test getting payment history for a partner store"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        store = test_partner_store_with_debt
        
        response = requests.get(f"{BASE_URL}/api/partner-stores/{store['id']}/payments", headers=headers)
        assert response.status_code == 200, f"Get partner store payments failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ Got {len(data)} payment records for {store['name']}")
        return data


# ===== CANVASSER NOTIFICATIONS API TESTS =====
class TestCanvasserNotificationsAPI:
    """Canvasser notifications endpoint tests - NEW FEATURE"""
    
    def test_canvasser_notifications(self, canvasser_token):
        """Test /api/canvassers/notifications endpoint"""
        if canvasser_token is None:
            pytest.skip("Canvasser token not available")
        
        headers = {"Authorization": f"Bearer {canvasser_token}"}
        response = requests.get(f"{BASE_URL}/api/canvassers/notifications", headers=headers)
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        
        data = response.json()
        assert "new_orders" in data
        assert "pending_orders" in data
        assert "total_remaining" in data
        
        print(f"✓ Canvasser notifications:")
        print(f"  New orders today: {data['new_orders']}")
        print(f"  Pending orders: {data['pending_orders']}")
        print(f"  Total remaining: {data['total_remaining']}")
        return data


# ===== SUPPLIER DEBT API TESTS =====
class TestSupplierDebtAPI:
    """Supplier debt summary tests"""
    
    def test_get_supplier_debt(self, admin_token, test_supplier):
        """Test /api/suppliers/{id}/debt endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/suppliers/{test_supplier['id']}/debt", headers=headers)
        assert response.status_code == 200, f"Get supplier debt failed: {response.text}"
        
        data = response.json()
        assert "supplier_id" in data
        assert "total_purchases" in data
        assert "total_paid" in data
        assert "total_remaining" in data
        assert "purchase_count" in data
        
        print(f"✓ Supplier debt summary for {test_supplier['name']}:")
        print(f"  Total purchases: {data['total_purchases']}")
        print(f"  Total remaining: {data['total_remaining']}")


# ===== FIXTURES =====
@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@aqintani.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Admin login failed")


@pytest.fixture(scope="module")
def canvasser_token():
    """Get canvasser authentication token"""
    # Try new format first
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kanvaser1@aqintani.com",
        "password": "canvasser123"
    })
    if response.status_code == 200:
        return response.json()["token"]
    
    # Try old format
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ahmadrifai@aqintani.com",
        "password": "canvasser123"
    })
    if response.status_code == 200:
        return response.json()["token"]
    
    return None


@pytest.fixture(scope="module")
def test_supplier(admin_token):
    """Create test supplier for purchases"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Check existing suppliers first
    suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=headers).json()
    if suppliers:
        return suppliers[0]
    
    # Create new supplier
    supplier_data = {
        "name": "TEST_Supplier Utama",
        "contact_person": "Test Contact",
        "phone": "0812-9999-0000",
        "email": "test@supplier.com",
        "address": "Jl. Test Supplier"
    }
    response = requests.post(f"{BASE_URL}/api/suppliers", json=supplier_data, headers=headers)
    return response.json()


@pytest.fixture(scope="module")
def test_product(admin_token):
    """Get or create test product"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Check existing products
    products = requests.get(f"{BASE_URL}/api/products", headers=headers).json()
    if products:
        return products[0]
    
    # Create new product
    product_data = {
        "name": "TEST_Produk Uji",
        "barcode": "TEST001",
        "stock": 100,
        "price": 15000,
        "cost_price": 10000,
        "min_stock_alert": 10
    }
    response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
    return response.json()


@pytest.fixture
def test_purchase(admin_token, test_supplier, test_product):
    """Create test purchase for payment testing"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    purchase_data = {
        "supplier_id": test_supplier["id"],
        "items": [
            {
                "product_id": test_product["id"],
                "product_name": test_product["name"],
                "quantity": 5,
                "cost_price": test_product["cost_price"],
                "subtotal": test_product["cost_price"] * 5
            }
        ],
        "total": test_product["cost_price"] * 5,
        "paid": 0,
        "notes": "TEST_Purchase for pay test"
    }
    
    response = requests.post(f"{BASE_URL}/api/purchases", json=purchase_data, headers=headers)
    purchase = response.json()
    
    yield purchase
    
    # Cleanup
    try:
        requests.delete(f"{BASE_URL}/api/purchases/{purchase['id']}", headers=headers)
    except:
        pass


@pytest.fixture
def test_purchase_to_delete(admin_token, test_supplier, test_product):
    """Create test purchase for deletion testing"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    purchase_data = {
        "supplier_id": test_supplier["id"],
        "items": [
            {
                "product_id": test_product["id"],
                "product_name": test_product["name"],
                "quantity": 1,
                "cost_price": test_product["cost_price"],
                "subtotal": test_product["cost_price"]
            }
        ],
        "total": test_product["cost_price"],
        "paid": 0,
        "notes": "TEST_To be deleted"
    }
    
    response = requests.post(f"{BASE_URL}/api/purchases", json=purchase_data, headers=headers)
    return response.json()


@pytest.fixture(scope="module")
def test_partner_store_with_debt(admin_token):
    """Get or create partner store with debt for testing"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Check existing stores
    stores = requests.get(f"{BASE_URL}/api/partner-stores", headers=headers).json()
    
    # Find existing store or create new
    for store in stores:
        if store.get("current_debt", 0) > 0:
            return store
    
    # If no store with debt, create one and add order to create debt
    if stores:
        store = stores[0]
    else:
        store_data = {
            "name": "TEST_Kios Mitra Debt",
            "owner_name": "Test Owner",
            "phone": "0812-0000-1111",
            "address": "Jl. Test Debt",
            "credit_limit": 10000000
        }
        store = requests.post(f"{BASE_URL}/api/partner-stores", json=store_data, headers=headers).json()
    
    # Get product for order
    products = requests.get(f"{BASE_URL}/api/products", headers=headers).json()
    if products:
        product = products[0]
        
        # Create order to generate debt
        order_data = {
            "partner_store_id": store["id"],
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": 2,
                "price": product["price"],
                "subtotal": product["price"] * 2
            }],
            "subtotal": product["price"] * 2,
            "discount": 0,
            "total": product["price"] * 2,
            "paid": 0
        }
        requests.post(f"{BASE_URL}/api/partner-orders", json=order_data, headers=headers)
    
    # Refresh store data
    stores = requests.get(f"{BASE_URL}/api/partner-stores", headers=headers).json()
    for s in stores:
        if s["id"] == store["id"]:
            return s
    
    return store


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(admin_token):
    """Cleanup TEST_ prefixed data after tests"""
    yield
    if admin_token:
        headers = {"Authorization": f"Bearer {admin_token}"}
        try:
            # Clean up test purchases
            purchases = requests.get(f"{BASE_URL}/api/purchases", headers=headers).json()
            for p in purchases:
                if p.get("notes", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/purchases/{p['id']}", headers=headers)
        except:
            pass
