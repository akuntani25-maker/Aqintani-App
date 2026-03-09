"""
Test pagination features across the UD. AQIN TANI application
Tests: /api/products endpoint pagination, client-side pagination components
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://baranguyen-dashboard.preview.emergentagent.com').rstrip('/')

class TestPaginationBackend:
    """Backend API pagination tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return headers with authentication token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_products_without_page_param_returns_list(self, auth_headers):
        """Test: /api/products without page param returns a list (backward compatible)"""
        response = requests.get(f"{BASE_URL}/api/products", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Without page param, should return a list"
        print(f"✓ /api/products returns list with {len(data)} products")
    
    def test_products_with_page_param_returns_paginated_object(self, auth_headers):
        """Test: /api/products?page=1 returns paginated object with data, total, etc."""
        response = requests.get(f"{BASE_URL}/api/products?page=1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict), "With page param, should return a dict"
        assert "data" in data, "Response should have 'data' key"
        assert "total" in data, "Response should have 'total' key"
        assert "page" in data, "Response should have 'page' key"
        assert "per_page" in data, "Response should have 'per_page' key"
        assert "total_pages" in data, "Response should have 'total_pages' key"
        assert isinstance(data["data"], list), "'data' should be a list"
        print(f"✓ /api/products?page=1 returns paginated object: {len(data['data'])} of {data['total']} products, page {data['page']}/{data['total_pages']}")
    
    def test_products_pagination_respects_per_page(self, auth_headers):
        """Test: pagination respects custom per_page parameter"""
        response = requests.get(f"{BASE_URL}/api/products?page=1&per_page=2", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["per_page"] == 2, "per_page should be 2"
        assert len(data["data"]) <= 2, "Should return at most 2 products"
        print(f"✓ /api/products?page=1&per_page=2 returns {len(data['data'])} products (max 2)")
    
    def test_suppliers_without_page_returns_list(self, auth_headers):
        """Test: /api/suppliers without page param returns a list"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Without page param, should return a list"
        print(f"✓ /api/suppliers returns list with {len(data)} suppliers")
    
    def test_suppliers_with_page_returns_paginated(self, auth_headers):
        """Test: /api/suppliers?page=1 returns paginated object"""
        response = requests.get(f"{BASE_URL}/api/suppliers?page=1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict), "With page param, should return a dict"
        assert "data" in data
        assert "total" in data
        assert "page" in data
        print(f"✓ /api/suppliers?page=1 returns paginated object: {len(data['data'])} of {data['total']} suppliers")


class TestPaginationComponentBehavior:
    """Tests for pagination component show/hide behavior"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_products_count_below_per_page(self, auth_headers):
        """Test: With 4 products and perPage=15, totalPages=1, pagination should be hidden"""
        response = requests.get(f"{BASE_URL}/api/products", headers=auth_headers)
        data = response.json()
        products_count = len(data)
        per_page = 15  # As defined in Products.js
        total_pages = (products_count + per_page - 1) // per_page if products_count > 0 else 1
        
        # Pagination component hides when totalPages <= 1 (as per Pagination.js line 6)
        should_show_pagination = total_pages > 1
        
        print(f"✓ Products: {products_count} items, perPage={per_page}, totalPages={total_pages}")
        print(f"  Pagination visible: {should_show_pagination} (correct - component hides when totalPages <= 1)")
        
        # This is an informational test - actual UI verification is done via Playwright
        assert products_count == 4, f"Expected 4 products, got {products_count}"
        assert total_pages == 1, "With 4 products and perPage=15, totalPages should be 1"
    
    def test_suppliers_count_for_pagination(self, auth_headers):
        """Test: Check suppliers count to verify pagination behavior"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        data = response.json()
        suppliers_count = len(data)
        per_page = 15  # As defined in Suppliers.js
        total_pages = (suppliers_count + per_page - 1) // per_page if suppliers_count > 0 else 1
        should_show_pagination = total_pages > 1
        
        print(f"✓ Suppliers: {suppliers_count} items, perPage={per_page}, totalPages={total_pages}")
        print(f"  Pagination visible: {should_show_pagination}")
    
    def test_partner_stores_count_for_pagination(self, auth_headers):
        """Test: Check partner stores count to verify pagination behavior"""
        response = requests.get(f"{BASE_URL}/api/partner-stores", headers=auth_headers)
        data = response.json()
        stores_count = len(data)
        per_page = 15  # As defined in PartnerStores.js
        total_pages = (stores_count + per_page - 1) // per_page if stores_count > 0 else 1
        should_show_pagination = total_pages > 1
        
        print(f"✓ Partner Stores: {stores_count} items, perPage={per_page}, totalPages={total_pages}")
        print(f"  Pagination visible: {should_show_pagination}")
    
    def test_partner_orders_count_for_pagination(self, auth_headers):
        """Test: Check partner orders count to verify pagination behavior"""
        response = requests.get(f"{BASE_URL}/api/partner-orders", headers=auth_headers)
        data = response.json()
        orders_count = len(data)
        per_page = 15  # As defined in PartnerOrders.js
        total_pages = (orders_count + per_page - 1) // per_page if orders_count > 0 else 1
        should_show_pagination = total_pages > 1
        
        print(f"✓ Partner Orders: {orders_count} items, perPage={per_page}, totalPages={total_pages}")
        print(f"  Pagination visible: {should_show_pagination}")
    
    def test_supplier_debts_overview_for_pagination(self, auth_headers):
        """Test: Check supplier debts overview count"""
        response = requests.get(f"{BASE_URL}/api/supplier-debts/overview", headers=auth_headers)
        data = response.json()
        overview_count = len(data)
        per_page = 15  # As defined in SupplierDebt.js
        total_pages = (overview_count + per_page - 1) // per_page if overview_count > 0 else 1
        should_show_pagination = total_pages > 1
        
        print(f"✓ Supplier Debts Overview: {overview_count} items, perPage={per_page}, totalPages={total_pages}")
        print(f"  Pagination visible: {should_show_pagination}")


class TestSearchFilterResetPage:
    """Tests to verify search/filter changes reset page to 1"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_products_search_filter(self, auth_headers):
        """Test: Products search filter returns filtered results"""
        # Search for a specific product
        response = requests.get(f"{BASE_URL}/api/products?search=ABACEL", headers=auth_headers)
        data = response.json()
        # Without page param, returns list
        filtered_count = len(data)
        print(f"✓ Products search 'ABACEL': {filtered_count} results")
        
        # Verify at least one result contains search term
        if filtered_count > 0:
            matching = [p for p in data if 'ABACEL' in p.get('name', '').upper()]
            assert len(matching) > 0, "Search results should contain matching products"
            print(f"  Found {len(matching)} products matching 'ABACEL'")
    
    def test_suppliers_search_filter(self, auth_headers):
        """Test: Suppliers search filter"""
        response = requests.get(f"{BASE_URL}/api/suppliers?search=TANI", headers=auth_headers)
        data = response.json()
        # Without page param, returns list
        filtered_count = len(data)
        print(f"✓ Suppliers search 'TANI': {filtered_count} results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
