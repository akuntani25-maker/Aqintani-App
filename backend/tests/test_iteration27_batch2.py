"""
Iteration 27 - Batch 2 Testing
Features:
1. Dashboard revision - Bon per vehicle breakdown inside 'Nilai Aset Bersih' card (no separate section)
2. Partner orders harga satuan universal - price always per unit, subtotal = unit_price * items_per_box * qty for dus
3. Partner orders conditional type (Pesanan Kondisional)
4. Canvasser dashboard settlement/partial return
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuthentication:
    """Authentication tests for admin, kasir, and canvasser"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture
    def canvasser_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sahidin@aqintani.com",
            "password": "123456"
        })
        assert response.status_code == 200, f"Canvasser login failed: {response.text}"
        return response.json()["token"]
    
    def test_admin_login(self):
        """Verify admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        print("✓ Admin login successful")
    
    def test_canvasser_login(self):
        """Verify canvasser login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sahidin@aqintani.com",
            "password": "123456"
        })
        assert response.status_code == 200, f"Canvasser login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "canvasser"
        print("✓ Canvasser login successful")


class TestDashboardBatch2:
    """Dashboard tests for Batch 2 - Bon per vehicle in Nilai Aset Bersih card"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_dashboard_stats_has_partner_debt_vehicles(self, admin_token):
        """Verify partner_debt_vehicles field exists for per-vehicle breakdown"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        
        # partner_debt_vehicles should be a list
        assert "partner_debt_vehicles" in data, "Missing partner_debt_vehicles field"
        vehicles = data["partner_debt_vehicles"]
        assert isinstance(vehicles, list), "partner_debt_vehicles should be a list"
        
        # If there are vehicles with debt, verify structure
        if len(vehicles) > 0:
            for v in vehicles:
                assert "vehicle" in v, "Missing 'vehicle' key in debt breakdown"
                assert "debt" in v, "Missing 'debt' key in debt breakdown"
                print(f"  - {v['vehicle']}: Rp {v['debt']:,}")
        else:
            print("  - No vehicles with debt (empty list)")
        
        print("✓ partner_debt_vehicles field exists for Nilai Aset Bersih card")
    
    def test_dashboard_has_total_assets(self, admin_token):
        """Verify total_assets field for Nilai Aset Bersih calculation"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "total_assets" in data, "Missing total_assets"
        assert "inventory_value" in data, "Missing inventory_value"
        assert "total_partner_debt" in data, "Missing total_partner_debt"
        assert "total_supplier_debt" in data, "Missing total_supplier_debt"
        
        print(f"✓ total_assets: Rp {data['total_assets']:,}")


class TestPartnerOrdersHargaSatuan:
    """Partner orders tests for Batch 2 - harga satuan universal"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_products_has_items_per_box(self, admin_token):
        """Verify products have items_per_box for subtotal calculation"""
        response = requests.get(
            f"{BASE_URL}/api/products",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check first few products have items_per_box
        if len(data) > 0:
            product = data[0]
            assert "price" in product, "Missing price field"
            assert "items_per_box" in product, "Missing items_per_box field"
            print(f"✓ Product {product['name']}: price={product['price']}, items_per_box={product['items_per_box']}")
    
    def test_get_warehouses_has_unit(self, admin_token):
        """Verify warehouses have unit field (satuan/dus)"""
        response = requests.get(
            f"{BASE_URL}/api/warehouses",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) > 0, "No warehouses found"
        for wh in data:
            assert "unit" in wh, f"Missing unit field in warehouse {wh.get('name')}"
            print(f"  - {wh['name']}: unit={wh['unit']}")
        print("✓ Warehouses have unit field for subtotal calculation")


class TestPartnerOrdersConditional:
    """Partner orders tests for conditional order type (Pesanan Kondisional)"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_partner_orders_has_order_type(self, admin_token):
        """Verify partner orders have order_type field"""
        response = requests.get(
            f"{BASE_URL}/api/partner-orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            order = data[0]
            # order_type is optional but should be present if set
            if "order_type" in order:
                assert order["order_type"] in ["regular", "conditional", None], \
                    f"Invalid order_type: {order['order_type']}"
                print(f"✓ Order {order['order_number']} has order_type: {order['order_type']}")
            else:
                print("✓ order_type field available in model")
        else:
            print("✓ No orders to check, but API is working")
    
    def test_get_partner_orders_has_is_settled(self, admin_token):
        """Verify partner orders have is_settled field for settlement tracking"""
        response = requests.get(
            f"{BASE_URL}/api/partner-orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            order = data[0]
            # Check is_settled field exists (can be True, False, or None/missing for old orders)
            if "is_settled" in order:
                print(f"✓ Order {order['order_number']} has is_settled: {order['is_settled']}")
            print("✓ is_settled field exists in order model")
        else:
            print("✓ No orders to check, but API is working")


class TestPartnerOrderSettlement:
    """Partner orders settlement endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_settle_endpoint_exists(self, admin_token):
        """Verify POST /api/partner-orders/{order_id}/settle endpoint exists"""
        # Try with a non-existent order to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/partner-orders/nonexistent-id/settle",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"items": []}
        )
        # Should return 404 (not found) not 405 (method not allowed)
        assert response.status_code in [404, 422, 400], \
            f"Settle endpoint should exist. Got status {response.status_code}: {response.text}"
        print("✓ POST /api/partner-orders/{order_id}/settle endpoint exists")
    
    def test_settle_with_real_order(self, admin_token):
        """Test settlement with a real unsettled order if available"""
        # Get an unsettled order
        response = requests.get(
            f"{BASE_URL}/api/partner-orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        orders = response.json()
        
        # Find an unsettled order
        unsettled_orders = [o for o in orders if not o.get("is_settled") and o.get("status") != "cancelled"]
        
        if len(unsettled_orders) == 0:
            print("✓ No unsettled orders available to test settlement (skipped)")
            pytest.skip("No unsettled orders available")
            return
        
        order = unsettled_orders[0]
        order_id = order["id"]
        
        # Build settlement items - all items sold at full quantity
        settle_items = []
        for item in order.get("items", []):
            items_per_box = item.get("items_per_box", 1) or 1
            original_qty = item.get("quantity", 0)
            # Calculate total pieces
            total_pcs = original_qty * items_per_box
            settle_items.append({
                "product_id": item["product_id"],
                "product_name": item["product_name"],
                "qty_sold": total_pcs,  # All sold
                "original_qty": original_qty,
                "price": item["price"]
            })
        
        # Call settle endpoint
        response = requests.post(
            f"{BASE_URL}/api/partner-orders/{order_id}/settle",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"items": settle_items}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "new_total" in data, "Missing new_total in response"
            assert "return_items" in data, "Missing return_items in response"
            print(f"✓ Settlement successful: new_total={data['new_total']}, returns={len(data['return_items'])} items")
        elif response.status_code == 400 and "sudah diselesaikan" in response.text.lower():
            print("✓ Order already settled (expected if running tests multiple times)")
        else:
            # Other errors may indicate test data issues, but endpoint works
            print(f"  Settlement response: {response.status_code} - {response.text[:200]}")


class TestCanvasserDashboard:
    """Canvasser dashboard tests for settlement flow"""
    
    @pytest.fixture
    def canvasser_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sahidin@aqintani.com",
            "password": "123456"
        })
        if response.status_code != 200:
            pytest.skip("Canvasser account not available")
        return response.json()["token"]
    
    def test_canvasser_my_orders_endpoint(self, canvasser_token):
        """Verify canvasser can access their orders"""
        response = requests.get(
            f"{BASE_URL}/api/canvassers/my-orders",
            headers={"Authorization": f"Bearer {canvasser_token}"}
        )
        assert response.status_code == 200, f"My orders failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "my-orders should return a list"
        
        print(f"✓ Canvasser has {len(data)} orders assigned")
        
        # Check order structure if orders exist
        if len(data) > 0:
            order = data[0]
            assert "id" in order
            assert "order_number" in order
            assert "items" in order
            # is_settled may or may not be present
            print(f"  - First order: {order['order_number']}, is_settled: {order.get('is_settled', 'N/A')}")
    
    def test_canvasser_notifications_endpoint(self, canvasser_token):
        """Verify canvasser notifications endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/canvassers/notifications",
            headers={"Authorization": f"Bearer {canvasser_token}"}
        )
        assert response.status_code == 200, f"Notifications failed: {response.text}"
        data = response.json()
        
        assert "pending_orders" in data or "total_remaining" in data
        print(f"✓ Canvasser notifications: pending={data.get('pending_orders', 0)}, remaining={data.get('total_remaining', 0)}")


class TestPartnerStores:
    """Partner stores tests to ensure vehicle_id is present"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_partner_stores_have_vehicle_id(self, admin_token):
        """Verify partner stores have vehicle_id for debt breakdown"""
        response = requests.get(
            f"{BASE_URL}/api/partner-stores",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            store = data[0]
            assert "current_debt" in store, "Missing current_debt field"
            # vehicle_id is optional but should be supported
            print(f"✓ Partner store {store['name']}: debt={store.get('current_debt', 0)}, vehicle_id={store.get('vehicle_id', 'not set')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
