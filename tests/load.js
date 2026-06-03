import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const TX_URL = __ENV.TX_URL || 'http://localhost:8082';

const depositLatency = new Trend('deposit_latency');
const payLatency = new Trend('pay_latency');
const transferLatency = new Trend('transfer_latency');

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 users
    { duration: '2m', target: 10 },    // Hold at 10 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // 95% under 3s
    http_req_failed: ['rate<0.05'],     // Less than 5% errors
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

export function setup() {
  // Register a test user that all VUs will share for read operations
  // Each VU registers its own user for write operations
  return {};
}

export default function () {
  const uniqueId = `${__VU}-${__ITER}-${Date.now()}`;
  const email = `load-${uniqueId}@test.com`;

  // Register
  const regRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
    name: `Load Test ${__VU}`,
    email: email,
    password: 'loadtest123',
  }), { headers: { 'Content-Type': 'application/json' } });

  if (regRes.status !== 200) {
    sleep(1);
    return;
  }

  const token = JSON.parse(regRes.body).token;
  const accounts = JSON.parse(http.get(`${BASE_URL}/accounts`, headers(token)).body);

  if (!accounts || accounts.length === 0) {
    sleep(1);
    return;
  }

  const accountId = accounts[0].id;

  // Deposit
  let start = Date.now();
  const depRes = http.post(`${BASE_URL}/payments/deposit-direct`, JSON.stringify({
    amount: 1000.00,
  }), headers(token));
  depositLatency.add(Date.now() - start);
  check(depRes, { 'deposit ok': (r) => r.status === 200 });

  // Pay
  start = Date.now();
  const payRes = http.post(`${TX_URL}/transactions/withdraw`, JSON.stringify({
    accountId: accountId,
    amount: 25.00,
    category: 'ENTERTAINMENT',
    description: 'Load test payment',
  }), headers(token));
  payLatency.add(Date.now() - start);
  check(payRes, { 'pay ok': (r) => r.status === 200 });

  // Transfer
  start = Date.now();
  const txRes = http.post(`${TX_URL}/transactions/transfer`, JSON.stringify({
    fromAccountId: accountId,
    toAccountNumber: 'PL-2026-000001',
    amount: 10.00,
    description: 'Load test transfer',
  }), headers(token));
  transferLatency.add(Date.now() - start);
  check(txRes, { 'transfer ok': (r) => r.status === 200 });

  // Get stats
  http.get(`${TX_URL}/transactions/stats`, headers(token));

  sleep(1);
}
