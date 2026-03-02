"""
Backend API tests for NEW WAREHOUSE features in UD. Aqin Tani app
Tests: Warehouses, Warehouse Stock, Stock Transfers, Partner Pricing
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ===== WAREHOUSE API TESTS =====
class TestWarehousesAPI:
    """Warehouse management endpoint tests - NEW FEATURE"""
    
    def test_get_warehouses(self, admin_token):
        """Test listing warehouses - should return 3 default warehouses"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/warehouses", headers=headers)
        assert response.status_code == 200, f"Get warehouses failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3, f"Expected 3 warehouses, got {len(data)}"
        
        # Verify warehouse structure
        warehouse_ids = [w["id"] for w in data]
        assert "gudang_utama" in warehouse_ids
        assert "gudang_toko" in warehouse_ids
        assert "gudang_lainnya" in warehouse_ids
        
        # Verify units
        for wh in data:
            if wh["id"] == "gudang_toko":
                assert wh["unit"] == "satuan"
            else:
                assert wh["unit"] == "dus"
        
        print(f"✓ Got {len(data)} warehouses: {[w['name'] for w in data]}")
        return data

    def test_warehouse_stock_entries(self, admin_token):
        """Test warehouse stock entries exist for products"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/warehouse-stock", headers=headers)
        assert response.status_code == 200, f"Get warehouse stock failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "No warehouse stock entries found"
        
        # Verify structure
        entry = data[0]
        assert "product_id" in entry
        assert "warehouse_id" in entry
        assert "stock" in entry
        
        print(f"✓ Got {len(data)} warehouse stock entries")
        return data


# ===== STOCK TRANSFER API TESTS =====
class TestStockTransfersAPI:
    """Stock transfer endpoint tests - NEW FEATURE"""
    
    def test_get_stock_transfers(self, admin_token):
        """Test listing stock transfers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/stock-transfers", headers=headers)
        assert response.status_code == 200, f"Get stock transfers failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ Got {len(data)} stock transfers")
        return data
    
    def test_create_stock_transfer_toko_to_utama(self, admin_token, test_product_with_stock):
        """Test transferring from Gudang Toko (satuan) to Gudang Utama (dus) - conversion"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        product = test_product_with_stock
        
        # Get initial stock
        initial_stock = requests.get(
            f"{BASE_URL}/api/warehouse-stock?product_id={product['id']}", 
            headers=headers
        ).json()
        
        toko_initial = next((s["stock"] for s in initial_stock if s["warehouse_id"] == "gudang_toko"), 0)
        utama_initial = next((s["stock"] for s in initial_stock if s["warehouse_id"] == "gudang_utama"), 0)
        
        if toko_initial < 5:
            pytest.skip(f"Not enough toko stock ({toko_initial}) for transfer test")
        
        # Create transfer
        transfer_qty = 5
        transfer_data = {
            "product_id": product["id"],
            "from_warehouse_id": "gudang_toko",
            "to_warehouse_id": "gudang_utama",
            "quantity": transfer_qty,
            "notes": "TEST_Transfer toko to utama"
        }
        
        response = requests.post(f"{BASE_URL}/api/stock-transfers", json=transfer_data, headers=headers)
        assert response.status_code == 200, f"Create stock transfer failed: {response.text}"
        
        data = response.json()
        assert data["product_id"] == product["id"]
        assert data["from_warehouse_id"] == "gudang_toko"
        assert data["to_warehouse_id"] == "gudang_utama"
        assert data["quantity"] == transfer_qty
        assert data["from_unit"] == "satuan"
        assert data["to_unit"] == "dus"
        
        # With items_per_box=1, conversion is 1:1
        items_per_box = product.get("items_per_box", 1) or 1
        expected_converted = transfer_qty // items_per_box
        assert data["converted_quantity"] == expected_converted
        
        # Verify stock changed
        new_stock = requests.get(
            f"{BASE_URL}/api/warehouse-stock?product_id={product['id']}", 
            headers=headers
        ).json()
        
        toko_after = next((s["stock"] for s in new_stock if s["warehouse_id"] == "gudang_toko"), 0)
        utama_after = next((s["stock"] for s in new_stock if s["warehouse_id"] == "gudang_utama"), 0)
        
        assert toko_after == toko_initial - transfer_qty, f"Toko stock mismatch: expected {toko_initial - transfer_qty}, got {toko_after}"
        assert utama_after == utama_initial + expected_converted, f"Utama stock mismatch: expected {utama_initial + expected_converted}, got {utama_after}"
        
        print(f"✓ Transfer created: {transfer_qty} satuan -> {data['converted_quantity']} dus")
        print(f"  Toko: {toko_initial} -> {toko_after}")
        print(f"  Utama: {utama_initial} -> {utama_after}")
        return data
    
    def test_create_stock_transfer_utama_to_toko(self, admin_token, test_product_with_stock):
        """Test transferring from Gudang Utama (dus) to Gudang Toko (satuan) - conversion"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        product = test_product_with_stock
        
        # Get initial stock
        initial_stock = requests.get(
            f"{BASE_URL}/api/warehouse-stock?product_id={product['id']}", 
            headers=headers
        ).json()
        
        utama_initial = next((s["stock"] for s in initial_stock if s["warehouse_id"] == "gudang_utama"), 0)
        toko_initial = next((s["stock"] for s in initial_stock if s["warehouse_id"] == "gudang_toko"), 0)
        
        if utama_initial < 2:
            pytest.skip(f"Not enough utama stock ({utama_initial}) for transfer test")
        
        # Create transfer (dus -> satuan)
        transfer_qty = 2
        transfer_data = {
            "product_id": product["id"],
            "from_warehouse_id": "gudang_utama",
            "to_warehouse_id": "gudang_toko",
            "quantity": transfer_qty,
            "notes": "TEST_Transfer utama to toko"
        }
        
        response = requests.post(f"{BASE_URL}/api/stock-transfers", json=transfer_data, headers=headers)
        assert response.status_code == 200, f"Create stock transfer failed: {response.text}"
        
        data = response.json()
        assert data["from_unit"] == "dus"
        assert data["to_unit"] == "satuan"
        
        # With items_per_box=1, conversion is 1:1 (multiply)
        items_per_box = product.get("items_per_box", 1) or 1
        expected_converted = transfer_qty * items_per_box
        assert data["converted_quantity"] == expected_converted
        
        print(f"✓ Transfer created: {transfer_qty} dus -> {data['converted_quantity']} satuan")
        return data
    
    def test_stock_transfer_validation_same_warehouse(self, admin_token, test_product_with_stock):
        """Test that transfer fails when source and destination are the same"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        product = test_product_with_stock
        
        transfer_data = {
            "product_id": product["id"],
            "from_warehouse_id": "gudang_toko",
            "to_warehouse_id": "gudang_toko",  # Same warehouse
            "quantity": 1,
            "notes": "TEST_Invalid same warehouse"
        }
        
        response = requests.post(f"{BASE_URL}/api/stock-transfers", json=transfer_data, headers=headers)
        assert response.status_code == 400, f"Expected 400 error for same warehouse transfer"
        assert "sama" in response.json().get("detail", "").lower()
        
        print("✓ Correctly rejected same warehouse transfer")
    
    def test_stock_transfer_validation_insufficient_stock(self, admin_token, test_product_with_stock):
        """Test that transfer fails when stock is insufficient"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        product = test_product_with_stock
        
        transfer_data = {
            "product_id": product["id"],
            "from_warehouse_id": "gudang_lainnya",  # Usually has 0 stock
            "to_warehouse_id": "gudang_toko",
            "quantity": 999999,  # Huge quantity
            "notes": "TEST_Invalid insufficient stock"
        }
        
        response = requests.post(f"{BASE_URL}/api/stock-transfers", json=transfer_data, headers=headers)
        assert response.status_code == 400, f"Expected 400 error for insufficient stock"
        assert "tidak cukup" in response.json().get("detail", "").lower()
        
        print("✓ Correctly rejected insufficient stock transfer")


