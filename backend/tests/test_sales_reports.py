"""
Backend tests for Sales Report endpoints
Testing GET /api/reports/sales-detail and GET /api/reports/partner-sales-detail
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSalesReports:
    """Tests for POS and Partner Sales Detail Reports"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    # ==================== POS Sales Detail Tests ====================
    
    def test_pos_sales_detail_returns_200(self):
        """Test that /api/reports/sales-detail returns 200"""
        resp = self.session.get(f"{BASE_URL}/api/reports/sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    def test_pos_sales_detail_response_structure(self):
        """Test that POS sales detail has correct response structure"""
        resp = self.session.get(f"{BASE_URL}/api/reports/sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        data = resp.json()
        
        # Check top-level keys
        assert "date_from" in data, "Missing date_from"
        assert "date_to" in data, "Missing date_to"
        assert "rows" in data, "Missing rows"
        assert "total_sales" in data, "Missing total_sales"
        assert "total_cost" in data, "Missing total_cost"
        assert "total_margin" in data, "Missing total_margin"
        assert "total_items" in data, "Missing total_items"
        
        # Check rows is a list
        assert isinstance(data["rows"], list), "rows should be a list"
    
    def test_pos_sales_detail_row_structure(self):
        """Test that each row in POS sales has all required fields"""
        resp = self.session.get(f"{BASE_URL}/api/reports/sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        data = resp.json()
        
        if len(data["rows"]) > 0:
            row = data["rows"][0]
            assert "date" in row, "Missing date in row"
            assert "product_name" in row, "Missing product_name in row"
            assert "quantity" in row, "Missing quantity in row"
            assert "cost_price" in row, "Missing cost_price in row"
            assert "sell_price" in row, "Missing sell_price in row"
            assert "total_sell" in row, "Missing total_sell in row"
            assert "total_cost" in row, "Missing total_cost in row"
            assert "margin" in row, "Missing margin in row"
    
    def test_pos_sales_detail_summary_calculation(self):
        """Test that total_margin = total_sales - total_cost"""
        resp = self.session.get(f"{BASE_URL}/api/reports/sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        data = resp.json()
        
        expected_margin = data["total_sales"] - data["total_cost"]
        assert abs(data["total_margin"] - expected_margin) < 1, f"Margin mismatch: expected {expected_margin}, got {data['total_margin']}"
    
    def test_pos_sales_detail_empty_date_range(self):
        """Test POS sales with date range that should return no data"""
        resp = self.session.get(f"{BASE_URL}/api/reports/sales-detail?date_from=2020-01-01&date_to=2020-01-31")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rows"] == [], "Expected empty rows for old date range"
        assert data["total_sales"] == 0
        assert data["total_cost"] == 0
        assert data["total_margin"] == 0
    
    # ==================== Partner Sales Detail Tests ====================
    
    def test_partner_sales_detail_returns_200(self):
        """Test that /api/reports/partner-sales-detail returns 200"""
        resp = self.session.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    def test_partner_sales_detail_response_structure(self):
        """Test that Partner sales detail has correct response structure"""
        resp = self.session.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        data = resp.json()
        
        # Check top-level keys
        assert "date_from" in data, "Missing date_from"
        assert "date_to" in data, "Missing date_to"
        assert "rows" in data, "Missing rows"
        assert "total_sales" in data, "Missing total_sales"
        assert "total_cost" in data, "Missing total_cost"
        assert "total_margin" in data, "Missing total_margin"
        assert "total_items" in data, "Missing total_items"
    
    def test_partner_sales_detail_row_structure(self):
        """Test that each row in Partner sales has all required fields including partner_store_name"""
        resp = self.session.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        data = resp.json()
        
        if len(data["rows"]) > 0:
            row = data["rows"][0]
            assert "date" in row, "Missing date in row"
            assert "partner_store_name" in row, "Missing partner_store_name in row"
            assert "product_name" in row, "Missing product_name in row"
            assert "quantity_satuan" in row, "Missing quantity_satuan in row"
            assert "cost_price_per_unit" in row, "Missing cost_price_per_unit in row"
            assert "sell_price_per_unit" in row, "Missing sell_price_per_unit in row"
            assert "total_sell" in row, "Missing total_sell in row"
            assert "total_cost" in row, "Missing total_cost in row"
            assert "margin" in row, "Missing margin in row"
            # Additional partner-specific fields
            assert "quantity_original" in row, "Missing quantity_original in row"
            assert "unit_original" in row, "Missing unit_original in row"
    
    def test_partner_sales_detail_summary_calculation(self):
        """Test that total_margin = total_sales - total_cost for partner sales"""
        resp = self.session.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        data = resp.json()
        
        expected_margin = data["total_sales"] - data["total_cost"]
        assert abs(data["total_margin"] - expected_margin) < 1, f"Margin mismatch: expected {expected_margin}, got {data['total_margin']}"
    
    def test_partner_sales_quantity_satuan_conversion(self):
        """Test that quantity_satuan is correctly calculated for dus warehouse orders"""
        resp = self.session.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        data = resp.json()
        
        # Find a row with dus unit to verify conversion
        for row in data["rows"]:
            if row["unit_original"] == "dus" and row["quantity_original"] > 0:
                # For dus units, quantity_satuan should be quantity_original * items_per_box
                # OR could be same if items_per_box = 1
                assert row["quantity_satuan"] >= row["quantity_original"], \
                    f"quantity_satuan ({row['quantity_satuan']}) should be >= quantity_original ({row['quantity_original']}) for dus orders"
                break
    
    def test_partner_sales_detail_empty_date_range(self):
        """Test Partner sales with date range that should return no data"""
        resp = self.session.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2020-01-01&date_to=2020-01-31")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rows"] == [], "Expected empty rows for old date range"
        assert data["total_sales"] == 0
    
    # ==================== Auth Tests ====================
    
    def test_pos_sales_requires_admin(self):
        """Test that POS sales endpoint requires admin auth"""
        no_auth_session = requests.Session()
        resp = no_auth_session.get(f"{BASE_URL}/api/reports/sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        assert resp.status_code in [401, 403], f"Expected 401/403 without auth, got {resp.status_code}"
    
    def test_partner_sales_requires_admin(self):
        """Test that Partner sales endpoint requires admin auth"""
        no_auth_session = requests.Session()
        resp = no_auth_session.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2026-01-01&date_to=2026-12-31")
        assert resp.status_code in [401, 403], f"Expected 401/403 without auth, got {resp.status_code}"
