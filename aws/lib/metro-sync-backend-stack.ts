import * as cdk from "aws-cdk-lib";
import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export class MetroSyncBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const workerImageTag = String(this.node.tryGetContext("workerImageTag") ?? process.env.WORKER_IMAGE_TAG ?? "latest");
    const githubOwner = "spencermorris04";
    const githubRepo = "metro-trailer-ops";

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: "metro-trailer-sync",
      containerInsights: true,
    });

    const repository = new ecr.Repository(this, "WorkerRepository", {
      repositoryName: "metro-trailer-sync-worker",
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const githubOidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "GitHubOidcProvider",
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    );

    const githubDeployRole = new iam.Role(this, "GitHubActionsDeployRole", {
      roleName: "metro-trailer-github-actions-deploy",
      assumedBy: new iam.WebIdentityPrincipal(githubOidcProvider.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": `repo:${githubOwner}/${githubRepo}:ref:refs/heads/main`,
        },
      }),
      description: "Manual GitHub Actions deploy role for the Metro Trailer AWS sync backend.",
    });
    githubDeployRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"));

    const sourceBucket = new s3.Bucket(this, "WorkerSourceBucket", {
      bucketName: `metro-trailer-sync-worker-source-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const imageBuildProject = new codebuild.Project(this, "WorkerImageBuildProject", {
      projectName: "metro-trailer-sync-worker-image",
      source: codebuild.Source.s3({
        bucket: sourceBucket,
        path: "source/metro-trailer-sync-worker.zip",
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true,
        environmentVariables: {
          REPOSITORY_URI: { value: repository.repositoryUri },
          AWS_ACCOUNT_ID: { value: this.account },
          AWS_DEFAULT_REGION: { value: this.region },
        },
      },
      timeout: Duration.minutes(60),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              "aws --version",
              "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com",
            ],
          },
          build: {
            commands: [
              "docker build -f aws/Dockerfile -t $REPOSITORY_URI:latest .",
            ],
          },
          post_build: {
            commands: [
              "docker push $REPOSITORY_URI:latest",
            ],
          },
        },
      }),
    });

    sourceBucket.grantRead(imageBuildProject);
    repository.grantPullPush(imageBuildProject);

    const requestTable = new dynamodb.Table(this, "RequestTable", {
      tableName: "metro-trailer-sync-requests",
      partitionKey: { name: "requestId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const deadLetterQueue = new sqs.Queue(this, "RequestDeadLetterQueue", {
      queueName: "metro-trailer-sync-requests-dlq",
      retentionPeriod: Duration.days(14),
    });

    const requestQueue = new sqs.Queue(this, "RequestQueue", {
      queueName: "metro-trailer-sync-requests",
      visibilityTimeout: Duration.hours(2),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    const apiSecret = new secretsmanager.Secret(this, "ApiSecret", {
      secretName: "metro-trailer/sync-api",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ apiKey: "" }),
        generateStringKey: "apiKey",
        excludePunctuation: true,
      },
    });

    const bcSecret = new secretsmanager.Secret(this, "BusinessCentralSecret", {
      secretName: "metro-trailer/business-central",
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          METRO_GRAPH_TENANT_ID: "",
          METRO_GRAPH_CLIENT_ID: "",
          METRO_GRAPH_CLIENT_SECRET: "",
          METRO_BC_ENVIRONMENT: "METR01",
          METRO_BC_COMPANY: "Metro Trailer",
        }),
      ),
    });

    const databaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "DatabaseSecret",
      "metro-trailer/app-database",
    );

    const skybitzSecret = new secretsmanager.Secret(this, "SkyBitzSecret", {
      secretName: "metro-trailer/skybitz",
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          SKYBITZ_CLIENT_ID: "",
          SKYBITZ_CLIENT_SECRET: "",
          SKYBITZ_TOKEN_URL: "https://prodssoidp.skybitz.com/oauth2/token",
          SKYBITZ_SERVICE_URL: "https://xml-gen2.skybitz.com/",
        }),
      ),
    });

    const orbcommSecret = new secretsmanager.Secret(this, "OrbcommSecret", {
      secretName: "metro-trailer/orbcomm",
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          ORBCOMM_USER_ID: "",
          ORBCOMM_PASSWORD: "",
          ORBCOMM_BASE_URL: "https://platform.orbcomm.com/SynB2BGatewayService/api/",
          ORBCOMM_ACCESS_TOKEN: "",
          ORBCOMM_REFRESH_TOKEN: "",
          ORBCOMM_ACCESS_TOKEN_EXPIRES_AT: "",
          ORBCOMM_REFRESH_TOKEN_EXPIRES_AT: "",
        }),
      ),
    });

    const record360Secret = new secretsmanager.Secret(this, "Record360Secret", {
      secretName: "metro-trailer/record360",
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          RECORD360_API_KEY_ID: "",
          RECORD360_API_KEY_SECRET: "",
          RECORD360_API_BASE_URL: "https://api.record360.com/v3/",
        }),
      ),
    });

    const sharePointSecret = new secretsmanager.Secret(this, "SharePointSecret", {
      secretName: "metro-trailer/sharepoint",
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          SHAREPOINT_HOSTNAME: "metrotrailerleasing.sharepoint.com",
          SHAREPOINT_SITE_ID:
            "metrotrailerleasing.sharepoint.com,36d1633f-ec13-4c65-a9dc-18ec62cd8679,c509d15b-1e9a-405f-80f6-e3315235f226",
          SHAREPOINT_SITE_PATH: "",
          SHAREPOINT_DRIVE_ID: "",
          SHAREPOINT_LIBRARY_NAME: "WebPortal",
          SHAREPOINT_BASE_FOLDER_PATH: "FixedAssets",
        }),
      ),
    });

    const taskLogGroup = new logs.LogGroup(this, "WorkerLogGroup", {
      logGroupName: "/metro-trailer/sync-worker",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "WorkerTaskDefinition", {
      family: "metro-trailer-sync-worker",
      cpu: 1024,
      memoryLimitMiB: 2048,
    });

    const container = taskDefinition.addContainer("worker", {
      image: ecs.ContainerImage.fromEcrRepository(repository, workerImageTag),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: taskLogGroup,
        streamPrefix: "worker",
      }),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
        AWS_REGION: Stack.of(this).region,
        SYNC_REQUEST_QUEUE_URL: requestQueue.queueUrl,
        SYNC_REQUEST_TABLE_NAME: requestTable.tableName,
        SHAREPOINT_SYNC_STATE_BUCKET: sourceBucket.bucketName,
        ORBCOMM_SECRET_ID: orbcommSecret.secretName,
        ORBCOMM_REQUEST_TIMEOUT_SECONDS: "300",
        ORBCOMM_CONCURRENT_REQUEST_MAX_RETRIES: "10",
        ORBCOMM_CONCURRENT_REQUEST_RETRY_SECONDS: "90",
        BC_RAW_HISTORY_DATASETS: "all",
        BC_RAW_HISTORY_PAGE_SIZE: "1000",
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(databaseSecret, "DATABASE_URL"),
        METRO_GRAPH_TENANT_ID: ecs.Secret.fromSecretsManager(bcSecret, "METRO_GRAPH_TENANT_ID"),
        METRO_GRAPH_CLIENT_ID: ecs.Secret.fromSecretsManager(bcSecret, "METRO_GRAPH_CLIENT_ID"),
        METRO_GRAPH_CLIENT_SECRET: ecs.Secret.fromSecretsManager(bcSecret, "METRO_GRAPH_CLIENT_SECRET"),
        METRO_BC_ENVIRONMENT: ecs.Secret.fromSecretsManager(bcSecret, "METRO_BC_ENVIRONMENT"),
        METRO_BC_COMPANY: ecs.Secret.fromSecretsManager(bcSecret, "METRO_BC_COMPANY"),
        SKYBITZ_CLIENT_ID: ecs.Secret.fromSecretsManager(skybitzSecret, "SKYBITZ_CLIENT_ID"),
        SKYBITZ_CLIENT_SECRET: ecs.Secret.fromSecretsManager(skybitzSecret, "SKYBITZ_CLIENT_SECRET"),
        SKYBITZ_TOKEN_URL: ecs.Secret.fromSecretsManager(skybitzSecret, "SKYBITZ_TOKEN_URL"),
        SKYBITZ_SERVICE_URL: ecs.Secret.fromSecretsManager(skybitzSecret, "SKYBITZ_SERVICE_URL"),
        ORBCOMM_USER_ID: ecs.Secret.fromSecretsManager(orbcommSecret, "ORBCOMM_USER_ID"),
        ORBCOMM_PASSWORD: ecs.Secret.fromSecretsManager(orbcommSecret, "ORBCOMM_PASSWORD"),
        ORBCOMM_BASE_URL: ecs.Secret.fromSecretsManager(orbcommSecret, "ORBCOMM_BASE_URL"),
        ORBCOMM_ACCESS_TOKEN: ecs.Secret.fromSecretsManager(orbcommSecret, "ORBCOMM_ACCESS_TOKEN"),
        ORBCOMM_REFRESH_TOKEN: ecs.Secret.fromSecretsManager(orbcommSecret, "ORBCOMM_REFRESH_TOKEN"),
        ORBCOMM_ACCESS_TOKEN_EXPIRES_AT: ecs.Secret.fromSecretsManager(orbcommSecret, "ORBCOMM_ACCESS_TOKEN_EXPIRES_AT"),
        ORBCOMM_REFRESH_TOKEN_EXPIRES_AT: ecs.Secret.fromSecretsManager(orbcommSecret, "ORBCOMM_REFRESH_TOKEN_EXPIRES_AT"),
        RECORD360_API_KEY_ID: ecs.Secret.fromSecretsManager(record360Secret, "RECORD360_API_KEY_ID"),
        RECORD360_API_KEY_SECRET: ecs.Secret.fromSecretsManager(record360Secret, "RECORD360_API_KEY_SECRET"),
        RECORD360_API_BASE_URL: ecs.Secret.fromSecretsManager(record360Secret, "RECORD360_API_BASE_URL"),
        SHAREPOINT_HOSTNAME: ecs.Secret.fromSecretsManager(sharePointSecret, "SHAREPOINT_HOSTNAME"),
        SHAREPOINT_SITE_ID: ecs.Secret.fromSecretsManager(sharePointSecret, "SHAREPOINT_SITE_ID"),
        SHAREPOINT_SITE_PATH: ecs.Secret.fromSecretsManager(sharePointSecret, "SHAREPOINT_SITE_PATH"),
        SHAREPOINT_DRIVE_ID: ecs.Secret.fromSecretsManager(sharePointSecret, "SHAREPOINT_DRIVE_ID"),
        SHAREPOINT_LIBRARY_NAME: ecs.Secret.fromSecretsManager(sharePointSecret, "SHAREPOINT_LIBRARY_NAME"),
        SHAREPOINT_BASE_FOLDER_PATH: ecs.Secret.fromSecretsManager(sharePointSecret, "SHAREPOINT_BASE_FOLDER_PATH"),
      },
    });

    requestQueue.grantConsumeMessages(taskDefinition.taskRole);
    requestTable.grantReadWriteData(taskDefinition.taskRole);
    sourceBucket.grantReadWrite(taskDefinition.taskRole, "state/*");
    orbcommSecret.grantRead(taskDefinition.taskRole);
    taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:PutSecretValue"],
        resources: [orbcommSecret.secretArn],
      }),
    );
    for (const secret of [databaseSecret, bcSecret, skybitzSecret, orbcommSecret, record360Secret, sharePointSecret]) {
      secret.grantRead(taskDefinition.executionRole!);
    }

    const workerSecurityGroup = new ec2.SecurityGroup(this, "WorkerSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: "Outbound-only security group for Metro Trailer sync workers.",
    });

    const runTaskRole = new iam.Role(this, "RunTaskRole", {
      assumedBy: new iam.ServicePrincipal("events.amazonaws.com"),
    });
    runTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ecs:RunTask"],
        resources: [taskDefinition.taskDefinitionArn],
      }),
    );
    runTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [taskDefinition.taskRole.roleArn, taskDefinition.executionRole!.roleArn],
      }),
    );

    const subnetSelection = { subnetType: ec2.SubnetType.PUBLIC };
    const runTaskTarget = (jobMode: string) =>
      new targets.EcsTask({
        cluster,
        taskDefinition,
        assignPublicIp: true,
        securityGroups: [workerSecurityGroup],
        subnetSelection,
        taskCount: 1,
        containerOverrides: [
          {
            containerName: container.containerName,
            environment: [
              {
                name: "SYNC_JOB_MODE",
                value: jobMode,
              },
            ],
          },
        ],
        role: runTaskRole,
      });

    new events.Rule(this, "QueueWorkerSchedule", {
      ruleName: "metro-trailer-sync-queue-worker",
      enabled: false,
      schedule: events.Schedule.rate(Duration.minutes(1)),
      targets: [runTaskTarget("queue")],
    });

    new events.Rule(this, "DailySkyBitzSchedule", {
      ruleName: "metro-trailer-daily-skybitz-sync",
      schedule: events.Schedule.cron({ minute: "15", hour: "6" }),
      targets: [runTaskTarget("daily:skybitz")],
    });

    new events.Rule(this, "WeeklySkyBitzReconciliationSchedule", {
      ruleName: "metro-trailer-weekly-skybitz-reconciliation",
      schedule: events.Schedule.cron({ minute: "5", hour: "6", weekDay: "SUN" }),
      targets: [runTaskTarget("daily:skybitz-reconcile")],
    });

    new events.Rule(this, "DailyRecord360Schedule", {
      ruleName: "metro-trailer-daily-record360-sync",
      schedule: events.Schedule.cron({ minute: "45", hour: "6" }),
      targets: [runTaskTarget("daily:record360")],
    });

    new events.Rule(this, "HourlyOrbcommSchedule", {
      ruleName: "metro-trailer-hourly-orbcomm-sync",
      schedule: events.Schedule.cron({ minute: "30" }),
      targets: [runTaskTarget("daily:orbcomm")],
    });

    new events.Rule(this, "DailyTrailerDocumentsSchedule", {
      ruleName: "metro-trailer-daily-trailer-documents-sync",
      schedule: events.Schedule.cron({ minute: "15", hour: "7" }),
      targets: [runTaskTarget("daily:trailer-documents")],
    });

    new events.Rule(this, "BusinessCentralRawHistorySchedule", {
      ruleName: "metro-trailer-bc-raw-history-sync",
      enabled: false,
      schedule: events.Schedule.cron({ minute: "0", hour: "3" }),
      targets: [runTaskTarget("daily:bc-raw-history")],
    });

    const handler = new lambdaNode.NodejsFunction(this, "ApiHandler", {
      functionName: "metro-trailer-sync-api",
      entry: "aws/lambda/sync-api.ts",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(15),
      memorySize: 256,
      bundling: {
        externalModules: [],
      },
      environment: {
        SYNC_REQUEST_QUEUE_URL: requestQueue.queueUrl,
        SYNC_REQUEST_TABLE_NAME: requestTable.tableName,
        SYNC_API_SECRET_ARN: apiSecret.secretArn,
        SYNC_WORKER_CLUSTER_ARN: cluster.clusterArn,
        SYNC_WORKER_TASK_DEFINITION_ARN: taskDefinition.taskDefinitionArn,
        SYNC_WORKER_CONTAINER_NAME: "worker",
        SYNC_WORKER_SECURITY_GROUP_ID: workerSecurityGroup.securityGroupId,
        SYNC_WORKER_SUBNET_IDS: vpc.publicSubnets.map((subnet) => subnet.subnetId).join(","),
        RECORD360_SECRET_ARN: record360Secret.secretArn,
      },
    });

    requestQueue.grantSendMessages(handler);
    requestTable.grantReadWriteData(handler);
    apiSecret.grantRead(handler);
    record360Secret.grantRead(handler);
    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ecs:RunTask"],
        resources: [taskDefinition.taskDefinitionArn],
      }),
    );
    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [
          taskDefinition.taskRole.roleArn,
          taskDefinition.executionRole?.roleArn ?? "*",
        ],
      }),
    );

    const api = new apigateway.RestApi(this, "Api", {
      restApiName: "metro-trailer-sync-api",
      deployOptions: {
        stageName: "prod",
        tracingEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "X-Metro-Sync-Key"],
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(handler);
    const record360 = api.root.addResource("record360");
    record360.addResource("pdf-url").addResource("{inspectionId}").addMethod("GET", lambdaIntegration);
    const sync = api.root.addResource("sync");
    sync.addResource("skybitz").addMethod("POST", lambdaIntegration);
    sync.addResource("record360").addMethod("POST", lambdaIntegration);
    sync.addResource("trailer-documents").addMethod("POST", lambdaIntegration);
    sync.addResource("orbcomm").addMethod("POST", lambdaIntegration);
    sync.addResource("telematics").addMethod("POST", lambdaIntegration);
    const status = sync.addResource("status").addResource("{requestId}");
    status.addMethod("GET", lambdaIntegration);

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });
    new cdk.CfnOutput(this, "WorkerRepositoryUri", {
      value: repository.repositoryUri,
    });
    new cdk.CfnOutput(this, "WorkerSourceBucketName", {
      value: sourceBucket.bucketName,
    });
    new cdk.CfnOutput(this, "WorkerImageBuildProjectName", {
      value: imageBuildProject.projectName,
    });
    new cdk.CfnOutput(this, "ApiSecretName", {
      value: apiSecret.secretName,
    });
    new cdk.CfnOutput(this, "GitHubActionsDeployRoleArn", {
      value: githubDeployRole.roleArn,
    });
    new cdk.CfnOutput(this, "WorkerImageTag", {
      value: workerImageTag,
    });
  }
}
