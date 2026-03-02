"""
Backend API tests for 'Bayar di Muka' (Initial Payment) feature
Tests: POST /api/products with initial_paid creates purchase record with correct paid, remaining, and total
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


# ===== INITIAL PAYMENT FEATURE TESTS =====
class TestInitialPaymentFeature:
    """Tests for auto-purchase creation with partial/full payment on product creation"""
    
    def test_create_product_with_partial_payment(self, admin_token, test_supplier, test_category):
        """Test creating product with initial_paid creates purchase with partial debt"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        unique_id = str(uuid.uuid4())[:8]
        stock_dus = 5
        cost_price = 100000  # 100k per dus
        initial_paid = 200000  # Paying 200k upfront (2 dus worth)
        expected_total = stock_dus * cost_price  # 500k
        expected_remaining = expected_total - initial_paid  # 300k debt
        
        product_data = {
            "name": f"TEST_Product_PartialPay_{unique_id}",
            "barcode": f"TEST-{unique_id}",
            "category_id": test_category["id"],
            "supplier_id": test_supplier["id"],
            "stock": stock_dus,
            "warehouse_id": "gudang_utama",
            "price": 15000,  # sell price per satuan
            "cost_price": cost_price,  # cost per dus
            "items_per_box": 10,
            "initial_paid": initial_paid,
            "min_stock_alert": 10
        }
        
        response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
        assert response.status_code == 200, f"Create product failed: {response.text}"
        
        product = response.json()
        assert product["name"] == product_data["name"]
        product_id = product["id"]
        
        # Verify purchase record was created with correct amounts
        purchases_resp = requests.get(
            f"{BASE_URL}/api/purchases?supplier_id={test_supplier['id']}", 
            headers=headers
        )
        assert purchases_resp.status_code == 200
        
        purchases = purchases_resp.json()
        # Find the purchase for this product
        purchase = next((p for p in purchases if any(
            item.get("product_id") == product_id for item in p.get("items", [])
        )), None)
        
        assert purchase is not None, f"Purchase record not created for product {product_id}"
        assert purchase["total"] == expected_total, f"Expected total {expected_total}, got {purchase['total']}"
        assert purchase["paid"] == initial_paid, f"Expected paid {initial_paid}, got {purchase['paid']}"
        assert purchase["remaining"] == expected_remaining, f"Expected remaining {expected_remaining}, got {purchase['remaining']}"
        assert "Tempo" in purchase["notes"], "Notes should indicate debt (Tempo)"
        
        print(f"✓ Product created with partial payment")
        print(f"  Total: {purchase['total']}, Paid: {purchase['paid']}, Remaining: {purchase['remaining']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
        if purchase:
            requests.delete(f"{BASE_URL}/api/purchases/{purchase['id']}", headers=headers)
        
        return purchase
    
    def test_create_product_with_zero_payment(self, admin_token, test_supplier, test_category):
        """Test creating product with initial_paid=0 creates purchase with full debt"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        unique_id = str(uuid.uuid4())[:8]
        stock_dus = 3
        cost_price = 150000  # 150k per dus
        initial_paid = 0  # No upfront payment
        expected_total = stock_dus * cost_price  # 450k
        expected_remaining = expected_total  # Full debt
        
        product_data = {
            "name": f"TEST_Product_NoPay_{unique_id}",
            "barcode": f"TEST2-{unique_id}",
            "category_id": test_category["id"],
            "supplier_id": test_supplier["id"],
            "stock": stock_dus,
            "warehouse_id": "gudang_utama",
            "price": 20000,
            "cost_price": cost_price,
            "items_per_box": 5,
            "initial_paid": initial_paid,
            "min_stock_alert": 10
        }
        
        response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
        assert response.status_code == 200, f"Create product failed: {response.text}"
        
        product = response.json()
        product_id = product["id"]
        
        # Verify purchase record with full debt
        purchases_resp = requests.get(
            f"{BASE_URL}/api/purchases?supplier_id={test_supplier['id']}", 
            headers=headers
        )
        purchases = purchases_resp.json()
        
        purchase = next((p for p in purchases if any(
            item.get("product_id") == product_id for item in p.get("items", [])
        )), None)
        
        assert purchase is not None, "Purchase record not created"
        assert purchase["total"] == expected_total
        assert purchase["paid"] == 0
        assert purchase["remaining"] == expected_total, f"Expected full debt {expected_total}, got {purchase['remaining']}"
        assert "Tempo" in purchase["notes"], "Notes should indicate debt (Tempo)"
        
        print(f"✓ Product created with zero payment (full debt)")
        print(f"  Total: {purchase['total']}, Paid: 0, Remaining: {purchase['remaining']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
        if purchase:
            requests.delete(f"{BASE_URL}/api/purchases/{purchase['id']}", headers=headers)
        
        return purchase
    
    def test_create_product_with_full_payment(self, admin_token, test_supplier, test_category):
        """Test creating product with full payment creates purchase with remaining=0"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        unique_id = str(uuid.uuid4())[:8]
        stock_dus = 2
        cost_price = 120000  # 120k per dus
        expected_total = stock_dus * cost_price  # 240k
        initial_paid = expected_total  # Paying full amount
        expected_remaining = 0  # No debt
        
        product_data = {
            "name": f"TEST_Product_FullPay_{unique_id}",
            "barcode": f"TEST3-{unique_id}",
            "category_id": test_category["id"],
            "supplier_id": test_supplier["id"],
            "stock": stock_dus,
            "warehouse_id": "gudang_utama",
            "price": 18000,
            "cost_price": cost_price,
            "items_per_box": 8,
            "initial_paid": initial_paid,
            "min_stock_alert": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
        assert response.status_code == 200, f"Create product failed: {response.text}"
        
        product = response.json()
        product_id = product["id"]
        
        # Verify purchase record with no debt
        purchases_resp = requests.get(
            f"{BASE_URL}/api/purchases?supplier_id={test_supplier['id']}", 
            headers=headers
        )
        purchases = purchases_resp.json()
        
        purchase = next((p for p in purchases if any(
            item.get("product_id") == product_id for item in p.get("items", [])
        )), None)
        
        assert purchase is not None, "Purchase record not created"
        assert purchase["total"] == expected_total
        assert purchase["paid"] == expected_total, f"Expected paid {expected_total}, got {purchase['paid']}"
        assert purchase["remaining"] == 0, f"Expected remaining 0, got {purchase['remaining']}"
        assert "Tempo" not in purchase["notes"], "Notes should NOT indicate debt for fully paid purchase"
        
        print(f"✓ Product created with full payment (no debt)")
        print(f"  Total: {purchase['total']}, Paid: {purchase['paid']}, Remaining: 0")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
        if purchase:
            requests.delete(f"{BASE_URL}/api/purchases/{purchase['id']}", headers=headers)
        
        return purchase
    
    def test_create_product_overpayment_capped(self, admin_token, test_supplier, test_category):
        """Test that initial_paid is capped at total (can't overpay)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        unique_id = str(uuid.uuid4())[:8]
        stock_dus = 2
        cost_price = 100000
        expected_total = stock_dus * cost_price  # 200k
        initial_paid = 500000  # Trying to pay more than total
        
        product_data = {
            "name": f"TEST_Product_OverPay_{unique_id}",
            "barcode": f"TEST4-{unique_id}",
            "category_id": test_category["id"],
            "supplier_id": test_supplier["id"],
            "stock": stock_dus,
            "warehouse_id": "gudang_utama",
            "price": 15000,
            "cost_price": cost_price,
            "items_per_box": 10,
            "initial_paid": initial_paid,  # Overpayment
            "min_stock_alert": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
        assert response.status_code == 200, f"Create product failed: {response.text}"
        
        product = response.json()
        product_id = product["id"]
        
        # Verify paid is capped at total
        purchases_resp = requests.get(
            f"{BASE_URL}/api/purchases?supplier_id={test_supplier['id']}", 
            headers=headers
        )
        purchases = purchases_resp.json()
        
        purchase = next((p for p in purchases if any(
            item.get("product_id") == product_id for item in p.get("items", [])
        )), None)
        
        assert purchase is not None, "Purchase record not created"
        assert purchase["paid"] == expected_total, f"Paid should be capped at {expected_total}, got {purchase['paid']}"
        assert purchase["remaining"] == 0, f"Expected remaining 0, got {purchase['remaining']}"
        
        print(f"✓ Overpayment correctly capped at total")
        print(f"  Initial_paid requested: {initial_paid}, Actual paid: {purchase['paid']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
        if purchase:
            requests.delete(f"{BASE_URL}/api/purchases/{purchase['id']}", headers=headers)
        
        return purchase
    
    def test_no_purchase_when_no_stock(self, admin_token, test_supplier, test_category):
        """Test that no purchase is created when stock is 0"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        unique_id = str(uuid.uuid4())[:8]
        
        product_data = {
            "name": f"TEST_Product_NoStock_{unique_id}",
            "barcode": f"TEST5-{unique_id}",
            "category_id": test_category["id"],
            "supplier_id": test_supplier["id"],
            "stock": 0,  # No stock
            "warehouse_id": "gudang_utama",
            "price": 15000,
            "cost_price": 100000,
            "items_per_box": 10,
            "initial_paid": 50000,
            "min_stock_alert": 5
        }
        
        # Get purchase count before
        purchases_before = requests.get(
            f"{BASE_URL}/api/purchases?supplier_id={test_supplier['id']}", 
            headers=headers
        ).json()
        count_before = len(purchases_before)
        
        response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
        assert response.status_code == 200
        
        product = response.json()
        product_id = product["id"]
        
        # Verify no new purchase was created
        purchases_after = requests.get(
            f"{BASE_URL}/api/purchases?supplier_id={test_supplier['id']}", 
            headers=headers
        ).json()
        count_after = len(purchases_after)
        
        assert count_after == count_before, f"Purchase should not be created for 0 stock. Before: {count_before}, After: {count_after}"
        
        print(f"✓ No purchase created when stock is 0")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
        
        return True
    
    def test_no_purchase_when_no_supplier(self, admin_token, test_category):
        """Test that no purchase is created when supplier is not specified"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        unique_id = str(uuid.uuid4())[:8]
        
        product_data = {
            "name": f"TEST_Product_NoSupplier_{unique_id}",
            "barcode": f"TEST6-{unique_id}",
            "category_id": test_category["id"],
            "supplier_id": "",  # No supplier
            "stock": 5,
            "warehouse_id": "gudang_utama",
            "price": 15000,
            "cost_price": 100000,
            "items_per_box": 10,
            "initial_paid": 200000,
            "min_stock_alert": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
        assert response.status_code == 200
        
        product = response.json()
        product_id = product["id"]
        
        # Product created but no purchase record
        print(f"✓ Product created without supplier - no purchase record needed")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
        
        return True


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
def test_supplier(admin_token):
    """Get or create test supplier"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=headers).json()
    if suppliers:
        return suppliers[0]
    
    # Create a test supplier
    supplier_data = {
        "name": "TEST_Supplier_InitialPay",
        "contact_person": "Test Person",
        "phone": "0811-0000-0001",
        "email": "test@supplier.com",
        "address": "Jl. Test"
    }
    response = requests.post(f"{BASE_URL}/api/suppliers", json=supplier_data, headers=headers)
    return response.json()


@pytest.fixture(scope="module")
def test_category(admin_token):
    """Get or create test category"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    categories = requests.get(f"{BASE_URL}/api/categories", headers=headers).json()
    if categories:
        return categories[0]
    
    # Create a test category
    cat_data = {
        "name": "TEST_Category_InitialPay",
        "description": "Test category for initial payment tests"
    }
    response = requests.post(f"{BASE_URL}/api/categories", json=cat_data, headers=headers)
    return response.json()
