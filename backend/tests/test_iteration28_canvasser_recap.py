"""
Test for Iteration 28: Canvasser Recap Feature
- Admin can view canvasser recap in Reports page
- Canvasser can view their own recap in Dashboard
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def canvasser_token(self):
        """Get canvasser auth token - try both email options"""
        # First try canvasser@gmail.com
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "canvasser@gmail.com",
            "password": "123456"
        })
        if response.status_code == 200:
            return response.json()["token"]
        
        # Try sahidin@aqintani.com if canvasser@gmail.com doesn't work
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sahidin@aqintani.com",
            "password": "123456"
        })
        if response.status_code == 200:
            return response.json()["token"]
        
        pytest.skip("Could not login as canvasser with either account")
    
    def test_admin_login(self, admin_token):
        """Test admin login"""
        assert admin_token is not None
        print("Admin login successful")
    
    def test_canvasser_login(self, canvasser_token):
        """Test canvasser login"""
        assert canvasser_token is not None
        print("Canvasser login successful")


class TestCanvasserRecapEndpoints:
    """Test canvasser recap API endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def canvasser_token(self):
        # Try canvasser@gmail.com first
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "canvasser@gmail.com",
            "password": "123456"
        })
        if response.status_code == 200:
            return response.json()["token"]
        
        # Fallback to sahidin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sahidin@aqintani.com",
            "password": "123456"
        })
        if response.status_code == 200:
            return response.json()["token"]
        return None
    
    def test_admin_canvasser_recap_endpoint(self, admin_token):
        """Test GET /api/reports/canvasser-recap returns proper structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/canvasser-recap?date=2026-03-02", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "date" in data, "Missing 'date' field"
        assert "canvassers" in data, "Missing 'canvassers' field"
        assert "data" in data, "Missing 'data' field"
        assert "summary" in data, "Missing 'summary' field"
        print(f"Canvasser recap endpoint returned data for {data['date']}")
        print(f"Summary: {data['summary']}")
    
    def test_admin_canvasser_recap_summary_fields(self, admin_token):
        """Test that summary contains expected fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/canvasser-recap?date=2026-03-02", headers=headers)
        assert response.status_code == 200
        summary = response.json()["summary"]
        
        required_fields = ["total_canvassers", "total_orders", "total_delivered", 
                          "total_settled", "total_order_value", "total_payment", "total_return_items"]
        for field in required_fields:
            assert field in summary, f"Missing summary field: {field}"
        print(f"Summary fields validated: {list(summary.keys())}")
    
    def test_admin_canvasser_recap_with_canvasser_filter(self, admin_token):
        """Test filtering by canvasser_id"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get canvasser list
        response = requests.get(f"{BASE_URL}/api/canvassers", headers=headers)
        assert response.status_code == 200
        canvassers = response.json()
        
        if len(canvassers) > 0:
            canvasser_id = canvassers[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/reports/canvasser-recap?date=2026-03-02&canvasser_id={canvasser_id}", 
                headers=headers
            )
            assert response.status_code == 200, f"Filter by canvasser failed: {response.text}"
            data = response.json()
            print(f"Filtered recap for canvasser {canvassers[0].get('name', canvasser_id)}")
        else:
            print("No canvassers found to test filter")
    
    def test_admin_canvasser_recap_per_canvasser_data(self, admin_token):
        """Test per-canvasser breakdown structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/canvasser-recap?date=2026-03-02", headers=headers)
        assert response.status_code == 200
        data_list = response.json()["data"]
        
        if len(data_list) > 0:
            canvasser_data = data_list[0]
            required_fields = ["canvasser_id", "canvasser_name", "total_orders", 
                              "total_delivered", "total_settled", "total_order_value",
                              "total_payment_received", "return_items", "stores_visited", "orders"]
            for field in required_fields:
                assert field in canvasser_data, f"Missing canvasser data field: {field}"
            print(f"Canvasser {canvasser_data['canvasser_name']} has {canvasser_data['total_orders']} orders")
        else:
            print("No canvasser data for this date")
    
    def test_canvasser_my_recap_endpoint(self, canvasser_token):
        """Test GET /api/canvassers/my-recap for canvasser self-recap"""
        if not canvasser_token:
            pytest.skip("No canvasser token available")
        
        headers = {"Authorization": f"Bearer {canvasser_token}"}
        response = requests.get(f"{BASE_URL}/api/canvassers/my-recap?date=2026-03-02", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        required_fields = ["date", "total_orders", "total_settled", "total_value", 
                          "total_paid", "total_remaining", "stores_visited", "return_items"]
        for field in required_fields:
            assert field in data, f"Missing my-recap field: {field}"
        print(f"My recap for {data['date']}: {data['total_orders']} orders, {data['total_settled']} settled")
    
    def test_canvasser_my_recap_requires_canvasser_role(self, admin_token):
        """Test that my-recap is restricted to canvasser role"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/canvassers/my-recap?date=2026-03-02", headers=headers)
        # Admin should get 403 (Canvasser access only)
        assert response.status_code == 403, f"Expected 403 for admin, got {response.status_code}"
        print("my-recap correctly restricts access to canvasser role only")


class TestCanvasserDataWithRealData:
    """Test canvasser recap with actual data from date 2026-03-02"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_recap_with_sahidin_data(self, admin_token):
        """Test recap for date 2026-03-02 which should have SAHIDIN's orders"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/canvasser-recap?date=2026-03-02", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        print(f"Date: {data['date']}")
        print(f"Total canvassers with orders: {data['summary']['total_canvassers']}")
        print(f"Total orders: {data['summary']['total_orders']}")
        print(f"Total order value: {data['summary']['total_order_value']}")
        
        # Check if SAHIDIN is in the data
        sahidin_found = False
        for cv in data["data"]:
            if "SAHIDIN" in cv.get("canvasser_name", "").upper():
                sahidin_found = True
                print(f"Found SAHIDIN with {cv['total_orders']} orders, value: {cv['total_order_value']}")
                break
        
        if not sahidin_found:
            print("SAHIDIN not found in data - may have no orders for this date")
        
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
