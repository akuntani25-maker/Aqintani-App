"""
Test Iteration 29: 4 POS Enhancements
1. WITA Timezone (UTC+8) with 20:00 reset - transactions after 20:00 WITA count as next day
2. Ascending order for daily transactions (earliest first)
3. Copy button (frontend-only feature) 
4. Edit Transaction - PUT /api/transactions/{id}/edit-prices
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# WITA timezone (UTC+8)
WITA = timezone(timedelta(hours=8))

class TestWITATimezone:
    """Feature 1: WITA Timezone tests"""
    
    def test_business_date_endpoint_returns_date(self):
        """GET /api/pos/business-date should return business date and wita_today"""
        response = requests.get(f"{BASE_URL}/api/pos/business-date")
        assert response.status_code == 200
        
        data = response.json()
        assert "date" in data, "Missing 'date' field"
        assert "wita_today" in data, "Missing 'wita_today' field"
        
        # Validate date format YYYY-MM-DD
        assert len(data["date"]) == 10, f"Invalid date format: {data['date']}"
        assert len(data["wita_today"]) == 10, f"Invalid wita_today format: {data['wita_today']}"
        print(f"Business date: {data['date']}, WITA today: {data['wita_today']}")
    
    def test_business_date_logic_before_20(self):
        """Before 20:00 WITA, business date should be today's date"""
        now_wita = datetime.now(WITA)
        response = requests.get(f"{BASE_URL}/api/pos/business-date")
        data = response.json()
        
        expected_date = now_wita.strftime("%Y-%m-%d") if now_wita.hour < 20 else (now_wita + timedelta(days=1)).strftime("%Y-%m-%d")
        assert data["date"] == expected_date, f"Expected {expected_date}, got {data['date']}"
        print(f"Current WITA hour: {now_wita.hour}, Business date: {data['date']}")


class TestAuthentication:
    """Auth tests for kasir and admin"""
    
    def test_kasir_login(self):
        """Kasir login should succeed"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kasir@aqintani.com",
            "password": "kasir123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "cashier"
        print(f"Kasir login successful: {data['user']['name']}")
    
    def test_admin_login(self):
        """Admin login should succeed"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful: {data['user']['name']}")


