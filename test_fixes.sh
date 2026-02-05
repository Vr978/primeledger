#!/bin/bash

echo "========================================="
echo "Testing Logout & Token Revocation"
echo "========================================="
echo ""

# Step 1: Login
echo "1. Login as Alice..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"alice123"}')

echo "$LOGIN_RESPONSE" | jq '.'

# Extract tokens
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.refreshToken')

echo ""
echo "Access Token: $ACCESS_TOKEN"
echo "Refresh Token: $REFRESH_TOKEN"
echo ""

# Step 2: Test refresh BEFORE logout (should work)
echo "2. Testing refresh BEFORE logout (should work)..."
REFRESH_RESPONSE=$(curl -s -X POST http://localhost:8081/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

echo "$REFRESH_RESPONSE" | jq '.'
echo ""

# Step 3: Logout
echo "3. Logging out..."
LOGOUT_RESPONSE=$(curl -s -X POST http://localhost:8081/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

echo "$LOGOUT_RESPONSE" | jq '.'
echo ""

# Step 4: Test refresh AFTER logout (should FAIL)
echo "4. Testing refresh AFTER logout (should FAIL with 'token revoked')..."
REFRESH_AFTER_LOGOUT=$(curl -s -X POST http://localhost:8081/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

echo "$REFRESH_AFTER_LOGOUT" | jq '.'
echo ""

# Check if it failed
if echo "$REFRESH_AFTER_LOGOUT" | grep -q "revoked"; then
    echo "✅ SUCCESS: Token revocation is working! Refresh failed as expected."
else
    echo "❌ FAIL: Token was not revoked! Refresh still works."
fi

echo ""
echo "========================================="
echo "Testing Negative Amount Validation"
echo "========================================="
echo ""

# Test negative deposit
echo "5. Testing negative deposit (should FAIL)..."
NEGATIVE_DEPOSIT=$(curl -s -X POST http://localhost:8082/transactions/deposit \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accountId":1,"amount":-50.0}')

echo "$NEGATIVE_DEPOSIT"
echo ""

if echo "$NEGATIVE_DEPOSIT" | grep -q "must be positive"; then
    echo "✅ SUCCESS: Negative amount validation is working!"
else
    echo "❌ FAIL: Negative amounts are still accepted."
fi

echo ""
echo "========================================="
echo "Test Complete!"
echo "========================================="
