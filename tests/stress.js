import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const TX_URL = __ENV.TX_URL || 'http://localhost:8082';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm up
    { duration: '1m', target: 25 },    // Moderate load
    { duration: '1m', target: 50 },    // Heavy load (stress point)
    { duration: '30s', target: 0 },    // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<5000'],  // 99% under 5s (more lenient)
    http_req_failed: ['rate<0.10'],     // Less than 10% errors (stress allows more)
  },
};

function headers(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
}

export default function () {
  const uniqueId = `${__VU}-${__ITER}-${Date.now()}`;
  const email = `stress-${uniqueId}@test.com`;

  // Fast registration + deposit + pay cycle
  const regRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
    name: `Stress ${__VU}`,
    email: email,
    password: 'stress123',
  }), { headers: { 'Content-Type': 'application/json' } });

  if (regRes.status !== 200) {
    sleep(0.5);
    return;
  }

  const token = JSON.parse(regRes.body).token;
  const accounts = JSON.parse(http.get(`${BASE_URL}/accounts`, headers(token)).body);
  if (!accounts || accounts.length === 0) { sleep(0.5); return; }
  const accountId = accounts[0].id;

  // Deposit
  http.post(`${BASE_URL}/payments/deposit-direct`, JSON.stringify({ amount: 500 }), headers(token));

  // Rapid pay operations
  for (let i = 0; i < 3; i++) {
    const res = http.post(`${TX_URL}/transactions/withdraw`, JSON.stringify({
      accountId: accountId,
      amount: 10.00,
      category: 'BILLS',
      description: `Stress payment ${i}`,
    }), headers(token));
    check(res, { 'pay ok': (r) => r.status === 200 });
  }

  // Transfer
  http.post(`${TX_URL}/transactions/transfer`, JSON.stringify({
    fromAccountId: accountId,
    toAccountNumber: 'PL-2026-000001',
    amount: 5.00,
  }), headers(token));

  sleep(0.5);
}
