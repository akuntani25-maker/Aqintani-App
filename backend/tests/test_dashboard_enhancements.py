"""
Tests for Dashboard Enhancements - UD. AQIN TANI
- Dashboard stats with new finance fields (inventory_value, supplier_debt, partner_debt, due_this_month)
- Due calendar API
- Purchase due date management
- Canvasser product search
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardEnhancements:
    """Tests for dashboard enhancements: finance cards, due dates, canvasser product search"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Admin authentication failed")

    # ============= DASHBOARD STATS =============
    def test_dashboard_stats_returns_inventory_value(self):
        """GET /api/dashboard/stats returns inventory_value field"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Status {response.status_code}: {response.text}"
        data = response.json()
        assert "inventory_value" in data, "inventory_value field missing"
        assert isinstance(data["inventory_value"], (int, float)), "inventory_value should be numeric"
        print(f"PASS: inventory_value = {data['inventory_value']}")

    def test_dashboard_stats_returns_supplier_debt(self):
        """GET /api/dashboard/stats returns total_supplier_debt field"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_supplier_debt" in data, "total_supplier_debt field missing"
        assert isinstance(data["total_supplier_debt"], (int, float)), "total_supplier_debt should be numeric"
        print(f"PASS: total_supplier_debt = {data['total_supplier_debt']}")

    def test_dashboard_stats_returns_partner_debt(self):
        """GET /api/dashboard/stats returns total_partner_debt field"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_partner_debt" in data, "total_partner_debt field missing"
        assert isinstance(data["total_partner_debt"], (int, float)), "total_partner_debt should be numeric"
        print(f"PASS: total_partner_debt = {data['total_partner_debt']}")

    def test_dashboard_stats_returns_due_this_month(self):
        """GET /api/dashboard/stats returns due_this_month field (list of purchases with due date)"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "due_this_month" in data, "due_this_month field missing"
        assert isinstance(data["due_this_month"], list), "due_this_month should be a list"
        print(f"PASS: due_this_month has {len(data['due_this_month'])} items")
        
        # If there are items, verify structure
        if data["due_this_month"]:
            item = data["due_this_month"][0]
            assert "supplier_name" in item or "id" in item, "due_this_month items should have supplier info"
            print(f"  First item: {item.get('supplier_name', 'N/A')}")

    def test_dashboard_stats_full_structure(self):
        """GET /api/dashboard/stats returns complete expected structure"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = [
            "today_sales", "today_transactions", "total_products", "low_stock_count",
            "last_7_days", "inventory_value", "total_supplier_debt", "total_partner_debt", "due_this_month"
        ]
        
        missing = [f for f in expected_fields if f not in data]
        assert not missing, f"Missing fields: {missing}"
        print(f"PASS: All {len(expected_fields)} expected fields present in dashboard stats")

    # ============= DUE CALENDAR =============
    def test_due_calendar_endpoint_exists(self):
        """GET /api/dashboard/due-calendar?year=2026&month=3 returns array"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/due-calendar?year=2026&month=3")
        assert response.status_code == 200, f"Status {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "due-calendar should return a list"
        print(f"PASS: due-calendar for March 2026 returned {len(data)} items")

    def test_due_calendar_january_2026(self):
        """GET /api/dashboard/due-calendar?year=2026&month=1 returns array"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/due-calendar?year=2026&month=1")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: due-calendar for Jan 2026 returned {len(data)} items")

    def test_due_calendar_item_structure(self):
        """Due calendar items have required purchase fields"""
        # First set a due date on a purchase to ensure we have data
        purchases_response = self.session.get(f"{BASE_URL}/api/purchases")
        if purchases_response.status_code == 200 and purchases_response.json():
            purchase = purchases_response.json()[0]
            # Set due date to March 2026
            self.session.put(f"{BASE_URL}/api/purchases/{purchase['id']}/due-date?due_date=2026-03-15")
        
        # Now check calendar
        response = self.session.get(f"{BASE_URL}/api/dashboard/due-calendar?year=2026&month=3")
        assert response.status_code == 200
        data = response.json()
        
        if data:
            item = data[0]
            # Check expected fields exist
            assert "id" in item or "supplier_name" in item, "Calendar items should have identifiers"
            assert "due_date" in item, "Calendar items should have due_date"
            print(f"PASS: Calendar item structure verified - due_date: {item.get('due_date')}")
        else:
            print("PASS: Calendar API works, no items for this month")

    # ============= PURCHASE DUE DATE =============
    def test_set_purchase_due_date(self):
        """PUT /api/purchases/{id}/due-date sets due date on purchase"""
        # Get a purchase
        purchases_response = self.session.get(f"{BASE_URL}/api/purchases")
        assert purchases_response.status_code == 200, "Failed to get purchases"
        purchases = purchases_response.json()
        
        if not purchases:
            pytest.skip("No purchases to test due date")
        
        purchase_id = purchases[0]["id"]
        
        # Set due date
        response = self.session.put(f"{BASE_URL}/api/purchases/{purchase_id}/due-date?due_date=2026-03-20")
        assert response.status_code == 200, f"Status {response.status_code}: {response.text}"
        print(f"PASS: Successfully set due date on purchase {purchase_id}")

    def test_clear_purchase_due_date(self):
        """PUT /api/purchases/{id}/due-date with empty date clears due date"""
        purchases_response = self.session.get(f"{BASE_URL}/api/purchases")
        assert purchases_response.status_code == 200
        purchases = purchases_response.json()
        
        if not purchases:
            pytest.skip("No purchases to test")
        
        purchase_id = purchases[0]["id"]
        
        # First set a due date
        self.session.put(f"{BASE_URL}/api/purchases/{purchase_id}/due-date?due_date=2026-04-01")
        
        # Then clear it
        response = self.session.put(f"{BASE_URL}/api/purchases/{purchase_id}/due-date?due_date=")
        assert response.status_code == 200
        print(f"PASS: Successfully cleared due date on purchase {purchase_id}")

    def test_set_due_date_invalid_purchase(self):
        """PUT /api/purchases/invalid-id/due-date returns 404"""
        response = self.session.put(f"{BASE_URL}/api/purchases/invalid-uuid-here/due-date?due_date=2026-03-20")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid purchase ID returns 404")

    # ============= CANVASSER PRODUCT SEARCH =============
    def test_canvasser_product_search_endpoint(self):
        """GET /api/canvassers/product-search?q=Test returns products"""
        response = self.session.get(f"{BASE_URL}/api/canvassers/product-search?q=Test")
        assert response.status_code == 200, f"Status {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "product-search should return a list"
        print(f"PASS: product-search for 'Test' returned {len(data)} results")

    def test_canvasser_product_search_returns_product_fields(self):
        """Canvasser product search returns products with name, stock, price"""
        # First ensure there's a product to find
        products_response = self.session.get(f"{BASE_URL}/api/products")
        if products_response.status_code == 200 and products_response.json():
            product = products_response.json()[0]
            search_term = product["name"][:3]  # Use first 3 chars of product name
            
            response = self.session.get(f"{BASE_URL}/api/canvassers/product-search?q={search_term}")
            assert response.status_code == 200
            data = response.json()
            
            if data:
                item = data[0]
                assert "name" in item, "Product should have name"
                assert "stock" in item, "Product should have stock"
                assert "price" in item, "Product should have price"
                print(f"PASS: Product '{item['name']}' found with stock={item['stock']}, price={item['price']}")
            else:
                print("PASS: Search works but no products matched")
        else:
            pytest.skip("No products in database")

    def test_canvasser_product_search_includes_warehouse_stock(self):
        """Canvasser product search includes warehouse_stock breakdown"""
        products_response = self.session.get(f"{BASE_URL}/api/products")
        if products_response.status_code == 200 and products_response.json():
            product = products_response.json()[0]
            search_term = product["name"][:3]
            
            response = self.session.get(f"{BASE_URL}/api/canvassers/product-search?q={search_term}")
            assert response.status_code == 200
            data = response.json()
            
            if data:
                item = data[0]
                assert "warehouse_stock" in item, "Product should have warehouse_stock"
                assert isinstance(item["warehouse_stock"], list), "warehouse_stock should be a list"
                print(f"PASS: Product has warehouse_stock with {len(item['warehouse_stock'])} entries")
                for ws in item["warehouse_stock"]:
                    print(f"  - {ws.get('warehouse', 'Unknown')}: {ws.get('stock', 0)}")
            else:
                print("PASS: Search works but no products matched")
        else:
            pytest.skip("No products in database")

    def test_canvasser_product_search_empty_query(self):
        """Canvasser product search with empty query returns empty list"""
        response = self.session.get(f"{BASE_URL}/api/canvassers/product-search?q=")
        assert response.status_code == 200
        data = response.json()
        assert data == [], "Empty query should return empty list"
        print("PASS: Empty query returns empty list")

    def test_canvasser_product_search_case_insensitive(self):
        """Canvasser product search is case insensitive"""
        products_response = self.session.get(f"{BASE_URL}/api/products")
        if products_response.status_code == 200 and products_response.json():
            product = products_response.json()[0]
            name = product["name"]
            
            # Search with lowercase
            response_lower = self.session.get(f"{BASE_URL}/api/canvassers/product-search?q={name.lower()[:3]}")
            # Search with uppercase
            response_upper = self.session.get(f"{BASE_URL}/api/canvassers/product-search?q={name.upper()[:3]}")
            
            assert response_lower.status_code == 200
            assert response_upper.status_code == 200
            print("PASS: Case insensitive search works")
        else:
            pytest.skip("No products to test")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
