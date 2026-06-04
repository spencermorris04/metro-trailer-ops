import * as cdk from "aws-cdk-lib";
import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as cloudtrail from "aws-cdk-lib/aws-cloudtrail";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as efs from "aws-cdk-lib/aws-efs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export class DocusealRuntimeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const imageTag = String(this.node.tryGetContext("docusealImageTag") ?? "latest");
    const useCustomImage = String(this.node.tryGetContext("docusealUseCustomImage") ?? "false") === "true";
    const domainName = String(this.node.tryGetContext("docusealDomainName") ?? "").trim();
    const certificateArn = String(this.node.tryGetContext("docusealCertificateArn") ?? "").trim();
    const hostedZoneDomainName = String(
      this.node.tryGetContext("docusealHostedZoneDomainName") ??
        domainName.split(".").slice(-2).join("."),
    ).trim();
    const appUrl = domainName ? `https://${domainName}` : undefined;

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    const loadBalancerSecurityGroup = new ec2.SecurityGroup(this, "LoadBalancerSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: "Public HTTP access to DocuSeal.",
    });
    loadBalancerSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow public HTTP.");
    if (domainName) {
      loadBalancerSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow public HTTPS.");
    }

    const appSecurityGroup = new ec2.SecurityGroup(this, "AppSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: "DocuSeal ECS service security group.",
    });
    appSecurityGroup.addIngressRule(loadBalancerSecurityGroup, ec2.Port.tcp(3000), "Allow ALB to reach DocuSeal.");

    const database = new rds.DatabaseInstance(this, "Database", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_13,
      }),
      credentials: rds.Credentials.fromGeneratedSecret("docuseal", {
        secretName: "metro-trailer/docuseal/database",
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
      }),
      databaseName: "docuseal",
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [new ec2.SecurityGroup(this, "DatabaseSecurityGroup", { vpc, allowAllOutbound: true })],
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      backupRetention: Duration.days(7),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    database.connections.allowDefaultPortFrom(appSecurityGroup, "Allow DocuSeal to connect to PostgreSQL.");

    const fileSystem = new efs.FileSystem(this, "FileSystem", {
      vpc,
      encrypted: true,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_30_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    fileSystem.connections.allowDefaultPortFrom(appSecurityGroup, "Allow DocuSeal to mount EFS.");

    const accessPoint = fileSystem.addAccessPoint("AccessPoint", {
      path: "/docuseal",
      createAcl: {
        ownerGid: "2000",
        ownerUid: "2000",
        permissions: "755",
      },
      posixUser: {
        gid: "2000",
        uid: "2000",
      },
    });

    const appSecret = new secretsmanager.Secret(this, "AppSecret", {
      secretName: "metro-trailer/docuseal/app",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ secretKeyBase: "" }),
        generateStringKey: "secretKeyBase",
        passwordLength: 128,
        excludePunctuation: true,
      },
    });

    const smtpSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "SmtpSecret",
      "metro-trailer/docuseal/smtp",
    );

    const attachmentsBucket = new s3.Bucket(this, "AttachmentsBucket", {
      bucketName: `metro-trailer-docuseal-attachments-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const repository = new ecr.Repository(this, "Repository", {
      repositoryName: "metro-trailer-docuseal",
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const sourceBucket = new s3.Bucket(this, "SourceBucket", {
      bucketName: `metro-trailer-docuseal-source-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const imageBuildProject = new codebuild.Project(this, "ImageBuildProject", {
      projectName: "metro-trailer-docuseal-image",
      source: codebuild.Source.s3({
        bucket: sourceBucket,
        path: "source/docuseal.zip",
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true,
        environmentVariables: {
          REPOSITORY_URI: { value: repository.repositoryUri },
          AWS_ACCOUNT_ID: { value: this.account },
          AWS_DEFAULT_REGION: { value: this.region },
          IMAGE_TAG: { value: imageTag },
        },
      },
      timeout: Duration.minutes(90),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              "aws --version",
              "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com",
              "find bin -type f -exec sed -i 's/\\r$//' {} \\;",
              "find bin -type f -exec chmod +x {} \\;",
            ],
          },
          build: {
            commands: [
              "docker build -t $REPOSITORY_URI:$IMAGE_TAG .",
            ],
          },
          post_build: {
            commands: [
              "docker push $REPOSITORY_URI:$IMAGE_TAG",
            ],
          },
        },
      }),
    });
    sourceBucket.grantRead(imageBuildProject);
    repository.grantPullPush(imageBuildProject);

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: "metro-trailer-docuseal",
      containerInsights: true,
    });

    const taskLogGroup = new logs.LogGroup(this, "TaskLogGroup", {
      logGroupName: "/metro-trailer/docuseal",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
      family: "metro-trailer-docuseal",
      cpu: 1024,
      memoryLimitMiB: 2048,
    });

    taskDefinition.addVolume({
      name: "docuseal-data",
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
        transitEncryption: "ENABLED",
        authorizationConfig: {
          accessPointId: accessPoint.accessPointId,
          iam: "ENABLED",
        },
      },
    });
    fileSystem.grantReadWrite(taskDefinition.taskRole);
    attachmentsBucket.grantReadWrite(taskDefinition.taskRole);

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      internetFacing: true,
      securityGroup: loadBalancerSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const httpListener = loadBalancer.addListener("HttpListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    const hostedZone = domainName && !certificateArn
      ? route53.HostedZone.fromLookup(this, "HostedZone", { domainName: hostedZoneDomainName })
      : null;
    const certificate =
      certificateArn
        ? acm.Certificate.fromCertificateArn(this, "HttpsCertificate", certificateArn)
        : domainName && hostedZone
        ? new acm.Certificate(this, "HttpsCertificate", {
            domainName,
            validation: acm.CertificateValidation.fromDns(hostedZone),
          })
        : null;

    const container = taskDefinition.addContainer("app", {
      image: useCustomImage
        ? ecs.ContainerImage.fromEcrRepository(repository, imageTag)
        : ecs.ContainerImage.fromRegistry(`docuseal/docuseal:${imageTag}`),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: taskLogGroup,
        streamPrefix: "app",
      }),
      environment: {
        DATABASE_HOST: database.dbInstanceEndpointAddress,
        DATABASE_NAME: "docuseal",
        DATABASE_PORT: "5432",
        DATABASE_USER: "docuseal",
        ...(domainName
          ? {
              APP_URL: appUrl!,
              EMAIL_HOST: domainName,
              FORCE_SSL: "true",
              HOST: domainName,
            }
          : {
              EMAIL_HOST: loadBalancer.loadBalancerDnsName,
              HOST: loadBalancer.loadBalancerDnsName,
            }),
        RAILS_ENV: "production",
        RAILS_LOG_TO_STDOUT: "true",
        AWS_REGION: this.region,
        S3_ATTACHMENTS_BUCKET: attachmentsBucket.bucketName,
        SMTP_ADDRESS: "smtp.resend.com",
        SMTP_AUTHENTICATION: "plain",
        SMTP_DOMAIN: "lumpkindevelopment.com",
        SMTP_ENABLE_STARTTLS: "true",
        SMTP_PORT: "587",
        SMTP_USERNAME: "resend",
      },
      secrets: {
        DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(database.secret!, "password"),
        SECRET_KEY_BASE: ecs.Secret.fromSecretsManager(appSecret, "secretKeyBase"),
        SMTP_FROM: ecs.Secret.fromSecretsManager(smtpSecret, "smtpFrom"),
        SMTP_PASSWORD: ecs.Secret.fromSecretsManager(smtpSecret, "smtpPassword"),
      },
    });
    container.addPortMappings({ containerPort: 3000 });
    container.addMountPoints({
      sourceVolume: "docuseal-data",
      containerPath: "/data/docuseal",
      readOnly: false,
    });

    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [appSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/up",
        healthyHttpCodes: "200-399",
        interval: Duration.seconds(30),
        timeout: Duration.seconds(10),
      },
      deregistrationDelay: Duration.seconds(30),
    });

    if (certificate) {
      httpListener.addAction("RedirectToHttps", {
        action: elbv2.ListenerAction.redirect({
          protocol: "HTTPS",
          port: "443",
          permanent: true,
        }),
      });

      loadBalancer
        .addListener("HttpsListener", {
          port: 443,
          protocol: elbv2.ApplicationProtocol.HTTPS,
          certificates: [certificate],
        })
        .addTargetGroups("DefaultTargetGroup", { targetGroups: [targetGroup] });
    } else {
      httpListener.addTargetGroups("DefaultTargetGroup", { targetGroups: [targetGroup] });
    }

    service.attachToApplicationTargetGroup(targetGroup);

    if (domainName && hostedZone) {
      new route53.ARecord(this, "AliasRecord", {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(loadBalancer)),
      });
    }

    new cdk.CfnOutput(this, "DocusealUrl", {
      value: appUrl ?? `http://${loadBalancer.loadBalancerDnsName}`,
    });
    new cdk.CfnOutput(this, "DocusealDatabaseSecretName", {
      value: database.secret!.secretName,
    });
    new cdk.CfnOutput(this, "DocusealAppSecretName", {
      value: appSecret.secretName,
    });
    new cdk.CfnOutput(this, "DocusealSmtpSecretName", {
      value: "metro-trailer/docuseal/smtp",
    });
    new cdk.CfnOutput(this, "DocusealAttachmentsBucketName", {
      value: attachmentsBucket.bucketName,
    });
    new cdk.CfnOutput(this, "DocusealRepositoryUri", {
      value: repository.repositoryUri,
    });
    new cdk.CfnOutput(this, "DocusealSourceBucketName", {
      value: sourceBucket.bucketName,
    });
    new cdk.CfnOutput(this, "DocusealImageBuildProjectName", {
      value: imageBuildProject.projectName,
    });
    new cdk.CfnOutput(this, "DocusealImageTag", {
      value: imageTag,
    });
  }
}

