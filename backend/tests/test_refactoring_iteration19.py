"""
Iteration 19 - Post-Refactoring API Tests
Testing after major refactoring: server.py split into modular architecture
- database.py, auth.py, models.py, services.py
- 9 router files under /app/backend/routers/
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuth:
    """Authentication endpoints after refactoring"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        return data["token"]
    
    def test_login_success(self):
        """Test #1: POST /api/auth/login returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@aqintani.com"
        print("PASS: POST /api/auth/login returns token")
    
    def test_get_me(self, auth_token):
        """Test #2: GET /api/auth/me returns current user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "role" in data
        print("PASS: GET /api/auth/me returns user info")


class TestDashboard:
    """Dashboard stats endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_dashboard_stats(self, auth_token):
        """Test #3: GET /api/dashboard/stats returns all metrics"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check all required metrics
        assert "today_sales" in data, "today_sales missing"
        assert "total_products" in data, "total_products missing"
        assert "warehouse_chart" in data, "warehouse_chart missing"
        assert "stock_in_today" in data, "stock_in_today missing"
        assert "stock_out_today" in data, "stock_out_today missing"
        assert "total_assets" in data, "total_assets missing"
        
        # Verify warehouse_chart is a list
        assert isinstance(data["warehouse_chart"], list), "warehouse_chart should be a list"
        print(f"PASS: Dashboard stats - today_sales={data['today_sales']}, total_products={data['total_products']}")


