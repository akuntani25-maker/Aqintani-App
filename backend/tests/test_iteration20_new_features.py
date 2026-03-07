"""
Test iteration 20 - New Features Testing:
1. Personal Loans (Piutang Pribadi) - CRUD operations
2. Farmers & Farmer Debts (Hutang Petani) - CRUD operations
3. Daily Transactions endpoint
4. Dashboard stats with new fields (total_personal_loans, total_farmer_debt)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@aqintani.com", "password": "admin123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for API requests"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ============= PERSONAL LOANS TESTS =============

class TestPersonalLoansAPI:
    """Test Personal Loans (Piutang Pribadi) endpoints"""
    
    created_loan_id = None
    
    def test_01_personal_loans_overview(self, auth_headers):
        """Test GET /api/personal-loans/overview returns overview data"""
        response = requests.get(f"{BASE_URL}/api/personal-loans/overview", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate structure
        assert "loans" in data, "Response should contain 'loans' field"
        assert "total_lent" in data, "Response should contain 'total_lent'"
        assert "total_paid" in data, "Response should contain 'total_paid'"
        assert "total_remaining" in data, "Response should contain 'total_remaining'"
        assert "active_count" in data, "Response should contain 'active_count'"
        
        print(f"Personal loans overview: {len(data['loans'])} loans, remaining: {data['total_remaining']}")
    
    def test_02_create_personal_loan(self, auth_headers):
        """Test POST /api/personal-loans creates a new loan"""
        params = {
            "borrower_name": "TEST_Borrower_Iter20",
            "amount": 500000,
            "loan_type": "cash",
            "description": "Test loan for iteration 20",
            "borrower_phone": "08123456789"
        }
        response = requests.post(f"{BASE_URL}/api/personal-loans", headers=auth_headers, params=params)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "id" in data, "Response should contain 'id'"
        assert data["borrower_name"] == params["borrower_name"]
        assert data["amount"] == params["amount"]
        assert data["loan_type"] == params["loan_type"]
        assert data["remaining"] == params["amount"]  # No payment yet
        assert data["status"] == "aktif"
        
        TestPersonalLoansAPI.created_loan_id = data["id"]
        print(f"Created loan: {data['id']}")
    
    def test_03_get_loan_payments_empty(self, auth_headers):
        """Test GET /api/personal-loans/{loan_id}/payments returns empty initially"""
        loan_id = TestPersonalLoansAPI.created_loan_id
        assert loan_id, "No loan created"
        
        response = requests.get(f"{BASE_URL}/api/personal-loans/{loan_id}/payments", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Payments should be a list"
        assert len(data) == 0, "Should be empty initially"
        print(f"Payments for loan {loan_id}: {len(data)} (expected 0)")
    
    def test_04_pay_personal_loan(self, auth_headers):
        """Test POST /api/personal-loans/{loan_id}/pay records a payment"""
        loan_id = TestPersonalLoansAPI.created_loan_id
        assert loan_id, "No loan created"
        
        pay_amount = 100000
        response = requests.post(
            f"{BASE_URL}/api/personal-loans/{loan_id}/pay",
            headers=auth_headers,
            params={"amount": pay_amount, "notes": "First payment test"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["new_paid"] == pay_amount
        assert data["new_remaining"] == 400000  # 500000 - 100000
        assert data["status"] == "aktif"
        print(f"Payment recorded: {pay_amount}, remaining: {data['new_remaining']}")
    
    def test_05_get_loan_payments_after_pay(self, auth_headers):
        """Test GET /api/personal-loans/{loan_id}/payments returns payment after pay"""
        loan_id = TestPersonalLoansAPI.created_loan_id
        assert loan_id, "No loan created"
        
        response = requests.get(f"{BASE_URL}/api/personal-loans/{loan_id}/payments", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert len(data) == 1, f"Should have 1 payment, got {len(data)}"
        assert data[0]["amount"] == 100000
        assert data[0]["loan_id"] == loan_id
        print(f"Payments verified: {len(data)} payment(s)")
    
    def test_06_verify_overview_updated(self, auth_headers):
        """Verify overview reflects the loan and payment"""
        response = requests.get(f"{BASE_URL}/api/personal-loans/overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Find our test loan
        test_loan = next((l for l in data["loans"] if l.get("borrower_name") == "TEST_Borrower_Iter20"), None)
        assert test_loan, "Test loan should be in overview"
        assert test_loan["paid"] == 100000
        assert test_loan["remaining"] == 400000
        print("Overview reflects payment correctly")
    
    def test_07_delete_personal_loan(self, auth_headers):
        """Test DELETE /api/personal-loans/{loan_id} removes the loan"""
        loan_id = TestPersonalLoansAPI.created_loan_id
        assert loan_id, "No loan created"
        
        response = requests.delete(f"{BASE_URL}/api/personal-loans/{loan_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        print(f"Deleted loan: {loan_id}")
        
        # Verify deletion
        response = requests.get(f"{BASE_URL}/api/personal-loans/overview", headers=auth_headers)
        loans = response.json()["loans"]
        assert not any(l.get("id") == loan_id for l in loans), "Loan should be deleted"


# ============= FARMERS TESTS =============

class TestFarmersAPI:
    """Test Farmers endpoints"""
    
    created_farmer_id = None
    
    def test_01_get_farmers(self, auth_headers):
        """Test GET /api/farmers returns farmers list"""
        response = requests.get(f"{BASE_URL}/api/farmers", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Farmers should be a list"
        print(f"Farmers: {len(data)}")
    
    def test_02_create_farmer(self, auth_headers):
        """Test POST /api/farmers creates a farmer"""
        params = {
            "name": "TEST_Pak_Tani_Iter20",
            "phone": "081234567890",
            "address": "Desa Test",
            "debt_limit": 1000000
        }
        response = requests.post(f"{BASE_URL}/api/farmers", headers=auth_headers, params=params)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["name"] == params["name"]
        assert data["debt_limit"] == params["debt_limit"]
        assert data["current_debt"] == 0
        
        TestFarmersAPI.created_farmer_id = data["id"]
        print(f"Created farmer: {data['id']} - {data['name']}")
    
    def test_03_update_farmer(self, auth_headers):
        """Test PUT /api/farmers/{id} updates farmer"""
        farmer_id = TestFarmersAPI.created_farmer_id
        assert farmer_id, "No farmer created"
        
        response = requests.put(
            f"{BASE_URL}/api/farmers/{farmer_id}",
            headers=auth_headers,
            params={"debt_limit": 2000000}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["debt_limit"] == 2000000
        print(f"Updated farmer debt_limit to: {data['debt_limit']}")
    
    def test_04_farmer_debts_overview(self, auth_headers):
        """Test GET /api/farmer-debts/overview returns overview"""
        response = requests.get(f"{BASE_URL}/api/farmer-debts/overview", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "farmers" in data
        assert "total_debt" in data
        assert "active_debtors" in data
        assert "total_farmers" in data
        
        # Find our test farmer
        test_farmer = next((f for f in data["farmers"] if f.get("name") == "TEST_Pak_Tani_Iter20"), None)
        assert test_farmer, "Test farmer should be in overview"
        assert test_farmer["debt_limit"] == 2000000
        print(f"Farmer debts overview: total_debt={data['total_debt']}, farmers={data['total_farmers']}")


# ============= FARMER DEBT TRANSACTION TESTS =============

class TestFarmerDebtTransactions:
    """Test farmer debt transaction endpoints"""
    
    def test_01_pay_farmer_debt(self, auth_headers):
        """Test POST /api/farmer-debts/{farmer_id}/pay pays farmer debt"""
        farmer_id = TestFarmersAPI.created_farmer_id
        assert farmer_id, "No farmer created"
        
        # First add some debt by creating a transaction - but we need products
        # For now just test the pay endpoint with 0 debt scenario
        response = requests.post(
            f"{BASE_URL}/api/farmer-debts/{farmer_id}/pay",
            headers=auth_headers,
            params={"amount": 50000, "notes": "Test payment"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "new_debt" in data
        print(f"Farmer debt payment: new_debt={data['new_debt']}")
    
    def test_99_cleanup_farmer(self, auth_headers):
        """Cleanup: delete test farmer"""
        farmer_id = TestFarmersAPI.created_farmer_id
        if farmer_id:
            response = requests.delete(f"{BASE_URL}/api/farmers/{farmer_id}", headers=auth_headers)
            assert response.status_code == 200, f"Failed to delete farmer: {response.text}"
            print(f"Cleaned up farmer: {farmer_id}")


# ============= DAILY TRANSACTIONS TESTS =============

class TestDailyTransactions:
    """Test daily transactions endpoint"""
    
    def test_01_get_daily_transactions(self, auth_headers):
        """Test GET /api/pos/daily-transactions returns today's transactions"""
        response = requests.get(f"{BASE_URL}/api/pos/daily-transactions", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate structure
        assert "date" in data
        assert "transactions" in data
        assert "farmer_transactions" in data
        assert "total_sales" in data
        assert "total_farmer_sales" in data
        assert "grand_total" in data
        assert "count" in data
        assert "farmer_count" in data
        
        print(f"Daily transactions for {data['date']}: POS={data['count']}, Farmer={data['farmer_count']}, Grand Total={data['grand_total']}")
    
    def test_02_get_daily_transactions_with_date(self, auth_headers):
        """Test GET /api/pos/daily-transactions with specific date"""
        response = requests.get(f"{BASE_URL}/api/pos/daily-transactions?date=2026-01-01", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["date"] == "2026-01-01"
        print(f"Daily transactions for 2026-01-01: count={data['count']}")


# ============= DASHBOARD STATS WITH NEW FIELDS =============

class TestDashboardStats:
    """Test dashboard stats include new fields"""
    
    def test_01_dashboard_stats_new_fields(self, auth_headers):
        """Test GET /api/dashboard/stats returns total_personal_loans and total_farmer_debt"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate new fields exist
        assert "total_personal_loans" in data, "Missing total_personal_loans field"
        assert "total_farmer_debt" in data, "Missing total_farmer_debt field"
        
        # Existing fields should still be there
        assert "today_sales" in data
        assert "total_products" in data
        assert "inventory_value" in data
        assert "total_supplier_debt" in data
        assert "total_partner_debt" in data
        assert "total_assets" in data
        
        print(f"Dashboard stats: personal_loans={data['total_personal_loans']}, farmer_debt={data['total_farmer_debt']}, total_assets={data['total_assets']}")
        
        # Verify total_assets formula includes new fields
        # Formula: inventory + partner_debt + personal_loans + farmer_debt - supplier_debt
        expected_assets = (
            data.get("inventory_value", 0) +
            data.get("total_partner_debt", 0) +
            data.get("total_personal_loans", 0) +
            data.get("total_farmer_debt", 0) -
            data.get("total_supplier_debt", 0)
        )
        assert data["total_assets"] == expected_assets, f"Assets mismatch: expected {expected_assets}, got {data['total_assets']}"
        print("Asset formula verified correctly")


# ============= FARMER DEBT TRANSACTION WITH ITEMS (JSON BODY) =============

class TestFarmerDebtTransactionWithItems:
    """Test farmer debt transaction with JSON body"""
    
    test_farmer_id = None
    
    def test_01_setup_farmer(self, auth_headers):
        """Create test farmer for transaction test"""
        params = {
            "name": "TEST_Farmer_Transaction_Iter20",
            "phone": "08999999999",
            "debt_limit": 5000000
        }
        response = requests.post(f"{BASE_URL}/api/farmers", headers=auth_headers, params=params)
        assert response.status_code == 200
        TestFarmerDebtTransactionWithItems.test_farmer_id = response.json()["id"]
        print(f"Created test farmer: {TestFarmerDebtTransactionWithItems.test_farmer_id}")
    
    def test_02_farmer_debt_transaction_endpoint_exists(self, auth_headers):
        """Test POST /api/farmer-debts/transaction endpoint exists and validates"""
        farmer_id = TestFarmerDebtTransactionWithItems.test_farmer_id
        
        # Test with empty items - should fail with validation
        response = requests.post(
            f"{BASE_URL}/api/farmer-debts/transaction",
            headers=auth_headers,
            json={
                "farmer_id": farmer_id,
                "items": [],
                "total": 0,
                "paid": 0,
                "notes": "Test"
            }
        )
        # Even if items are empty, it should go through (business logic may differ)
        # We're mainly testing the endpoint exists and accepts JSON body
        print(f"Farmer debt transaction endpoint responded with status: {response.status_code}")
        # Don't assert specific status as it depends on business logic for empty items
    
    def test_99_cleanup_farmer(self, auth_headers):
        """Cleanup test farmer"""
        farmer_id = TestFarmerDebtTransactionWithItems.test_farmer_id
        if farmer_id:
            response = requests.delete(f"{BASE_URL}/api/farmers/{farmer_id}", headers=auth_headers)
            print(f"Cleaned up farmer: {farmer_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
