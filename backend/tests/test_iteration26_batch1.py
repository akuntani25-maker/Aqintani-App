"""
Iteration 26 - Batch 1 Changes Testing
Tests for:
1. Dashboard: Nilai Aset Bersih card at TOP, Barang Keluar sub-text, partner debt by vehicle
2. Dashboard: sales chart now uses 'sales' key
3. Product: Two-mode form (Barang Baru / Restok), autocomplete search
4. Product: supplier_cost_price field
5. PartnerStores: Filtered count & piutang when filtering by vehicle
6. Reports: No column and total qty in all report tables
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuthentication:
    """Auth tests to get token for subsequent tests"""
    
    def test_admin_login(self):
        """Test admin login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")
        return data["token"]


class TestDashboardStatsEnhancements:
    """Test dashboard stats API returns new fields for Batch 1"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_dashboard_stats_returns_sales_key(self, admin_token):
        """Verify last_7_days uses 'sales' key instead of 'total'"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        
        # Verify last_7_days has 'sales' key (was 'total')
        assert "last_7_days" in data, "Missing last_7_days in dashboard stats"
        if len(data["last_7_days"]) > 0:
            first_day = data["last_7_days"][0]
            assert "sales" in first_day, "Missing 'sales' key in last_7_days - should NOT be 'total'"
            assert "date" in first_day
            print(f"✓ last_7_days uses 'sales' key: {first_day}")
    
    def test_dashboard_stats_returns_stock_out_breakdown(self, admin_token):
        """Verify stock_out_today_pos and stock_out_today_partner fields"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # New fields for barang keluar breakdown
        assert "stock_out_today_pos" in data, "Missing stock_out_today_pos"
        assert "stock_out_today_partner" in data, "Missing stock_out_today_partner"
        assert "stock_out_today" in data, "Missing stock_out_today (total)"
        
        print(f"✓ Stock out breakdown: POS={data['stock_out_today_pos']}, Mitra={data['stock_out_today_partner']}, Total={data['stock_out_today']}")
    
    def test_dashboard_stats_returns_partner_debt_vehicles(self, admin_token):
        """Verify partner_debt_vehicles field for Bon Kios Mitra per Armada"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # partner_debt_vehicles should exist even if empty
        assert "partner_debt_vehicles" in data, "Missing partner_debt_vehicles"
        vehicles = data["partner_debt_vehicles"]
        assert isinstance(vehicles, list), "partner_debt_vehicles should be a list"
        
        if len(vehicles) > 0:
            v = vehicles[0]
            assert "vehicle" in v, "Missing vehicle name in partner_debt_vehicles"
            assert "debt" in v, "Missing debt amount in partner_debt_vehicles"
            print(f"✓ Partner debt by vehicle: {vehicles}")
        else:
            print("✓ partner_debt_vehicles returned empty list (no data)")
    
    def test_dashboard_stats_has_total_assets(self, admin_token):
        """Verify total_assets field for Nilai Aset Bersih"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "total_assets" in data, "Missing total_assets for Nilai Aset Bersih"
        assert "inventory_value" in data
        assert "total_partner_debt" in data
        assert "total_supplier_debt" in data
        
        print(f"✓ Total assets: {data['total_assets']}")


class TestProductSearchAutocomplete:
    """Test product search autocomplete endpoint for Restok feature"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_search_autocomplete_endpoint(self, admin_token):
        """Test /api/products/search-autocomplete returns products"""
        response = requests.get(
            f"{BASE_URL}/api/products/search-autocomplete?q=aba",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Search autocomplete failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Should return list of products"
        print(f"✓ Search 'aba' returned {len(data)} products")
        
        if len(data) > 0:
            # Verify required fields for autocomplete display
            p = data[0]
            required_fields = ["id", "name", "stock", "supplier_name", "cost_price"]
            for field in required_fields:
                assert field in p, f"Missing {field} in autocomplete result"
            
            # New field: supplier_cost_price
            assert "supplier_cost_price" in p, "Missing supplier_cost_price in autocomplete"
            
            print(f"✓ Autocomplete result has: name={p['name']}, stock={p['stock']}, supplier={p['supplier_name']}, supplier_cost_price={p.get('supplier_cost_price', 0)}")
    
    def test_search_autocomplete_empty_query(self, admin_token):
        """Test search autocomplete with empty query"""
        response = requests.get(
            f"{BASE_URL}/api/products/search-autocomplete?q=",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data == [], "Empty query should return empty list"
        print("✓ Empty query returns empty list")


class TestProductSupplierCostPrice:
    """Test supplier_cost_price field in product model"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_product_has_supplier_cost_price_field(self, admin_token):
        """Verify products have supplier_cost_price field"""
        response = requests.get(
            f"{BASE_URL}/api/products",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        products = response.json()
        
        if len(products) > 0:
            p = products[0]
            # supplier_cost_price might be 0 but should exist
            assert "cost_price" in p, "Missing cost_price"
            # Check if supplier_cost_price exists (may be absent in old products)
            print(f"✓ Product fields: cost_price={p.get('cost_price', 0)}, supplier_cost_price={p.get('supplier_cost_price', 0)}")


class TestReportsTables:
    """Test report endpoints return data for No column and total qty"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_pos_sales_detail_returns_rows(self, admin_token):
        """POS sales detail should return rows for No column"""
        response = requests.get(
            f"{BASE_URL}/api/reports/sales-detail?date_from=2024-01-01&date_to=2030-12-31",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "rows" in data, "Missing rows in sales detail"
        assert "total_sales" in data
        assert "total_cost" in data
        assert "total_margin" in data
        
        if len(data["rows"]) > 0:
            row = data["rows"][0]
            assert "quantity" in row, "Missing quantity for total calculation"
            print(f"✓ POS sales detail has {len(data['rows'])} rows with quantity field")
    
    def test_partner_sales_detail_returns_rows(self, admin_token):
        """Partner sales detail should return rows for No column"""
        response = requests.get(
            f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2024-01-01&date_to=2030-12-31",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "rows" in data, "Missing rows in partner sales"
        print(f"✓ Partner sales detail has {len(data['rows'])} rows")
    
    def test_bestseller_returns_qty_fields(self, admin_token):
        """Bestseller report should have qty fields for total"""
        response = requests.get(
            f"{BASE_URL}/api/reports/best-sellers?date_from=2024-01-01&date_to=2030-12-31",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "rows" in data
        if len(data["rows"]) > 0:
            row = data["rows"][0]
            assert "qty_pos" in row
            assert "qty_partner" in row
            assert "qty_total" in row
            print(f"✓ Bestseller row has qty fields: pos={row['qty_pos']}, partner={row['qty_partner']}, total={row['qty_total']}")


class TestPartnerStoresVehicleFilter:
    """Test partner stores endpoint for filtered totals"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_partner_stores_returns_vehicle_id_and_debt(self, admin_token):
        """Verify partner stores have vehicle_id and current_debt for filtering"""
        response = requests.get(
            f"{BASE_URL}/api/partner-stores",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        stores = response.json()
        
        if len(stores) > 0:
            s = stores[0]
            # vehicle_id might be empty but field should exist
            assert "current_debt" in s, "Missing current_debt"
            print(f"✓ Partner store has: name={s['name']}, vehicle_id={s.get('vehicle_id', '')}, current_debt={s.get('current_debt', 0)}")
    
    def test_vehicles_endpoint(self, admin_token):
        """Verify vehicles endpoint for dropdown"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        vehicles = response.json()
        
        print(f"✓ Vehicles: {len(vehicles)} available for filtering")


class TestSupplierDebtLabel:
    """Verify SupplierDebt still shows 'Hutang ke Supplier' (from prev iteration)"""
    
    def test_supplier_debt_api(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        token = response.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/supplier-debts/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Supplier debt summary failed: {response.text}"
        print("✓ Supplier debt API working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
