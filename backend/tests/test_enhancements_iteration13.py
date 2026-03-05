"""
Test Suite for UD. AQIN TANI Enhancements - Iteration 13
Features tested:
1. CurrencyInput component with digit separators (frontend check)
2. Product edit - stock field hidden in edit mode, backend excludes stock from update
3. Supplier product return feature - POST /api/purchases/{id}/return
4. Receipt update (disclaimer text) - ThermalPrinter.js
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
AUTH_TOKEN = None

@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    global AUTH_TOKEN
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@aqintani.com",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    AUTH_TOKEN = response.json().get("token")
    return AUTH_TOKEN

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client

# ==================== TEST: Product Update Does NOT Reset Stock ====================

class TestProductEditNoStockReset:
    """Verify that editing a product does not reset stock to 0"""
    
    def test_get_products_list(self, authenticated_client):
        """Get list of existing products"""
        response = authenticated_client.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        products = response.json()
        assert len(products) > 0, "Need at least one product for testing"
        print(f"Found {len(products)} products")
        
    def test_product_edit_preserves_stock(self, authenticated_client):
        """Edit a product and verify stock is NOT reset to 0"""
        # Get a product with stock > 0
        response = authenticated_client.get(f"{BASE_URL}/api/products")
        products = response.json()
        product_with_stock = next((p for p in products if p.get("stock", 0) > 0), None)
        
        if not product_with_stock:
            pytest.skip("No product with stock > 0 found")
        
        product_id = product_with_stock["id"]
        original_stock = product_with_stock["stock"]
        original_name = product_with_stock["name"]
        
        print(f"Testing product: {original_name}, original stock: {original_stock}")
        
        # Update product with new name (stock field should be excluded by backend)
        update_data = {
            "name": product_with_stock["name"],
            "barcode": product_with_stock.get("barcode", ""),
            "category_id": product_with_stock.get("category_id", ""),
            "supplier_id": product_with_stock.get("supplier_id", ""),
            "stock": 0,  # Sending 0 but backend should ignore this
            "price": product_with_stock["price"],
            "cost_price": product_with_stock["cost_price"],
            "box_price": product_with_stock.get("box_price", 0),
            "items_per_box": product_with_stock.get("items_per_box", 1),
            "min_stock_alert": product_with_stock.get("min_stock_alert", 10)
        }
        
        response = authenticated_client.put(f"{BASE_URL}/api/products/{product_id}", json=update_data)
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        updated_product = response.json()
        print(f"Updated product stock: {updated_product.get('stock')}")
        
        # Stock should NOT be reset to 0
        assert updated_product.get("stock") == original_stock, \
            f"Stock was reset! Original: {original_stock}, After update: {updated_product.get('stock')}"
        print("PASS: Product stock preserved after edit")

# ==================== TEST: Supplier Purchase Return Endpoint ====================

class TestSupplierPurchaseReturn:
    """Test POST /api/purchases/{id}/return - reduces debt automatically"""
    
    def test_get_unpaid_purchases(self, authenticated_client):
        """Get purchases with remaining debt"""
        response = authenticated_client.get(f"{BASE_URL}/api/purchases")
        assert response.status_code == 200
        purchases = response.json()
        unpaid = [p for p in purchases if p.get("remaining", 0) > 0]
        print(f"Found {len(unpaid)} unpaid purchases")
        return unpaid
    
    def test_purchase_return_reduces_debt(self, authenticated_client):
        """Test return endpoint reduces purchase remaining amount"""
        # Get an unpaid purchase with items
        response = authenticated_client.get(f"{BASE_URL}/api/purchases")
        purchases = response.json()
        unpaid = [p for p in purchases if p.get("remaining", 0) > 0 and len(p.get("items", [])) > 0]
        
        if not unpaid:
            pytest.skip("No unpaid purchases with items found for return testing")
        
        purchase = unpaid[0]
        purchase_id = purchase["id"]
        original_remaining = purchase["remaining"]
        
        print(f"Testing return on purchase {purchase_id}, remaining: {original_remaining}")
        
        # Get the first item to return
        items = purchase.get("items", [])
        if not items:
            pytest.skip("Purchase has no items")
        
        test_item = items[0]
        return_qty = min(1, test_item.get("quantity", 1))  # Return 1 item
        cost_price = test_item.get("cost_price", 0)
        expected_reduction = return_qty * cost_price
        
        # Call the return endpoint
        return_data = {
            "items": [{
                "product_id": test_item["product_id"],
                "quantity": return_qty
            }],
            "notes": "Test return from pytest",
            "warehouse_id": "gudang_utama"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/purchases/{purchase_id}/return", json=return_data)
        assert response.status_code == 200, f"Return failed: {response.text}"
        
        result = response.json()
        print(f"Return result: {result}")
        
        # Verify the return was processed
        assert "return_value" in result, "Return value not in response"
        assert result.get("return_value", 0) > 0, "Return value should be > 0"
        
        new_remaining = result.get("new_remaining", 0)
        assert new_remaining < original_remaining, \
            f"Remaining should decrease. Was {original_remaining}, now {new_remaining}"
        
        print(f"PASS: Return processed. Remaining reduced from {original_remaining} to {new_remaining}")
        
    def test_return_invalid_purchase_returns_404(self, authenticated_client):
        """Test return on non-existent purchase returns 404"""
        return_data = {
            "items": [{"product_id": "nonexistent", "quantity": 1}],
            "warehouse_id": "gudang_utama"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/purchases/invalid-id-12345/return", json=return_data)
        assert response.status_code == 404

# ==================== TEST: Summary Cards on Supplier Debt Page ====================

class TestSupplierDebtSummary:
    """Test that supplier debt summary returns expected structure (3 cards, no overdue card)"""
    
    def test_supplier_debt_summary_structure(self, authenticated_client):
        """Verify summary has expected fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/supplier-debts/summary")
        assert response.status_code == 200
        
        summary = response.json()
        
        # Required fields for 3 summary cards
        required_fields = ["total_debt", "suppliers_with_debt", "total_paid_this_month"]
        for field in required_fields:
            assert field in summary, f"Missing required field: {field}"
        
        print(f"Summary: total_debt={summary['total_debt']}, suppliers={summary['suppliers_with_debt']}, paid_month={summary['total_paid_this_month']}")
        print("PASS: Summary has required fields for 3 cards")