class TestProducts:
    """Product endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_products_paginated(self, auth_token):
        """Test #4: GET /api/products?page=1&per_page=5 returns paginated products"""
        response = requests.get(
            f"{BASE_URL}/api/products?page=1&per_page=5",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return pagination structure
        assert "data" in data, "Pagination data key missing"
        assert "total" in data, "total key missing"
        assert "page" in data, "page key missing"
        assert "per_page" in data, "per_page key missing"
        assert data["page"] == 1
        assert data["per_page"] == 5
        print(f"PASS: Products paginated - total={data['total']}, returned={len(data['data'])}")
    
    def test_categories(self, auth_token):
        """Test #5: GET /api/categories returns categories list"""
        response = requests.get(
            f"{BASE_URL}/api/categories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Categories should be a list"
        print(f"PASS: Categories returned {len(data)} items")


class TestSuppliers:
    """Supplier endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_suppliers_list(self, auth_token):
        """Test #6: GET /api/suppliers returns suppliers list"""
        response = requests.get(
            f"{BASE_URL}/api/suppliers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Suppliers should be a list"
        print(f"PASS: Suppliers returned {len(data)} items")


class TestWarehouses:
    """Warehouse endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_warehouses_list(self, auth_token):
        """Test #7: GET /api/warehouses returns 3 warehouses"""
        response = requests.get(
            f"{BASE_URL}/api/warehouses",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Warehouses should be a list"
        assert len(data) >= 3, f"Expected at least 3 warehouses, got {len(data)}"
        
        # Check warehouse names
        names = [w["name"] for w in data]
        assert "Gudang Utama" in names, "Gudang Utama missing"
        assert "Gudang Toko" in names, "Gudang Toko missing"
        assert "Gudang Lainnya" in names, "Gudang Lainnya missing"
        print(f"PASS: Warehouses returned {len(data)} items: {names}")
    
    def test_warehouse_stock(self, auth_token):
        """Test #8: GET /api/warehouse-stock returns warehouse stock entries"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse-stock",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Warehouse stock should be a list"
        print(f"PASS: Warehouse stock returned {len(data)} entries")


class TestAdmin:
    """Admin endpoints (vehicles, audit-log)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_vehicles_list(self, auth_token):
        """Test #9: GET /api/vehicles returns vehicles list"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Vehicles should be a list"
        print(f"PASS: Vehicles returned {len(data)} items")
    
    def test_audit_log(self, auth_token):
        """Test #10: GET /api/audit-log returns audit entries"""
        response = requests.get(
            f"{BASE_URL}/api/audit-log",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Audit log should be a list"
        print(f"PASS: Audit log returned {len(data)} entries")
    
    def test_role_permissions(self, auth_token):
        """Test #11: GET /api/role-permissions returns RBAC data with all 5 roles"""
        response = requests.get(
            f"{BASE_URL}/api/role-permissions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "permissions" in data, "permissions key missing"
        assert "current_role" in data, "current_role key missing"
        
        permissions = data["permissions"]
        # Check all 5 roles exist
        expected_roles = ["admin", "manager", "office_staff", "cashier", "canvasser"]
        for role in expected_roles:
            assert role in permissions, f"Role {role} missing from permissions"
        
        print(f"PASS: Role permissions - roles={list(permissions.keys())}")


class TestForecast:
    """AI Stock Forecast endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_stock_forecast(self, auth_token):
        """Test #12: POST /api/forecast/stock returns AI forecast"""
        response = requests.post(
            f"{BASE_URL}/api/forecast/stock",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=60  # AI call may take time
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return either success or fallback status
        assert "status" in data, "status key missing"
        assert data["status"] in ["success", "fallback"], f"Unexpected status: {data['status']}"
        
        assert "data" in data, "data key missing"
        forecast_data = data["data"]
        
        # Should have forecasts array
        assert "forecasts" in forecast_data, "forecasts array missing"
        
        # If forecasts exist, check structure
        if len(forecast_data["forecasts"]) > 0:
            forecast = forecast_data["forecasts"][0]
            assert "risk_level" in forecast, "risk_level missing in forecast"
            assert forecast["risk_level"] in ["critical", "warning", "safe"], f"Invalid risk_level: {forecast['risk_level']}"
        
        print(f"PASS: Stock forecast - status={data['status']}, forecasts={len(forecast_data.get('forecasts', []))}")


class TestAnalytics:
    """Analytics endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_analytics_summary(self, auth_token):
        """Test #13: GET /api/analytics/summary returns monthly analytics with chart_data"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "monthly_sales" in data, "monthly_sales missing"
        assert "chart_data" in data, "chart_data missing"
        assert isinstance(data["chart_data"], list), "chart_data should be a list"
        
        print(f"PASS: Analytics summary - monthly_sales={data['monthly_sales']}, chart_data_points={len(data['chart_data'])}")


class TestReports:
    """Reports endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_daily_report(self, auth_token):
        """Test #14: GET /api/reports/daily?date=2026-03-07 returns daily report"""
        response = requests.get(
            f"{BASE_URL}/api/reports/daily?date=2026-03-07",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "date" in data, "date missing"
        assert "total_sales" in data, "total_sales missing"
        assert "total_transactions" in data, "total_transactions missing"
        assert "transactions" in data, "transactions missing"
        
        print(f"PASS: Daily report - date={data['date']}, sales={data['total_sales']}, txns={data['total_transactions']}")


class TestPartners:
    """Partner stores and canvassers endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_partner_stores(self, auth_token):
        """Test #15: GET /api/partner-stores returns partner stores list"""
        response = requests.get(
            f"{BASE_URL}/api/partner-stores",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Partner stores should be a list"
        print(f"PASS: Partner stores returned {len(data)} items")
    
    def test_canvassers(self, auth_token):
        """Test #16: GET /api/canvassers returns canvassers list"""
        response = requests.get(
            f"{BASE_URL}/api/canvassers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Canvassers should be a list"
        print(f"PASS: Canvassers returned {len(data)} items")
    
    def test_purchases(self, auth_token):
        """Test #17: GET /api/purchases returns purchases list"""
        response = requests.get(
            f"{BASE_URL}/api/purchases",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Purchases should be a list"
        print(f"PASS: Purchases returned {len(data)} items")


class TestSupplierDebts:
    """Supplier debts endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_supplier_debts_overview(self, auth_token):
        """Test #18: GET /api/supplier-debts/overview returns debt overview"""
        response = requests.get(
            f"{BASE_URL}/api/supplier-debts/overview",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Supplier debts overview should be a list"
        
        # If there are suppliers, check structure
        if len(data) > 0:
            first = data[0]
            assert "supplier_id" in first, "supplier_id missing"
            assert "supplier_name" in first, "supplier_name missing"
            assert "outstanding" in first, "outstanding missing"
        
        print(f"PASS: Supplier debts overview returned {len(data)} suppliers")


class TestStoreSettings:
    """Store settings endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_store_settings(self, auth_token):
        """Test #19: GET /api/store-settings returns UD. AQIN TANI settings"""
        response = requests.get(
            f"{BASE_URL}/api/store-settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "store_name" in data, "store_name missing"
        assert data["store_name"] == "UD. AQIN TANI", f"Expected 'UD. AQIN TANI', got '{data['store_name']}'"
        assert "address" in data, "address missing"
        assert "phone" in data, "phone missing"
        
        print(f"PASS: Store settings - store_name={data['store_name']}")


# Run if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