# ===== PARTNER PRICING API TESTS =====
class TestPartnerPricingAPI:
    """Partner-specific pricing endpoint tests - NEW FEATURE"""
    
    def test_get_partner_prices(self, admin_token):
        """Test listing partner prices"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/partner-prices", headers=headers)
        assert response.status_code == 200, f"Get partner prices failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ Got {len(data)} partner prices")
        return data
    
    def test_set_partner_price(self, admin_token, test_partner_store, test_product_with_stock):
        """Test setting custom price for partner"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        partner = test_partner_store
        product = test_product_with_stock
        custom_price = 85000  # Discounted price for partner
        
        response = requests.put(
            f"{BASE_URL}/api/partner-prices?partner_store_id={partner['id']}&product_id={product['id']}&custom_price={custom_price}",
            headers=headers
        )
        assert response.status_code == 200, f"Set partner price failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        
        # Verify price was set
        prices = requests.get(
            f"{BASE_URL}/api/partner-prices?partner_store_id={partner['id']}",
            headers=headers
        ).json()
        
        partner_price = next((p for p in prices if p["product_id"] == product["id"]), None)
        assert partner_price is not None, "Partner price not found"
        assert partner_price["custom_price"] == custom_price
        
        print(f"✓ Set partner price: {product['name']} -> Rp {custom_price} for {partner['name']}")
        return data
    
    def test_get_partner_prices_by_store(self, admin_token, test_partner_store):
        """Test getting prices for a specific partner store"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        partner = test_partner_store
        
        response = requests.get(
            f"{BASE_URL}/api/partner-prices?partner_store_id={partner['id']}",
            headers=headers
        )
        assert response.status_code == 200, f"Get partner prices failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        # All returned prices should be for this partner
        for price in data:
            assert price["partner_store_id"] == partner["id"]
        
        print(f"✓ Got {len(data)} prices for partner {partner['name']}")
        return data


# ===== SUPPLIER PURCHASE DETAILS API TESTS =====
class TestSupplierPurchasesAPI:
    """Supplier purchase history endpoint tests - NEW FEATURE"""
    
    def test_get_supplier_purchases(self, admin_token, test_supplier):
        """Test getting purchase history for a supplier"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        supplier = test_supplier
        
        response = requests.get(
            f"{BASE_URL}/api/suppliers/{supplier['id']}/purchases",
            headers=headers
        )
        assert response.status_code == 200, f"Get supplier purchases failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all purchases are from this supplier
        for purchase in data:
            assert purchase["supplier_id"] == supplier["id"]
        
        print(f"✓ Got {len(data)} purchases from {supplier['name']}")
        return data
    
    def test_get_product_price_comparison(self, admin_token, test_product_with_stock):
        """Test getting price comparison for a product across suppliers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        product = test_product_with_stock
        
        response = requests.get(
            f"{BASE_URL}/api/products/{product['id']}/price-comparison",
            headers=headers
        )
        assert response.status_code == 200, f"Get price comparison failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure if data exists
        if data:
            supplier_data = data[0]
            assert "supplier_id" in supplier_data
            assert "supplier_name" in supplier_data
            assert "prices" in supplier_data
            assert "last_price" in supplier_data
            assert "total_qty" in supplier_data
        
        print(f"✓ Got price comparison from {len(data)} suppliers for {product['name']}")
        return data


# ===== PRODUCT FIELDS TESTS =====
class TestProductNewFields:
    """Test new product fields: items_per_box, box_price"""
    
    def test_product_has_new_fields(self, admin_token):
        """Test that products have items_per_box and box_price fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/products", headers=headers)
        assert response.status_code == 200
        
        products = response.json()
        if products:
            product = products[0]
            assert "items_per_box" in product, "Product missing items_per_box field"
            assert "box_price" in product, "Product missing box_price field"
            assert isinstance(product["items_per_box"], int)
            assert product["items_per_box"] >= 1
            
            print(f"✓ Product fields verified: items_per_box={product['items_per_box']}, box_price={product['box_price']}")
        else:
            print("✓ No products to check, but endpoint works")


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
def test_product_with_stock(admin_token):
    """Get a product with stock in Gudang Toko"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    products = requests.get(f"{BASE_URL}/api/products", headers=headers).json()
    if products:
        return products[0]  # ABACEL has stock
    
    pytest.skip("No products available")


@pytest.fixture(scope="module")
def test_partner_store(admin_token):
    """Get or create test partner store"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    stores = requests.get(f"{BASE_URL}/api/partner-stores", headers=headers).json()
    if stores:
        return stores[0]
    
    # Create new store
    store_data = {
        "name": "TEST_Kios Warehouse Test",
        "owner_name": "Test Owner",
        "phone": "0812-0000-0001",
        "address": "Jl. Test",
        "credit_limit": 5000000
    }
    response = requests.post(f"{BASE_URL}/api/partner-stores", json=store_data, headers=headers)
    return response.json()


@pytest.fixture(scope="module")
def test_supplier(admin_token):
    """Get test supplier"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=headers).json()
    if suppliers:
        return suppliers[0]
    
    pytest.skip("No suppliers available")
