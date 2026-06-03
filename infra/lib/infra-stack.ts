import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as glue from 'aws-cdk-lib/aws-glue';
import { Construct } from 'constructs';

export class PrimeLedgerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================
    // NETWORKING
    // ========================
    const vpc = new ec2.Vpc(this, 'PrimeLedgerVpc', {
      maxAzs: 2,
      natGateways: 1, // Single NAT to save cost
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // ========================
    // SECRETS
    // ========================
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: 'primeledger/jwt-secret',
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: true,
      },
    });

    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: 'primeledger/db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'bankuser' }),
        generateStringKey: 'password',
        passwordLength: 32,
        excludePunctuation: true,
      },
    });

    // ========================
    // DATABASE (RDS PostgreSQL - free tier compatible)
    // ========================
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Security group for RDS',
      allowAllOutbound: true,
    });

    const dbInstance = new rds.DatabaseInstance(this, 'PrimeLedgerDb', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
      databaseName: 'banking',
      credentials: rds.Credentials.fromSecret(dbSecret),
      allocatedStorage: 20,
      maxAllocatedStorage: 20,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deleteAutomatedBackups: true,
      multiAz: false,
    });

    const dbEndpointHostname = dbInstance.instanceEndpoint.hostname;

    // ========================
    // DYNAMODB
    // ========================
    const idempotencyTable = new dynamodb.Table(this, 'IdempotencyKeys', {
      tableName: 'primeledger-idempotency-keys',
      partitionKey: { name: 'idempotencyKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const verificationCodesTable = new dynamodb.Table(this, 'VerificationCodes', {
      tableName: 'primeledger-verification-codes',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================
    // KINESIS DATA STREAM (disabled - requires service subscription)
    // ========================
    // const eventStream = new kinesis.Stream(this, 'EventStream', {
    //   streamName: 'primeledger-events',
    //   streamMode: kinesis.StreamMode.ON_DEMAND,
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    // });
    const eventStreamName = 'primeledger-events-disabled';

    // ========================
    // S3 DATA LAKE
    // ========================
    const dataLakeBucket = new s3.Bucket(this, 'DataLakeBucket', {
      bucketName: `primeledger-datalake-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        { transitions: [{ storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(30) }] },
      ],
    });

    // ========================
    // ECR REPOSITORIES (created manually, persist across deploys)
    // ========================
    const accountRepo = ecr.Repository.fromRepositoryName(this, 'AccountServiceRepo', 'primeledger/account-service');
    const transactionRepo = ecr.Repository.fromRepositoryName(this, 'TransactionServiceRepo', 'primeledger/transaction-service');
    const notificationRepo = ecr.Repository.fromRepositoryName(this, 'NotificationServiceRepo', 'primeledger/notification-service');

    // ========================
    // ECS CLUSTER + SERVICE DISCOVERY
    // ========================
    const cluster = new ecs.Cluster(this, 'PrimeLedgerCluster', {
      vpc,
      clusterName: 'primeledger',
    });

    const namespace = new servicediscovery.PrivateDnsNamespace(this, 'ServiceNamespace', {
      name: 'primeledger.local',
      vpc,
    });

    // ========================
    // ALB
    // ========================
    const alb = new elbv2.ApplicationLoadBalancer(this, 'PrimeLedgerAlb', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'primeledger-alb',
    });

    const listener = alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        messageBody: 'Not Found',
      }),
    });

    // Security group for ECS tasks
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,
    });

    // Allow ECS tasks to communicate with each other
    ecsSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.allTcp(), 'ECS task-to-task');

    // Allow ALB to access ECS tasks
    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8081), 'ALB to account');
    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8082), 'ALB to transaction');
    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8083), 'ALB to notification');

    // Allow ECS to access Aurora
    dbSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(5432), 'ECS to Aurora');

    // ========================
    // SHARED TASK ROLE
    // ========================
    const taskRole = new iam.Role(this, 'EcsTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant permissions
    jwtSecret.grantRead(taskRole);
    dbSecret.grantRead(taskRole);
    idempotencyTable.grantReadWriteData(taskRole);
    verificationCodesTable.grantReadWriteData(taskRole);
    // eventStream.grantReadWrite(taskRole); // Kinesis disabled
    dataLakeBucket.grantReadWrite(taskRole);

    // SES permissions for email
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // ========================
    // ACCOUNT SERVICE
    // ========================
    const accountTaskDef = new ecs.FargateTaskDefinition(this, 'AccountTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      taskRole,
    });

    accountTaskDef.addContainer('account-service', {
      image: ecs.ContainerImage.fromEcrRepository(accountRepo, 'latest'),
      portMappings: [{ containerPort: 8081 }],
      environment: {
        SPRING_PROFILES_ACTIVE: 'aws',
        SERVER_PORT: '8081',
        SPRING_DATASOURCE_URL: `jdbc:postgresql://${dbEndpointHostname}:5432/banking`,
        KINESIS_STREAM_NAME: eventStreamName,
        DYNAMODB_VERIFICATION_TABLE: verificationCodesTable.tableName,
        AWS_REGION: this.region,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
      },
      secrets: {
        SPRING_DATASOURCE_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        SPRING_DATASOURCE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'account-service',
        logGroup: new logs.LogGroup(this, 'AccountServiceLogs', {
          logGroupName: '/ecs/primeledger/account-service',
          retention: logs.RetentionDays.THREE_DAYS,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8081/actuator/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(200),
      },
    });

    const accountService = new ecs.FargateService(this, 'AccountService', {
      cluster,
      taskDefinition: accountTaskDef,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      assignPublicIp: false,
      circuitBreaker: { rollback: true },

      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      cloudMapOptions: {
        name: 'account-service',
        cloudMapNamespace: namespace,
      },
    });

    // ========================
    // TRANSACTION SERVICE
    // ========================
    const transactionTaskDef = new ecs.FargateTaskDefinition(this, 'TransactionTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      taskRole,
    });

    transactionTaskDef.addContainer('transaction-service', {
      image: ecs.ContainerImage.fromEcrRepository(transactionRepo, 'latest'),
      portMappings: [{ containerPort: 8082 }],
      environment: {
        SPRING_PROFILES_ACTIVE: 'aws',
        SERVER_PORT: '8082',
        SPRING_DATASOURCE_URL: `jdbc:postgresql://${dbEndpointHostname}:5432/banking`,
        ACCOUNT_SERVICE_URL: 'http://account-service.primeledger.local:8081',
        KINESIS_STREAM_NAME: eventStreamName,
        DYNAMODB_IDEMPOTENCY_TABLE: idempotencyTable.tableName,
        AWS_REGION: this.region,
      },
      secrets: {
        SPRING_DATASOURCE_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        SPRING_DATASOURCE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'transaction-service',
        logGroup: new logs.LogGroup(this, 'TransactionServiceLogs', {
          logGroupName: '/ecs/primeledger/transaction-service',
          retention: logs.RetentionDays.THREE_DAYS,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8082/actuator/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(200),
      },
    });

    const transactionService = new ecs.FargateService(this, 'TransactionService', {
      cluster,
      taskDefinition: transactionTaskDef,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      assignPublicIp: false,
      circuitBreaker: { rollback: true },

      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      cloudMapOptions: {
        name: 'transaction-service',
        cloudMapNamespace: namespace,
      },
    });

    // ========================
    // NOTIFICATION SERVICE
    // ========================
    const notificationTaskDef = new ecs.FargateTaskDefinition(this, 'NotificationTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      taskRole,
    });

    notificationTaskDef.addContainer('notification-service', {
      image: ecs.ContainerImage.fromEcrRepository(notificationRepo, 'latest'),
      portMappings: [{ containerPort: 8083 }],
      environment: {
        SPRING_PROFILES_ACTIVE: 'aws',
        SERVER_PORT: '8083',
        KINESIS_STREAM_NAME: eventStreamName,
        AWS_REGION: this.region,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'notification-service',
        logGroup: new logs.LogGroup(this, 'NotificationServiceLogs', {
          logGroupName: '/ecs/primeledger/notification-service',
          retention: logs.RetentionDays.THREE_DAYS,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8083/actuator/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(200),
      },
    });

    const notificationService = new ecs.FargateService(this, 'NotificationService', {
      cluster,
      taskDefinition: notificationTaskDef,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      assignPublicIp: false,
      circuitBreaker: { rollback: true },

      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      cloudMapOptions: {
        name: 'notification-service',
        cloudMapNamespace: namespace,
      },
    });

    // ========================
    // ALB TARGET GROUPS + ROUTING
    // ========================
    const accountTg = listener.addTargets('AccountTarget', {
      port: 8081,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [accountService],
      healthCheck: { path: '/actuator/health', interval: cdk.Duration.seconds(30) },
      conditions: [elbv2.ListenerCondition.pathPatterns(['/auth/*', '/accounts', '/accounts/*', '/payments', '/payments/*'])],
      priority: 10,
    });

    const transactionTg = listener.addTargets('TransactionTarget', {
      port: 8082,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [transactionService],
      healthCheck: { path: '/actuator/health', interval: cdk.Duration.seconds(30) },
      conditions: [elbv2.ListenerCondition.pathPatterns(['/transactions', '/transactions/*'])],
      priority: 20,
    });

    // ========================
    // OUTPUTS
    // ========================
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS Name - use this to access the API',
    });

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: dbEndpointHostname,
      description: 'Aurora cluster endpoint',
    });

    new cdk.CfnOutput(this, 'KinesisStreamName', {
      value: eventStreamName,
    });

    new cdk.CfnOutput(this, 'DataLakeBucketName', {
      value: dataLakeBucket.bucketName,
    });
  }
}
