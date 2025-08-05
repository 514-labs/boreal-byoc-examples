import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import * as k8s from "@pulumi/kubernetes";

interface KafkaArgs {
  vpc: aws.ec2.Vpc;
  privateSubnetIds: pulumi.Input<string>[];
  k8sProvider: k8s.Provider;
  eksSecurityGroupId: pulumi.Input<string>;
  commonTags: aws.Tags;
  kafkaInstanceType: string;
  kafkaEbsVolumeSize: number;
  kafkaNumberOfBrokerNodes: number;
}

/**
 * Creates AWS MSK (Managed Streaming for Apache Kafka) cluster
 *
 * @param args - The configuration arguments
 * @returns MSK cluster and configuration
 */
export async function createMSKCluster(args: KafkaArgs) {
  // Create security group
  const mskSecurityGroup = createMSKSecurityGroup(
    args.vpc,
    args.eksSecurityGroupId,
    args.commonTags
  );

  // Create MSK configuration
  const mskConfiguration = createMSKConfiguration();

  // Create MSK cluster
  const mskCluster = createMSKClusterResource(
    mskSecurityGroup,
    mskConfiguration,
    args.privateSubnetIds,
    args.kafkaInstanceType,
    args.kafkaEbsVolumeSize,
    args.kafkaNumberOfBrokerNodes,
    args.commonTags
  );

  // Create authentication secret
  const { secret: kafkaSecret, secretVersion: kafkaSecretVersion, password: kafkaPassword } = createMSKAuthSecret(
    args.commonTags
  );

  // Associate secret with cluster
  const kafkaSecretAssociation = createMSKSecretAssociation(
    mskCluster,
    kafkaSecret,
    kafkaSecretVersion
  );

  // Get bootstrap brokers
  const bootstrapBrokersSaslScram = pulumi.interpolate`${mskCluster.bootstrapBrokersSaslScram}`;

  // Create Kubernetes secret
  const kafkaConfigSecret = createKafkaConfigSecret(
    args.k8sProvider,
    kafkaPassword,
    bootstrapBrokersSaslScram
  );

  return {
    mskCluster,
    bootstrapBrokers: bootstrapBrokersSaslScram,
    kafkaConfigSecret,
    securityGroup: mskSecurityGroup,
  };
}

/**
 * Creates a security group for MSK cluster
 */