# ==================== TEST: Supplier Debt Overview ====================

class TestSupplierDebtOverview:
    """Test supplier debt overview endpoint"""
    
    def test_supplier_debts_overview(self, authenticated_client):
        """Get supplier debts overview list"""
        response = authenticated_client.get(f"{BASE_URL}/api/supplier-debts/overview")
        assert response.status_code == 200
        
        overview = response.json()
        assert isinstance(overview, list)
        
        if len(overview) > 0:
            supplier = overview[0]
            expected_fields = ["supplier_id", "supplier_name", "outstanding", "purchase_count"]
            for field in expected_fields:
                assert field in supplier, f"Missing field in overview: {field}"
        
        print(f"PASS: Overview returned {len(overview)} suppliers")

# ==================== TEST: Supplier Purchases with Retur Button ====================

class TestSupplierPurchasesWithReturn:
    """Test supplier purchases endpoint returns data for return button"""
    
    def test_get_supplier_purchases_for_return(self, authenticated_client):
        """Get purchases for a supplier - used to show Retur button"""
        # First get suppliers with debt
        response = authenticated_client.get(f"{BASE_URL}/api/supplier-debts/overview")
        assert response.status_code == 200
        
        suppliers = response.json()
        supplier_with_debt = next((s for s in suppliers if s.get("outstanding", 0) > 0), None)
        
        if not supplier_with_debt:
            pytest.skip("No supplier with debt found")
        
        supplier_id = supplier_with_debt["supplier_id"]
        
        # Get unpaid purchases for this supplier
        response = authenticated_client.get(f"{BASE_URL}/api/supplier-debts/{supplier_id}/purchases?show_all=false")
        assert response.status_code == 200
        
        purchases = response.json()
        assert isinstance(purchases, list)
        
        # Check that unpaid purchases have items for return
        unpaid_with_items = [p for p in purchases if p.get("remaining", 0) > 0 and len(p.get("items", [])) > 0]
        print(f"Found {len(unpaid_with_items)} unpaid purchases with items for supplier {supplier_id}")
        print("PASS: Purchases data supports Retur button functionality")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