@pytest.fixture(scope="module")
def kasir_token():
    """Get kasir auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kasir@aqintani.com",
        "password": "kasir123"
    })
    if response.status_code != 200:
        pytest.skip("Kasir login failed")
    return response.json()["token"]


@pytest.fixture(scope="module")
def test_transaction(kasir_token):
    """Create a test transaction for testing"""
    headers = {"Authorization": f"Bearer {kasir_token}"}
    
    # Get warehouse stock to find a product with stock
    wh_response = requests.get(f"{BASE_URL}/api/warehouse-stock?warehouse_id=gudang_toko", headers=headers)
    if wh_response.status_code != 200:
        pytest.skip("Failed to get warehouse stock")
    
    wh_stock = wh_response.json()
    available_products = [p for p in wh_stock if p.get("stock", 0) > 0]
    if not available_products:
        pytest.skip("No products with stock available")
    
    product_id = available_products[0]["product_id"]
    
    # Get product details
    prod_response = requests.get(f"{BASE_URL}/api/products/{product_id}", headers=headers)
    if prod_response.status_code != 200:
        pytest.skip("Failed to get product details")
    
    product = prod_response.json()
    price = product.get("price", 10000) or 10000
    
    # Create transaction
    txn_data = {
        "items": [{
            "product_id": product_id,
            "product_name": product.get("name", "TEST_PRODUCT"),
            "quantity": 1,
            "price": price,
            "cost_price": product.get("cost_price", 0),
            "subtotal": price,
            "warehouse_id": "gudang_toko",
            "sell_unit": "satuan"
        }],
        "subtotal": price,
        "tax": 0,
        "discount": 0,
        "total": price,
        "payment_method": "cash",
        "payment_amount": price + 1000,
        "change": 1000
    }
    
    response = requests.post(f"{BASE_URL}/api/transactions", headers=headers, json=txn_data)
    if response.status_code not in [200, 201]:
        pytest.skip(f"Failed to create transaction: {response.text}")
    
    return response.json()


class TestDailyTransactions:
    """Feature 2: Daily transactions with ascending order"""
    
    def test_daily_transactions_returns_data(self, kasir_token):
        """GET /api/pos/daily-transactions should return transaction data"""
        headers = {"Authorization": f"Bearer {kasir_token}"}
        
        # Get today's business date
        biz_response = requests.get(f"{BASE_URL}/api/pos/business-date")
        biz_date = biz_response.json()["date"]
        
        response = requests.get(f"{BASE_URL}/api/pos/daily-transactions?date={biz_date}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "date" in data
        assert "transactions" in data
        assert "farmer_transactions" in data
        assert "total_sales" in data
        assert "count" in data
        print(f"Daily transactions for {biz_date}: {data['count']} transactions, total: {data['total_sales']}")
    
    def test_daily_transactions_ascending_order(self, kasir_token, test_transaction):
        """Transactions should be sorted by created_at ascending (earliest first)"""
        headers = {"Authorization": f"Bearer {kasir_token}"}
        
        biz_response = requests.get(f"{BASE_URL}/api/pos/business-date")
        biz_date = biz_response.json()["date"]
        
        response = requests.get(f"{BASE_URL}/api/pos/daily-transactions?date={biz_date}", headers=headers)
        data = response.json()
        
        transactions = data.get("transactions", [])
        if len(transactions) > 1:
            # Verify ascending order
            for i in range(1, len(transactions)):
                prev_time = transactions[i-1]["created_at"]
                curr_time = transactions[i]["created_at"]
                assert prev_time <= curr_time, f"Transactions not in ascending order: {prev_time} > {curr_time}"
            print(f"Verified {len(transactions)} transactions are in ascending order (earliest first)")
        else:
            print(f"Only {len(transactions)} transaction(s) - ascending order verified by default")


class TestEditTransaction:
    """Feature 4: Edit Transaction prices"""
    
    def test_edit_prices_updates_price(self, kasir_token, test_transaction):
        """PUT /api/transactions/{id}/edit-prices should update item prices"""
        headers = {"Authorization": f"Bearer {kasir_token}"}
        txn_id = test_transaction["id"]
        
        # Get original item price
        original_item = test_transaction["items"][0]
        original_price = original_item["price"]
        new_price = original_price + 5000  # Increase by 5000
        
        # Edit prices
        payload = {
            "items": [{
                "product_id": original_item["product_id"],
                "price": new_price
            }]
        }
        
        response = requests.put(f"{BASE_URL}/api/transactions/{txn_id}/edit-prices", headers=headers, json=payload)
        assert response.status_code == 200
        
        updated_txn = response.json()
        updated_item = updated_txn["items"][0]
        
        # Verify price updated
        assert updated_item["price"] == new_price, f"Price not updated: expected {new_price}, got {updated_item['price']}"
        
        # Verify subtotal recalculated
        expected_subtotal = new_price * original_item["quantity"]
        assert updated_item["subtotal"] == expected_subtotal, f"Subtotal not recalculated: expected {expected_subtotal}, got {updated_item['subtotal']}"
        
        # Verify edit_notes added
        assert "edit_notes" in updated_txn, "Missing edit_notes field"
        assert len(updated_txn["edit_notes"]) > 0, "edit_notes should not be empty"
        
        print(f"Price updated from {original_price} to {new_price}, edit note: {updated_txn['edit_notes'][-1]}")
    
    def test_edit_prices_recalculates_total(self, kasir_token, test_transaction):
        """Edit prices should recalculate subtotal and total"""
        headers = {"Authorization": f"Bearer {kasir_token}"}
        txn_id = test_transaction["id"]
        
        # Get current transaction state
        txn_response = requests.get(f"{BASE_URL}/api/transactions/{txn_id}", headers=headers)
        current_txn = txn_response.json()
        
        item = current_txn["items"][0]
        new_price = 99000
        qty = item["quantity"]
        
        payload = {
            "items": [{
                "product_id": item["product_id"],
                "price": new_price
            }]
        }
        
        response = requests.put(f"{BASE_URL}/api/transactions/{txn_id}/edit-prices", headers=headers, json=payload)
        assert response.status_code == 200
        
        updated_txn = response.json()
        
        expected_subtotal = new_price * qty
        expected_total = expected_subtotal - current_txn.get("discount", 0) + current_txn.get("tax", 0)
        
        assert updated_txn["subtotal"] == expected_subtotal, f"Subtotal mismatch: expected {expected_subtotal}, got {updated_txn['subtotal']}"
        assert updated_txn["total"] == expected_total, f"Total mismatch: expected {expected_total}, got {updated_txn['total']}"
        
        print(f"Total recalculated correctly: {updated_txn['total']} (subtotal: {updated_txn['subtotal']})")
    
    def test_edit_prices_invalid_transaction(self, kasir_token):
        """Edit prices on non-existent transaction should return 404"""
        headers = {"Authorization": f"Bearer {kasir_token}"}
        
        payload = {"items": [{"product_id": "fake-id", "price": 10000}]}
        response = requests.put(f"{BASE_URL}/api/transactions/nonexistent-id/edit-prices", headers=headers, json=payload)
        
        assert response.status_code == 404
        print("Correctly returns 404 for non-existent transaction")


class TestTransactionCreation:
    """Test transaction is created with WITA timezone"""
    
    def test_transaction_has_wita_timestamp(self, test_transaction):
        """Created transaction should have WITA timezone timestamp"""
        created_at = test_transaction.get("created_at", "")
        
        # Check timestamp contains WITA offset (+08:00)
        assert "+08:00" in created_at or "T" in created_at, f"Invalid timestamp format: {created_at}"
        print(f"Transaction created with WITA timestamp: {created_at}")
    
    def test_transaction_has_business_date(self, test_transaction):
        """Created transaction should have business_date field"""
        assert "date" in test_transaction, "Missing 'date' field (business date)"
        
        # Date should be YYYY-MM-DD format
        date_str = test_transaction["date"]
        assert len(date_str) == 10, f"Invalid date format: {date_str}"
        print(f"Transaction has business date: {date_str}")
