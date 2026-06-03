# PrimeLedger AWS Resources Guide

## How to Find and Delete Every Resource

All resources are created via CDK (CloudFormation). The primary deletion method is:

```bash
cd infra && npx cdk destroy --all --force
```

If that fails, use `bash scripts/nuke-aws.sh` for comprehensive cleanup.

---

## Resource Inventory

| Resource | Service | Console Path | Manual Delete |
|----------|---------|--------------|---------------|
| VPC + Subnets | VPC | VPC → Your VPCs → filter "primeledger" | Delete VPC (cascades) |
| Aurora PostgreSQL | RDS | RDS → Databases → "primeledger-db" | Actions → Delete (skip snapshot) |
| ECS Cluster | ECS | ECS → Clusters → "primeledger" | Delete services → Delete cluster |
| ECS Services (×3) | ECS | ECS → Clusters → primeledger → Services | Update desired=0 → Delete |
| ALB | EC2 | EC2 → Load Balancers → "prime" | Delete |
| API Gateway | API GW | API Gateway → APIs → "PrimeLedger" | Delete |
| Kinesis Stream | Kinesis | Kinesis → Data Streams → "primeledger-events" | Delete |
| Kinesis Firehose | Kinesis | Kinesis → Delivery Streams → "primeledger-firehose" | Delete |
| DynamoDB Tables (×2) | DynamoDB | DynamoDB → Tables → "primeledger-*" | Delete table |
| S3 Bucket | S3 | S3 → Buckets → "primeledger-datalake-*" | Empty → Delete |
| ECR Repos (×3) | ECR | ECR → Repositories → "primeledger/*" | Delete (force) |
| Secrets (×2) | Secrets Mgr | Secrets Manager → "primeledger/*" | Delete (no recovery) |
| CloudWatch Logs | CloudWatch | CloudWatch → Log Groups → "/ecs/primeledger*" | Delete |
| Glue Database | Glue | Glue → Databases → "primeledger" | Delete database |
| Cloud Map Namespace | Cloud Map | Cloud Map → Namespaces → "primeledger" | Delete |
| SES Identity | SES | SES → Verified identities | Delete |
| Security Groups | VPC | VPC → Security Groups → filter "primeledger" | Delete (after ECS/RDS gone) |

---

## Cost Monitoring

- **Billing Dashboard:** AWS Console → Billing → Bills
- **Cost Explorer:** AWS Console → Billing → Cost Explorer → filter by tag or service
- **Budget Alarm:** Set in CDK (alerts at $10, $25, $50)

## Expected Costs While Running

| Service | Cost/hour | Cost/day (8hrs) |
|---------|-----------|-----------------|
| Aurora Serverless v2 (0.5 ACU) | $0.06 | $0.48 |
| ECS Fargate (3 × 0.25vCPU) | $0.03 | $0.24 |
| ALB | $0.02 | $0.16 |
| Kinesis (on-demand) | $0.015 | $0.12 |
| Other (API GW, DDB, S3) | ~$0.01 | ~$0.08 |
| **Total** | **~$0.14/hr** | **~$1.08/day** |

**2-hour demo session: ~$0.28**
**Full day up: ~$1.08**
**Month (always on): ~$32** ← this is why we destroy after demo

---

## Emergency: "I forgot to destroy and it's been running"

1. Run: `bash scripts/nuke-aws.sh`
2. If that fails: Go to CloudFormation → find PrimeLedger stacks → Delete all
3. Double-check: RDS → make sure no Aurora cluster exists
4. Check billing 24hrs later to confirm $0 accrual