function createMSKSecurityGroup(
  vpc: aws.ec2.Vpc,
  eksSecurityGroupId: pulumi.Input<string>,
  commonTags: aws.Tags
): aws.ec2.SecurityGroup {
  return new aws.ec2.SecurityGroup("msk-security-group", {
    name: "msk-security-group",
    description: "Security group for MSK cluster",
    vpcId: vpc.id,
    ingress: [
      {
        description: "Allow Kafka from EKS",
        fromPort: 9092,
        toPort: 9092,
        protocol: "tcp",
        securityGroups: [eksSecurityGroupId],
      },
      {
        description: "Allow Kafka SASL from EKS",
        fromPort: 9094,
        toPort: 9094,
        protocol: "tcp",
        securityGroups: [eksSecurityGroupId],
      },
      {
        description: "Allow Kafka SASL_SSL from EKS",
        fromPort: 9096,
        toPort: 9096,
        protocol: "tcp",
        securityGroups: [eksSecurityGroupId],
      },
      {
        description: "Allow Zookeeper from EKS",
        fromPort: 2181,
        toPort: 2181,
        protocol: "tcp",
        securityGroups: [eksSecurityGroupId],
      },
    ],
    egress: [
      {
        description: "Allow all outbound",
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    tags: {
      Name: "msk-security-group",
      ...commonTags,
    },
  });
}

/**
 * Creates a secret for SASL/SCRAM authentication
 */
function createMSKAuthSecret(commonTags: aws.Tags): {
  secret: aws.secretsmanager.Secret;
  secretVersion: aws.secretsmanager.SecretVersion;
  password: pulumi.Output<string>;
  kmsKey: aws.kms.Key;
} {
  // Create a custom KMS key for MSK secret encryption
  const mskKmsKey = new aws.kms.Key("msk-secret-kms-key", {
    description: "KMS key for MSK SASL/SCRAM authentication secret",
    tags: commonTags,
  });

  // Create an alias for the KMS key
  new aws.kms.Alias("msk-secret-kms-key-alias", {
    name: "alias/msk-sasl-scram-key",
    targetKeyId: mskKmsKey.id,
  });

  const kafkaSecret = new aws.secretsmanager.Secret("msk-auth-secret", {
    namePrefix: "AmazonMSK_boreal-byoc-msk-auth-secret",
    description: "MSK SASL/SCRAM authentication secret",
    kmsKeyId: mskKmsKey.id,
    tags: commonTags,
  });

  const password = new random.RandomPassword("kafka-password", {
    length: 16,
    special: false,
  });

  const kafkaSecretVersion = new aws.secretsmanager.SecretVersion("msk-auth-secret-version", {
    secretId: kafkaSecret.id,
    secretString: password.result.apply(pwd => JSON.stringify({
      username: "moose",
      password: pwd,
    })),
  });

  return { secret: kafkaSecret, secretVersion: kafkaSecretVersion, password: password.result, kmsKey: mskKmsKey };
}

/**
 * Creates MSK configuration with Kafka settings
 */
function createMSKConfiguration(): aws.msk.Configuration {
  return new aws.msk.Configuration("msk-config", {
    name: "boreal-msk-config",
    serverProperties: `
auto.create.topics.enable=true
default.replication.factor=3
min.insync.replicas=2
num.partitions=8
offsets.topic.replication.factor=3
transaction.state.log.replication.factor=3
transaction.state.log.min.isr=2
log.retention.hours=168
compression.type=snappy
    `,
    kafkaVersions: ["3.6.0"],
    description: "MSK configuration for Boreal BYOC",
  });
}

/**
 * Creates the MSK cluster
 */
function createMSKClusterResource(
  securityGroup: aws.ec2.SecurityGroup,
  configuration: aws.msk.Configuration,
  privateSubnetIds: pulumi.Input<string>[],
  kafkaInstanceType: string,
  kafkaEbsVolumeSize: number,
  kafkaNumberOfBrokerNodes: number,
  commonTags: aws.Tags
): aws.msk.Cluster {
  const logGroup = new aws.cloudwatch.LogGroup("boreal-byoc-msk-log-group", {
    name: "boreal-byoc-msk-log-group",
    retentionInDays: 30,
    tags: commonTags,
  });

  return new aws.msk.Cluster("msk-cluster", {
    clusterName: "boreal-byoc-msk-cluster",
    kafkaVersion: "3.6.0",
    numberOfBrokerNodes: kafkaNumberOfBrokerNodes,

    brokerNodeGroupInfo: {
      instanceType: kafkaInstanceType,
      clientSubnets: privateSubnetIds,
      securityGroups: [securityGroup.id],

      storageInfo: {
        ebsStorageInfo: {
          volumeSize: kafkaEbsVolumeSize,
          provisionedThroughput: {
            enabled: false,
          },
        },
      },
    },

    clientAuthentication: {
      sasl: {
        scram: true,
      },
      unauthenticated: false,
    },

    encryptionInfo: {
      encryptionInTransit: {
        clientBroker: "TLS",
        inCluster: true,
      },
    },

    configurationInfo: {
      arn: configuration.arn,
      revision: configuration.latestRevision,
    },

    loggingInfo: {
      brokerLogs: {
        cloudwatchLogs: {
          enabled: true,
          logGroup: logGroup.name,
        },
      },
    },

    tags: {
      Name: "boreal-byoc-msk-cluster",
      ...commonTags,
    },
  });
}

/**
 * Associates the SASL/SCRAM secret with the MSK cluster
 */
function createMSKSecretAssociation(
  mskCluster: aws.msk.Cluster,
  kafkaSecret: aws.secretsmanager.Secret,
  kafkaSecretVersion: aws.secretsmanager.SecretVersion
): aws.msk.ScramSecretAssociation {
  return new aws.msk.ScramSecretAssociation(
    "msk-secret-association",
    {
      clusterArn: mskCluster.arn,
      secretArnLists: [kafkaSecret.arn],
    },
    {
      dependsOn: [mskCluster, kafkaSecretVersion],
    }
  );
}

/**
 * Creates a Kubernetes secret with Kafka configuration
 */
function createKafkaConfigSecret(
  k8sProvider: k8s.Provider,
  kafkaPassword: pulumi.Output<string>,
  bootstrapBrokersSaslScram: pulumi.Output<string>
): k8s.core.v1.Secret {
  return new k8s.core.v1.Secret(
    "sn-mds-redpanda-config",
    {
      metadata: {
        name: "sn-mds-redpanda-config",
        namespace: "boreal-system",
      },
      stringData: {
        "uses-cloud-service": "false",
        /// Cloud Service Configuration
        "auth-url": "", // Not needed for MSK
        "client-id": "", // Not needed for MSK
        "client-secret": "", // Not needed for MSK
        "cluster-api-url": "", // Not needed for MSK

        /// Service Configuration
        broker: bootstrapBrokersSaslScram,
        "sasl-mechanism": "SCRAM-SHA-512",
        "replication-factor": "3",
        "message-timeout-ms": "30000",
        "security-protocol": "SASL_SSL",

        /// Non-Cloud Service Configuration
        "sasl-admin-username": "moose",
        "sasl-admin-password": kafkaPassword,
      },
    },
    {
      provider: k8sProvider,
    }
  );
}
