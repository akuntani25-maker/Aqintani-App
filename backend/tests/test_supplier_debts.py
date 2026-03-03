"""
Test suite for Supplier Debt Management APIs
Tests: /api/supplier-debts/* endpoints including overview, summary, purchases, payments, CSV export
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSupplierDebtAPIs:
    """Tests for Supplier Debt Management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store a supplier ID for tests
        self.supplier_id = None
    
    def test_supplier_debts_overview(self):
        """GET /api/supplier-debts/overview - Returns all suppliers with debt summary"""
        response = self.session.get(f"{BASE_URL}/api/supplier-debts/overview")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure of first supplier if exists
        if len(data) > 0:
            supplier = data[0]
            assert "supplier_id" in supplier
            assert "supplier_name" in supplier
            assert "outstanding" in supplier
            assert "total_purchases" in supplier
            assert "total_paid" in supplier
            assert "purchase_count" in supplier
            assert "unpaid_count" in supplier
            
            # Store supplier_id for later tests
            self.supplier_id = supplier["supplier_id"]
            
            # Verify data types
            assert isinstance(supplier["outstanding"], (int, float))
            assert isinstance(supplier["purchase_count"], int)
            
        print(f"✓ Overview returned {len(data)} suppliers")
    
    def test_supplier_debts_summary(self):
        """GET /api/supplier-debts/summary - Aggregate debt summary"""
        response = self.session.get(f"{BASE_URL}/api/supplier-debts/summary")
        
        assert response.status_code == 200
        data = response.json()
        
        # Required fields
        assert "total_debt" in data
        assert "suppliers_with_debt" in data
        assert "total_paid_this_month" in data
        assert "payments_this_month_count" in data
        assert "overdue_count" in data
        assert "overdue_total" in data
        
        # Verify data types
        assert isinstance(data["total_debt"], (int, float))
        assert isinstance(data["suppliers_with_debt"], int)
        assert isinstance(data["overdue_count"], int)
        
        print(f"✓ Summary: Total debt={data['total_debt']}, Suppliers with debt={data['suppliers_with_debt']}")
    
    def test_supplier_purchases_unpaid_only(self):
        """GET /api/supplier-debts/{supplier_id}/purchases?show_all=false - Unpaid purchases"""
        # First get a supplier with debt
        overview_response = self.session.get(f"{BASE_URL}/api/supplier-debts/overview")
        suppliers = overview_response.json()
        
        # Find supplier with outstanding debt
        supplier_with_debt = next((s for s in suppliers if s["outstanding"] > 0), None)
        if not supplier_with_debt:
            pytest.skip("No supplier with outstanding debt found")
        
        supplier_id = supplier_with_debt["supplier_id"]
        response = self.session.get(f"{BASE_URL}/api/supplier-debts/{supplier_id}/purchases?show_all=false")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All returned purchases should have remaining > 0
        for purchase in data:
            assert purchase.get("remaining", 0) > 0, "show_all=false should only return unpaid"
            assert "id" in purchase
            assert "total" in purchase
            assert "paid" in purchase
            assert "remaining" in purchase
            assert "date" in purchase
            
        print(f"✓ Unpaid purchases for {supplier_with_debt['supplier_name']}: {len(data)} items")
    
    def test_supplier_purchases_all(self):
        """GET /api/supplier-debts/{supplier_id}/purchases?show_all=true - All purchases"""
        overview_response = self.session.get(f"{BASE_URL}/api/supplier-debts/overview")
        suppliers = overview_response.json()
        
        if not suppliers:
            pytest.skip("No suppliers found")
        
        supplier_id = suppliers[0]["supplier_id"]
        response = self.session.get(f"{BASE_URL}/api/supplier-debts/{supplier_id}/purchases?show_all=true")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ All purchases for {suppliers[0]['supplier_name']}: {len(data)} items")
    
    def test_supplier_payments_history(self):
        """GET /api/suppliers/{supplier_id}/payments - Payment history"""
        overview_response = self.session.get(f"{BASE_URL}/api/supplier-debts/overview")
        suppliers = overview_response.json()
        
        if not suppliers:
            pytest.skip("No suppliers found")
        
        supplier_id = suppliers[0]["supplier_id"]
        response = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}/payments")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify payment structure if exists
        if len(data) > 0:
            payment = data[0]
            assert "id" in payment
            assert "amount" in payment
            assert "created_at" in payment
            assert payment.get("type") == "supplier"
            
        print(f"✓ Payment history for supplier: {len(data)} payments")
    
    def test_export_csv(self):
        """GET /api/supplier-debts/export-csv - Export CSV"""
        response = self.session.get(f"{BASE_URL}/api/supplier-debts/export-csv")
        
        assert response.status_code == 200
        # Check content type is CSV
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type or "application/octet-stream" in content_type
        
        # Check CSV content has header row
        content = response.text
        assert "Supplier" in content
        assert "Sisa Hutang" in content or "outstanding" in content.lower()
        
        print(f"✓ CSV export successful ({len(content)} bytes)")
    
    def test_pay_supplier_debt(self):
        """POST /api/supplier-debts/{supplier_id}/pay - Record payment"""
        # Get supplier with outstanding debt
        overview_response = self.session.get(f"{BASE_URL}/api/supplier-debts/overview")
        suppliers = overview_response.json()
        
        supplier_with_debt = next((s for s in suppliers if s["outstanding"] > 0), None)
        if not supplier_with_debt:
            pytest.skip("No supplier with outstanding debt found")
        
        supplier_id = supplier_with_debt["supplier_id"]
        initial_debt = supplier_with_debt["outstanding"]
        
        # Make a small test payment (1000 IDR)
        test_amount = 1000
        response = self.session.post(
            f"{BASE_URL}/api/supplier-debts/{supplier_id}/pay?amount={test_amount}&notes=TEST_payment"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "amount_paid" in data
        assert data["amount_paid"] == test_amount
        assert "new_total_debt" in data
        
        # Verify debt decreased
        expected_new_debt = initial_debt - test_amount
        assert data["new_total_debt"] == expected_new_debt, f"Expected debt {expected_new_debt}, got {data['new_total_debt']}"
        
        print(f"✓ Payment of {test_amount} recorded. New debt: {data['new_total_debt']}")
    
    def test_pay_supplier_no_debt_fails(self):
        """POST /api/supplier-debts/{supplier_id}/pay - Should fail if no debt"""
        # Find supplier without debt
        overview_response = self.session.get(f"{BASE_URL}/api/supplier-debts/overview")
        suppliers = overview_response.json()
        
        supplier_no_debt = next((s for s in suppliers if s["outstanding"] <= 0 and s["purchase_count"] == 0), None)
        if not supplier_no_debt:
            # All suppliers have debt or purchases, test skipped
            pytest.skip("No supplier without any debt found")
        
        supplier_id = supplier_no_debt["supplier_id"]
        response = self.session.post(
            f"{BASE_URL}/api/supplier-debts/{supplier_id}/pay?amount=1000"
        )
        
        # Should return 400 because no debt
        assert response.status_code == 400
        print("✓ Payment correctly rejected for supplier with no debt")
    
    def test_overview_sorted_by_debt(self):
        """Verify overview returns suppliers sorted by debt (highest first)"""
        response = self.session.get(f"{BASE_URL}/api/supplier-debts/overview")
        data = response.json()
        
        if len(data) < 2:
            pytest.skip("Not enough suppliers to test sorting")
        
        # Suppliers with debt should come first, sorted by outstanding descending
        suppliers_with_debt = [s for s in data if s["outstanding"] > 0]
        
        for i in range(len(suppliers_with_debt) - 1):
            current = suppliers_with_debt[i]["outstanding"]
            next_val = suppliers_with_debt[i + 1]["outstanding"]
            assert current >= next_val, "Suppliers not sorted by debt descending"
        
        print("✓ Suppliers correctly sorted by debt (highest first)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
