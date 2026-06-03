import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Custom metrics
const loginDuration = new Trend('login_duration');
const depositDuration = new Trend('deposit_duration');
const transferDuration = new Trend('transfer_duration');
const payDuration = new Trend('pay_duration');
const errors = new Counter('business_errors');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const TX_URL = __ENV.TX_URL || 'http://localhost:8082';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'],     // Less than 1% errors
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
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
  const email = `test-${uniqueId}@primeledger.com`;
  const password = 'testpass123';
  const name = `Test User ${uniqueId}`;

  let token = '';
  let accountId = 0;
  let accountNumber = '';

  // ==========================================
  group('1. Registration', () => {
    const res = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
      name: name,
      email: email,
      password: password,
    }), { headers: { 'Content-Type': 'application/json' } });

    const success = check(res, {
      'register: status 200': (r) => r.status === 200,
      'register: has token': (r) => JSON.parse(r.body).token !== null,
      'register: has refresh token': (r) => JSON.parse(r.body).refreshToken !== null,
    });

    if (!success) {
      errors.add(1);
      console.error(`Registration failed: ${res.status} ${res.body}`);
      return;
    }

    const body = JSON.parse(res.body);
    token = body.token;
  });

  if (!token) return;

  // ==========================================
  group('2. Login', () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: email,
      password: password,
    }), { headers: { 'Content-Type': 'application/json' } });

    loginDuration.add(Date.now() - start);

    check(res, {
      'login: status 200': (r) => r.status === 200,
      'login: has token': (r) => JSON.parse(r.body).token !== null,
    });

    token = JSON.parse(res.body).token;
  });

  // ==========================================
  group('3. Get Accounts (wallet auto-created)', () => {
    const res = http.get(`${BASE_URL}/accounts`, headers(token));

    const success = check(res, {
      'accounts: status 200': (r) => r.status === 200,
      'accounts: has 1 wallet': (r) => JSON.parse(r.body).length === 1,
      'accounts: balance is 0': (r) => parseFloat(JSON.parse(r.body)[0].balance) === 0,
      'accounts: has account number': (r) => JSON.parse(r.body)[0].accountNumber.startsWith('PL-'),
    });

    if (success) {
      const accounts = JSON.parse(res.body);
      accountId = accounts[0].id;
      accountNumber = accounts[0].accountNumber;
    } else {
      errors.add(1);
      console.error(`Get accounts failed: ${res.status} ${res.body}`);
    }
  });

  if (!accountId) return;

  // ==========================================
  group('4. Deposit (direct)', () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/payments/deposit-direct`, JSON.stringify({
      amount: 500.00,
    }), headers(token));

    depositDuration.add(Date.now() - start);

    check(res, {
      'deposit: status 200': (r) => r.status === 200,
      'deposit: balance updated': (r) => parseFloat(JSON.parse(r.body).newBalance) === 500.0,
    });
  });

  // ==========================================
  group('5. Pay (withdraw with category)', () => {
    const start = Date.now();
    const res = http.post(`${TX_URL}/transactions/withdraw`, JSON.stringify({
      accountId: accountId,
      amount: 50.00,
      category: 'GROCERIES',
      description: 'Weekly groceries',
    }), headers(token));

    payDuration.add(Date.now() - start);

    check(res, {
      'pay: status 200': (r) => r.status === 200,
      'pay: type is WITHDRAW': (r) => JSON.parse(r.body).type === 'WITHDRAW',
      'pay: category is GROCERIES': (r) => JSON.parse(r.body).category === 'GROCERIES',
    });
  });

  // ==========================================
  group('6. Check balance after pay', () => {
    const res = http.get(`${BASE_URL}/accounts`, headers(token));

    check(res, {
      'balance: is 450 after pay': (r) => parseFloat(JSON.parse(r.body)[0].balance) === 450.0,
    });
  });

  // ==========================================
  group('7. Transfer to admin account', () => {
    sleep(0.5); // Allow previous request to complete
    const start = Date.now();
    const res = http.post(`${TX_URL}/transactions/transfer`, JSON.stringify({
      fromAccountId: accountId,
      toAccountNumber: 'PL-2026-000001',
      amount: 25.00,
      description: 'Test transfer to admin',
    }), headers(token));

    transferDuration.add(Date.now() - start);

    if (res.status !== 200) {
      console.error(`Transfer failed: status=${res.status} body=${res.body}`);
    }

    check(res, {
      'transfer: status 200': (r) => r.status === 200,
      'transfer: type is TRANSFER_OUT': (r) => r.status === 200 && JSON.parse(r.body).type === 'TRANSFER_OUT',
    });
  });

  // ==========================================
  group('8. Check balance after transfer', () => {
    const res = http.get(`${BASE_URL}/accounts`, headers(token));

    check(res, {
      'balance: is 425 after transfer': (r) => parseFloat(JSON.parse(r.body)[0].balance) === 425.0,
    });
  });

  // ==========================================
  group('9. Transaction history', () => {
    const res = http.get(`${TX_URL}/transactions`, headers(token));

    check(res, {
      'history: status 200': (r) => r.status === 200,
      'history: has 2 transactions': (r) => JSON.parse(r.body).length >= 2,
    });
  });

  // ==========================================
  group('10. Stats endpoint', () => {
    const res = http.get(`${TX_URL}/transactions/stats`, headers(token));

    check(res, {
      'stats: status 200': (r) => r.status === 200,
      'stats: has weeklyActivity': (r) => JSON.parse(r.body).weeklyActivity !== undefined,
      'stats: has expenseByCategory': (r) => JSON.parse(r.body).expenseByCategory !== undefined,
      'stats: has balanceHistory': (r) => JSON.parse(r.body).balanceHistory !== undefined,
    });
  });

  // ==========================================
  group('11. Insufficient balance (should fail)', () => {
    const res = http.post(`${TX_URL}/transactions/withdraw`, JSON.stringify({
      accountId: accountId,
      amount: 99999.00,
      category: 'OTHER',
      description: 'Should fail',
    }), headers(token));

    check(res, {
      'insufficient: status 400': (r) => r.status === 400,
    });
  });

  // ==========================================
  group('12. Health checks', () => {
    const accHealth = http.get(`${BASE_URL}/actuator/health`);
    const txHealth = http.get(`${TX_URL}/actuator/health`);

    check(accHealth, { 'account-service healthy': (r) => r.status === 200 });
    check(txHealth, { 'transaction-service healthy': (r) => r.status === 200 });
  });

  sleep(1);
}
