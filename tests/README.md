# PrimeLedger Test Suite

## Testing Strategy

Run these tests against local Docker Compose first, then against AWS ALB to compare.

### How to Run

```bash
# Against local Docker:
k6 run tests/functional.js --env BASE_URL=http://localhost:8081 --env TX_URL=http://localhost:8082

# Against AWS:
k6 run tests/functional.js --env BASE_URL=http://<ALB-DNS> --env TX_URL=http://<ALB-DNS>
```

### Test Types

1. **functional.js** — Correctness tests (register, login, deposit, pay, transfer, check balances)
2. **load.js** — Sustained load (10 VUs for 2 minutes)
3. **stress.js** — Ramp up to 50 VUs to find breaking point
4. **spike.js** — Sudden burst of 100 VUs for 10 seconds

### Metrics Captured

- `http_req_duration` — Response time (p50, p95, p99)
- `http_req_failed` — Error rate
- `iterations` — Total successful user flows
- Custom: `login_duration`, `deposit_duration`, `transfer_duration`

### JWT Handling

Tests automatically:
1. Register a new user (unique email per VU)
2. Get JWT token from response
3. Use token for all subsequent authenticated requests
4. No manual token setup needed
