import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const TX_URL = __ENV.TX_URL || 'http://localhost:8082';

export const options = {
  stages: [
    { duration: '10s', target: 1 },    // Baseline
    { duration: '5s', target: 100 },   // SPIKE!
    { duration: '30s', target: 100 },  // Hold spike
    { duration: '10s', target: 0 },    // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'], // 95% under 10s (very lenient for spike)
  },
};

export default function () {
  const uniqueId = `${__VU}-${__ITER}-${Date.now()}`;

  // Just hit health endpoints to see how the system handles sudden traffic
  const h1 = http.get(`${BASE_URL}/actuator/health`);
  const h2 = http.get(`${TX_URL}/actuator/health`);

  check(h1, { 'account-service alive': (r) => r.status === 200 });
  check(h2, { 'transaction-service alive': (r) => r.status === 200 });

  // Also try a login with wrong creds (tests auth under load without needing real accounts)
  http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: `nonexistent-${uniqueId}@test.com`,
    password: 'wrong',
  }), { headers: { 'Content-Type': 'application/json' } });

  sleep(0.1);
}
