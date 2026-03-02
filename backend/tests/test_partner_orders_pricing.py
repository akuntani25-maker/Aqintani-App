"""
Tests for Partner Orders warehouse pricing feature:
- When ordering from dus warehouses (gudang_utama, gudang_lainnya), box_price should be used
- When ordering from satuan warehouses (gudang_toko), unit price should be used
- Each cart item can have different warehouse_id
- Stock is deducted from the correct warehouse per item
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@aqintani.com",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def authenticated_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session

@pytest.fixture(scope="module")
def test_product(authenticated_client):
    """Create a test product with box pricing"""
    unique_id = str(uuid.uuid4())[:8]
    product_data = {
        "name": f"TEST_PRODUCT_{unique_id}",
        "barcode": f"TEST{unique_id}",
        "price": 110000,  # unit price (harga satuan)
        "cost_price": 90000,
        "box_price": 1000000,  # box price (harga dus)
        "items_per_box": 10,
        "stock": 50,  # 50 dus = 500 satuan
        "warehouse_id": "gudang_utama",
        "min_stock_alert": 5
    }
    
    response = authenticated_client.post(f"{BASE_URL}/api/products", json=product_data)
    assert response.status_code == 200, f"Product creation failed: {response.text}"
    product = response.json()
    
    yield product
    
    # Cleanup
    authenticated_client.delete(f"{BASE_URL}/api/products/{product['id']}")

@pytest.fixture(scope="module")
def test_partner_store(authenticated_client):
    """Create a test partner store"""
    unique_id = str(uuid.uuid4())[:8]
    store_data = {
        "name": f"TEST_STORE_{unique_id}",
        "owner_name": "Test Owner",
        "phone": "081234567890",
        "address": "Test Address",
        "credit_limit": 10000000
    }
    
    response = authenticated_client.post(f"{BASE_URL}/api/partner-stores", json=store_data)
    assert response.status_code == 200, f"Store creation failed: {response.text}"
    store = response.json()
    
    yield store
    
    # Cleanup
    authenticated_client.delete(f"{BASE_URL}/api/partner-stores/{store['id']}")


class TestWarehouseEndpoints:
    """Test warehouse data retrieval"""
    
    def test_get_warehouses(self, authenticated_client):
        """Verify warehouse data with correct units"""
        response = authenticated_client.get(f"{BASE_URL}/api/warehouses")
        assert response.status_code == 200
        
        warehouses = response.json()
        assert len(warehouses) >= 3, "Should have at least 3 warehouses"
        
        # Find warehouses by id
        wh_map = {w['id']: w for w in warehouses}
        
        assert 'gudang_utama' in wh_map, "gudang_utama should exist"
        assert wh_map['gudang_utama']['unit'] == 'dus', "gudang_utama should have unit 'dus'"
        
        assert 'gudang_toko' in wh_map, "gudang_toko should exist"
        assert wh_map['gudang_toko']['unit'] == 'satuan', "gudang_toko should have unit 'satuan'"
        
        assert 'gudang_lainnya' in wh_map, "gudang_lainnya should exist"
        assert wh_map['gudang_lainnya']['unit'] == 'dus', "gudang_lainnya should have unit 'dus'"
        
        print("Warehouses verified correctly")


class TestPartnerOrderCreation:
    """Test partner order creation with per-item warehouse"""
    
    def test_create_order_with_dus_warehouse(self, authenticated_client, test_product, test_partner_store):
        """Create order from gudang_utama (dus) - should use box_price"""
        # Get initial stock
        stock_response = authenticated_client.get(f"{BASE_URL}/api/warehouse-stock?product_id={test_product['id']}&warehouse_id=gudang_utama")
        assert stock_response.status_code == 200
        stocks = stock_response.json()
        initial_stock = stocks[0]['stock'] if stocks else 0
        
        order_data = {
            "partner_store_id": test_partner_store["id"],
            "items": [{
                "product_id": test_product["id"],
                "product_name": test_product["name"],
                "quantity": 2,  # 2 dus
                "price": test_product["box_price"],  # Should be box_price = 1000000
                "subtotal": 2 * test_product["box_price"],
                "warehouse_id": "gudang_utama"
            }],
            "subtotal": 2 * test_product["box_price"],
            "discount": 0,
            "total": 2 * test_product["box_price"],
            "paid": 0,
            "delivery_date": "2026-01-15",
            "warehouse_id": "gudang_utama"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/partner-orders", json=order_data)
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        order = response.json()
        assert order["total"] == 2000000, f"Total should be 2,000,000 (2 x 1,000,000 box_price), got {order['total']}"
        assert order["items"][0]["price"] == 1000000, f"Item price should be box_price (1,000,000), got {order['items'][0]['price']}"
        
        # Verify stock was deducted from gudang_utama
        stock_response_after = authenticated_client.get(f"{BASE_URL}/api/warehouse-stock?product_id={test_product['id']}&warehouse_id=gudang_utama")
        stocks_after = stock_response_after.json()
        final_stock = stocks_after[0]['stock'] if stocks_after else 0
        assert final_stock == initial_stock - 2, f"Stock should be reduced by 2 dus from gudang_utama"
        
        print(f"Order with dus warehouse created successfully. Total: {order['total']}, Stock deducted: {initial_stock} -> {final_stock}")


class TestTransactionItemWarehouseField:
    """Test that TransactionItem model accepts warehouse_id"""
    
    def test_transaction_item_has_warehouse_id(self, authenticated_client, test_product, test_partner_store):
        """Verify items stored with warehouse_id in partner orders"""
        order_data = {
            "partner_store_id": test_partner_store["id"],
            "items": [{
                "product_id": test_product["id"],
                "product_name": test_product["name"],
                "quantity": 1,
                "price": test_product["box_price"],
                "subtotal": test_product["box_price"],
                "warehouse_id": "gudang_utama"  # Per-item warehouse
            }],
            "subtotal": test_product["box_price"],
            "discount": 0,
            "total": test_product["box_price"],
            "paid": 0,
            "warehouse_id": "gudang_utama"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/partner-orders", json=order_data)
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        order = response.json()
        # Verify the item has warehouse_id stored
        assert "warehouse_id" in order["items"][0], "Item should have warehouse_id field"
        assert order["items"][0]["warehouse_id"] == "gudang_utama", f"Item warehouse_id should be 'gudang_utama', got {order['items'][0].get('warehouse_id')}"
        
        print("TransactionItem warehouse_id field working correctly")


class TestStockDeductionByWarehouse:
    """Test that stock is deducted from correct warehouse per item"""
    
    def test_stock_deduction_from_correct_warehouse(self, authenticated_client, test_product, test_partner_store):
        """Stock should be deducted from the warehouse specified in each item"""
        # First, add some stock to gudang_lainnya for testing
        add_stock_response = authenticated_client.put(
            f"{BASE_URL}/api/warehouse-stock?product_id={test_product['id']}&warehouse_id=gudang_lainnya&stock=10"
        )
        assert add_stock_response.status_code == 200
        
        # Get initial stocks
        utama_response = authenticated_client.get(f"{BASE_URL}/api/warehouse-stock?product_id={test_product['id']}&warehouse_id=gudang_utama")
        lainnya_response = authenticated_client.get(f"{BASE_URL}/api/warehouse-stock?product_id={test_product['id']}&warehouse_id=gudang_lainnya")
        
        utama_initial = utama_response.json()[0]['stock'] if utama_response.json() else 0
        lainnya_initial = lainnya_response.json()[0]['stock'] if lainnya_response.json() else 0
        
        # Create order with item from gudang_lainnya specifically
        order_data = {
            "partner_store_id": test_partner_store["id"],
            "items": [{
                "product_id": test_product["id"],
                "product_name": test_product["name"],
                "quantity": 3,
                "price": test_product["box_price"],
                "subtotal": 3 * test_product["box_price"],
                "warehouse_id": "gudang_lainnya"  # Order from gudang_lainnya specifically
            }],
            "subtotal": 3 * test_product["box_price"],
            "discount": 0,
            "total": 3 * test_product["box_price"],
            "paid": 0,
            "warehouse_id": "gudang_utama"  # Default warehouse, but item has its own
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/partner-orders", json=order_data)
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        # Verify stock deducted from gudang_lainnya (not gudang_utama)
        utama_after = authenticated_client.get(f"{BASE_URL}/api/warehouse-stock?product_id={test_product['id']}&warehouse_id=gudang_utama")
        lainnya_after = authenticated_client.get(f"{BASE_URL}/api/warehouse-stock?product_id={test_product['id']}&warehouse_id=gudang_lainnya")
        
        utama_final = utama_after.json()[0]['stock'] if utama_after.json() else 0
        lainnya_final = lainnya_after.json()[0]['stock'] if lainnya_after.json() else 0
        
        # gudang_lainnya should have been deducted by 3
        assert lainnya_final == lainnya_initial - 3, f"gudang_lainnya should be reduced by 3, was {lainnya_initial}, now {lainnya_final}"
        
        print(f"Stock correctly deducted from gudang_lainnya: {lainnya_initial} -> {lainnya_final}")


class TestInsufficientStockError:
    """Test error handling when stock is insufficient"""
    
    def test_insufficient_stock_error(self, authenticated_client, test_product, test_partner_store):
        """Should return error when warehouse stock is insufficient"""
        order_data = {
            "partner_store_id": test_partner_store["id"],
            "items": [{
                "product_id": test_product["id"],
                "product_name": test_product["name"],
                "quantity": 99999,  # Very high quantity
                "price": test_product["box_price"],
                "subtotal": 99999 * test_product["box_price"],
                "warehouse_id": "gudang_utama"
            }],
            "subtotal": 99999 * test_product["box_price"],
            "discount": 0,
            "total": 99999 * test_product["box_price"],
            "paid": 0,
            "warehouse_id": "gudang_utama"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/partner-orders", json=order_data)
        assert response.status_code == 400, f"Should return 400 for insufficient stock, got {response.status_code}"
        assert "tidak cukup" in response.json().get("detail", "").lower(), "Error should mention insufficient stock"
        
        print("Insufficient stock error handling working correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
