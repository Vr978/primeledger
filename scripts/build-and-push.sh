#!/bin/bash
# Build Docker images for linux/amd64 (ECS Fargate) and push to ECR
# Usage: bash scripts/build-and-push.sh

set -e

REGION="us-east-1"
ACCOUNT_ID="241459378730"
ECR_BASE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "🔨 Building JARs..."
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
mvn clean package -DskipTests -q

echo "🔑 Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_BASE

echo "🐳 Building and pushing account-service..."
docker buildx build --platform linux/amd64 -t $ECR_BASE/primeledger/account-service:latest ./account-service --push

echo "🐳 Building and pushing transaction-service..."
docker buildx build --platform linux/amd64 -t $ECR_BASE/primeledger/transaction-service:latest ./transaction-service --push

echo "🐳 Building and pushing notification-service..."
docker buildx build --platform linux/amd64 -t $ECR_BASE/primeledger/notification-service:latest ./notification-service --push

echo ""
echo "✅ All images pushed to ECR!"
echo ""
echo "Now run: cd infra && npx cdk deploy --all"