export class LeaseSigningArchiveStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const archiveKey = new kms.Key(this, "ArchiveKey", {
      alias: "alias/metro-trailer-docuseal-archive",
      enableKeyRotation: true,
      description: "KMS key for immutable DocuSeal lease evidence archives.",
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const archiveBucket = new s3.Bucket(this, "ArchiveBucket", {
      bucketName: `metro-trailer-docuseal-archive-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: archiveKey,
      enforceSSL: true,
      objectLockDefaultRetention: s3.ObjectLockRetention.governance(Duration.days(365 * 7)),
      objectLockEnabled: true,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
      lifecycleRules: [
        {
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: Duration.days(365),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: Duration.days(365 * 3),
            },
          ],
        },
      ],
    });

    const trailBucket = new s3.Bucket(this, "TrailBucket", {
      bucketName: `metro-trailer-docuseal-archive-trail-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectLockDefaultRetention: s3.ObjectLockRetention.governance(Duration.days(365 * 7)),
      objectLockEnabled: true,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
    });

    const writerRole = new iam.Role(this, "WriterRole", {
      roleName: "metro-trailer-lease-archive-writer",
      assumedBy: new iam.AccountPrincipal(this.account),
      description: "Write-only role for completed DocuSeal lease archive objects.",
    });
    archiveBucket.grantPut(writerRole);
    archiveKey.grantEncrypt(writerRole);
    writerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObjectRetention", "s3:PutObjectTagging"],
        resources: [archiveBucket.arnForObjects("*")],
      }),
    );

    const readerRole = new iam.Role(this, "ReaderRole", {
      roleName: "metro-trailer-lease-archive-reader",
      assumedBy: new iam.AccountPrincipal(this.account),
      description: "Read-only role for completed DocuSeal lease archive objects.",
    });
    archiveBucket.grantRead(readerRole);
    archiveKey.grantDecrypt(readerRole);

    const adminRole = new iam.Role(this, "AdminRole", {
      roleName: "metro-trailer-lease-archive-breakglass-admin",
      assumedBy: new iam.AccountPrincipal(this.account),
      description: "Break-glass administration role for the DocuSeal lease archive.",
    });
    archiveBucket.grantReadWrite(adminRole);
    archiveKey.grantEncryptDecrypt(adminRole);

    archiveBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DenyPublicObjectAcls",
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:PutObjectAcl"],
        resources: [archiveBucket.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "s3:x-amz-acl": ["public-read", "public-read-write", "authenticated-read"],
          },
        },
      }),
    );
    archiveBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DenyRetentionShorterThanSevenYears",
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:PutObject", "s3:PutObjectRetention"],
        resources: [archiveBucket.arnForObjects("*")],
        conditions: {
          NumericLessThanIfExists: {
            "s3:object-lock-remaining-retention-days": 365 * 7,
          },
        },
      }),
    );
    archiveBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DenyGovernanceBypassExceptBreakglass",
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:BypassGovernanceRetention"],
        resources: [archiveBucket.arnForObjects("*")],
        conditions: {
          StringNotLike: {
            "aws:PrincipalArn": adminRole.roleArn,
          },
        },
      }),
    );

    const trail = new cloudtrail.Trail(this, "ArchiveDataEventsTrail", {
      trailName: "metro-trailer-docuseal-archive-data-events",
      bucket: trailBucket,
      sendToCloudWatchLogs: true,
      cloudWatchLogsRetention: logs.RetentionDays.ONE_YEAR,
    });
    trail.addS3EventSelector(
      [
        {
          bucket: archiveBucket,
        },
      ],
      {
        readWriteType: cloudtrail.ReadWriteType.ALL,
      },
    );

    new cdk.CfnOutput(this, "ArchiveBucketName", {
      value: archiveBucket.bucketName,
    });
    new cdk.CfnOutput(this, "ArchiveKmsKeyArn", {
      value: archiveKey.keyArn,
    });
    new cdk.CfnOutput(this, "ArchiveTrailBucketName", {
      value: trailBucket.bucketName,
    });
    new cdk.CfnOutput(this, "ArchiveWriterRoleArn", {
      value: writerRole.roleArn,
    });
    new cdk.CfnOutput(this, "ArchiveReaderRoleArn", {
      value: readerRole.roleArn,
    });
  }
}
