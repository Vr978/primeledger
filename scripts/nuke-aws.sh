#!/bin/bash
# PrimeLedger AWS Nuke Script
# This script destroys ALL AWS resources created by PrimeLedger CDK stacks.
# Run this if you want to ensure $0 ongoing cost.
#
# Usage: bash scripts/nuke-aws.sh
# 
# What it does:
# 1. Destroys all CDK stacks (CloudFormation)
# 2. Cleans up any orphaned resources that CDK might miss
# 3. Verifies the account is clean

set -e

REGION="us-east-1"
PROJECT_PREFIX="PrimeLedger"

echo "🔴 PRIMELEDGER AWS NUKE SCRIPT"
echo "================================"
echo "Region: $REGION"
echo "This will DESTROY all PrimeLedger AWS resources."
echo ""
read -p "Are you sure? (type 'yes' to confirm): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Step 1: Destroying CDK stacks..."
echo "================================"
if [ -d "infra" ]; then
    cd infra
    npx cdk destroy --all --force 2>&1 || echo "⚠️  CDK destroy had issues (may already be deleted)"
    cd ..
else
    echo "⚠️  No infra/ directory found. Checking for orphaned stacks..."
fi

echo ""
echo "Step 2: Cleaning orphaned resources..."
echo "======================================="

# Empty and delete S3 buckets with 'primeledger' in the name
echo "Checking S3 buckets..."
BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'primeledger')].Name" --output text 2>/dev/null || echo "")
for BUCKET in $BUCKETS; do
    echo "  Emptying and deleting bucket: $BUCKET"
    aws s3 rm s3://$BUCKET --recursive 2>/dev/null || true
    aws s3api delete-bucket --bucket $BUCKET --region $REGION 2>/dev/null || true
done

# Delete ECR repositories
echo "Checking ECR repositories..."
REPOS=$(aws ecr describe-repositories --region $REGION --query "repositories[?contains(repositoryName, 'primeledger')].repositoryName" --output text 2>/dev/null || echo "")
for REPO in $REPOS; do
    echo "  Deleting ECR repo: $REPO"
    aws ecr delete-repository --repository-name $REPO --region $REGION --force 2>/dev/null || true
done

# Delete CloudWatch log groups
echo "Checking CloudWatch log groups..."
LOG_GROUPS=$(aws logs describe-log-groups --region $REGION --log-group-name-prefix "/ecs/primeledger" --query "logGroups[].logGroupName" --output text 2>/dev/null || echo "")
for LG in $LOG_GROUPS; do
    echo "  Deleting log group: $LG"
    aws logs delete-log-group --log-group-name $LG --region $REGION 2>/dev/null || true
done

# Delete any remaining CloudFormation stacks
echo "Checking CloudFormation stacks..."
STACKS=$(aws cloudformation list-stacks --region $REGION --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query "StackSummaries[?contains(StackName, 'PrimeLedger') || contains(StackName, 'primeledger')].StackName" --output text 2>/dev/null || echo "")
for STACK in $STACKS; do
    echo "  Deleting stack: $STACK"
    aws cloudformation delete-stack --stack-name $STACK --region $REGION 2>/dev/null || true
    echo "  Waiting for deletion..."
    aws cloudformation wait stack-delete-complete --stack-name $STACK --region $REGION 2>/dev/null || true
done

# Delete Secrets Manager secrets
echo "Checking Secrets Manager..."
SECRETS=$(aws secretsmanager list-secrets --region $REGION --query "SecretList[?contains(Name, 'primeledger') || contains(Name, 'PrimeLedger')].Name" --output text 2>/dev/null || echo "")
for SECRET in $SECRETS; do
    echo "  Deleting secret: $SECRET"
    aws secretsmanager delete-secret --secret-id $SECRET --force-delete-without-recovery --region $REGION 2>/dev/null || true
done

echo ""
echo "Step 3: Verification..."
echo "========================"
echo "Checking for remaining resources..."

REMAINING_STACKS=$(aws cloudformation list-stacks --region $REGION --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE ROLLBACK_COMPLETE --query "StackSummaries[?contains(StackName, 'PrimeLedger') || contains(StackName, 'primeledger')].StackName" --output text 2>/dev/null || echo "")
if [ -z "$REMAINING_STACKS" ]; then
    echo "✅ No CloudFormation stacks remaining"
else
    echo "⚠️  Remaining stacks: $REMAINING_STACKS"
fi

REMAINING_BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'primeledger')].Name" --output text 2>/dev/null || echo "")
if [ -z "$REMAINING_BUCKETS" ]; then
    echo "✅ No S3 buckets remaining"
else
    echo "⚠️  Remaining buckets: $REMAINING_BUCKETS"
fi

echo ""
echo "🟢 NUKE COMPLETE"
echo "Your AWS account should now have $0 PrimeLedger charges."
echo ""
echo "If you still see charges in 24hrs, check:"
echo "  - AWS Console → Billing → Bills (look for unexpected services)"
echo "  - CloudWatch → Log Groups (data ingestion charges)"
echo "  - NAT Gateway (if VPC wasn't fully deleted)"
