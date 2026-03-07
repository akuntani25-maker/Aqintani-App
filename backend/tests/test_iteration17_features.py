"""
Test iteration 17: 6 new features
1. Dashboard enhancement: pie chart, stock in/out, total assets, due dates per invoice
2. Canvassers page - merged Armada tab
3. POS: daily summary, HPP display, stock transfer
4. Reports: PDF export fix
5. Reports: CSV export improvement
6. Backend APIs for dashboard stats and POS daily summary
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope='module')
def auth_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@aqintani.com",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope='module')
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestDashboardStats:
    """Test dashboard/stats endpoint with new fields"""
    
    def test_dashboard_stats_returns_warehouse_chart(self, headers):
        """Dashboard stats should return warehouse_chart array"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "warehouse_chart" in data, "Missing warehouse_chart field"
        assert isinstance(data["warehouse_chart"], list), "warehouse_chart should be a list"
        # Each item should have name and value
        for item in data["warehouse_chart"]:
            assert "name" in item, "warehouse_chart item missing 'name'"
            assert "value" in item, "warehouse_chart item missing 'value'"
    
    def test_dashboard_stats_returns_stock_in_today(self, headers):
        """Dashboard stats should return stock_in_today"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "stock_in_today" in data, "Missing stock_in_today field"
        assert isinstance(data["stock_in_today"], (int, float)), "stock_in_today should be numeric"
    
    def test_dashboard_stats_returns_stock_out_today(self, headers):
        """Dashboard stats should return stock_out_today"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "stock_out_today" in data, "Missing stock_out_today field"
        assert isinstance(data["stock_out_today"], (int, float)), "stock_out_today should be numeric"
    
    def test_dashboard_stats_returns_total_assets(self, headers):
        """Dashboard stats should return total_assets"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_assets" in data, "Missing total_assets field"
        assert isinstance(data["total_assets"], (int, float)), "total_assets should be numeric"
    
    def test_dashboard_stats_returns_due_this_month(self, headers):
        """Dashboard stats should return due_this_month with per-invoice items"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "due_this_month" in data, "Missing due_this_month field"
        assert isinstance(data["due_this_month"], list), "due_this_month should be a list"
        # Each item should have supplier_name, purchase_number, remaining, due_date
        for item in data["due_this_month"]:
            assert "supplier_name" in item or "supplier_id" in item, "due item should have supplier info"
            assert "remaining" in item, "due item missing 'remaining'"
    
    def test_dashboard_stats_returns_all_existing_fields(self, headers):
        """Dashboard stats should still return all existing fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "today_sales", "today_transactions", "total_products", 
            "low_stock_count", "last_7_days", "inventory_value",
            "total_supplier_debt", "total_partner_debt"
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


class TestPOSDailySummary:
    """Test POS daily summary endpoint"""
    
    def test_pos_daily_summary_returns_count(self, headers):
        """POS daily summary should return transaction count"""
        response = requests.get(f"{BASE_URL}/api/pos/daily-summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "count" in data, "Missing count field"
        assert isinstance(data["count"], int), "count should be integer"
    
    def test_pos_daily_summary_returns_total_sales(self, headers):
        """POS daily summary should return total_sales"""
        response = requests.get(f"{BASE_URL}/api/pos/daily-summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_sales" in data, "Missing total_sales field"
        assert isinstance(data["total_sales"], (int, float)), "total_sales should be numeric"
    
    def test_pos_daily_summary_returns_total_cost(self, headers):
        """POS daily summary should return total_cost"""
        response = requests.get(f"{BASE_URL}/api/pos/daily-summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_cost" in data, "Missing total_cost field"
        assert isinstance(data["total_cost"], (int, float)), "total_cost should be numeric"
    
    def test_pos_daily_summary_returns_total_margin(self, headers):
        """POS daily summary should return total_margin"""
        response = requests.get(f"{BASE_URL}/api/pos/daily-summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_margin" in data, "Missing total_margin field"
        assert isinstance(data["total_margin"], (int, float)), "total_margin should be numeric"


class TestVehiclesCRUD:
    """Test vehicles API for Armada tab"""
    
    def test_get_vehicles(self, headers):
        """GET /api/vehicles returns list of vehicles"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list"
    
    def test_create_vehicle(self, headers):
        """POST /api/vehicles creates new vehicle"""
        vehicle_data = {
            "name": "TEST_Armada Test",
            "plate_number": "B 9999 TST",
            "area_route": "Test Route",
            "driver_name": "Test Driver"
        }
        response = requests.post(f"{BASE_URL}/api/vehicles", headers=headers, json=vehicle_data)
        assert response.status_code in [200, 201], f"Failed to create vehicle: {response.text}"
        data = response.json()
        assert data["name"] == vehicle_data["name"]
        assert data["plate_number"] == vehicle_data["plate_number"]
        
        # Cleanup
        if "id" in data:
            requests.delete(f"{BASE_URL}/api/vehicles/{data['id']}", headers=headers)


class TestStockTransfers:
    """Test stock transfers endpoint for POS transfer feature"""
    
    def test_get_warehouses(self, headers):
        """GET /api/warehouses returns list of warehouses"""
        response = requests.get(f"{BASE_URL}/api/warehouses", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return list of warehouses"
        assert len(data) >= 2, "Should have at least 2 warehouses"


class TestCanvassersAPI:
    """Test canvassers API"""
    
    def test_get_canvassers(self, headers):
        """GET /api/canvassers returns list"""
        response = requests.get(f"{BASE_URL}/api/canvassers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestReportsAPI:
    """Test reports endpoints used by CSV/PDF export"""
    
    def test_sales_detail_report(self, headers):
        """GET /api/reports/sales-detail returns report data"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/reports/sales-detail?date_from={today}&date_to={today}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data, "Missing rows field"
        assert "total_sales" in data, "Missing total_sales field"
        assert "total_cost" in data, "Missing total_cost field"
        assert "total_margin" in data, "Missing total_margin field"
    
    def test_partner_sales_detail_report(self, headers):
        """GET /api/reports/partner-sales-detail returns report data"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/reports/partner-sales-detail?date_from={today}&date_to={today}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data, "Missing rows field"
        assert "total_sales" in data, "Missing total_sales field"
    
    def test_best_sellers_report(self, headers):
        """GET /api/reports/best-sellers returns report data"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/reports/best-sellers?date_from={today}&date_to={today}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data, "Missing rows field"
        assert "total_products" in data, "Missing total_products field"


class TestDueCalendar:
    """Test due calendar endpoint for dashboard"""
    
    def test_due_calendar_returns_purchases(self, headers):
        """GET /api/dashboard/due-calendar returns list of purchases with due dates"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/due-calendar?year=2026&month=1",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list"
