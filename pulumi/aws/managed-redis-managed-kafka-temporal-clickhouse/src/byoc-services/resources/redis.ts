import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import * as k8s from "@pulumi/kubernetes";

interface RedisArgs {
  vpc: aws.ec2.Vpc;
  privateSubnetIds: pulumi.Input<string>[];
  k8sProvider: k8s.Provider;
  eksSecurityGroupId: pulumi.Input<string>;
  commonTags: aws.Tags;
  redisNodeType: string;
  redisNumCacheNodes: number;
  redisPort: number;
  redisMaintenanceWindow: string;
  redisSnapshotWindow: string;
  redisSnapshotRetentionLimit: number;
  automaticFailoverEnabled: boolean;
}

/**
 * Creates AWS ElastiCache Redis cluster
 *
 * @param args - The configuration arguments
 * @returns ElastiCache Redis cluster and configuration
 */
export async function createElastiCacheRedis(args: RedisArgs) {
  // Create subnet group
  const redisSubnetGroup = createRedisSubnetGroup(args.privateSubnetIds, args.commonTags);

  // Create security group
  const redisSecurityGroup = createRedisSecurityGroup(
    args.vpc,
    args.eksSecurityGroupId,
    args.commonTags,
    args.redisPort
  );

  // Create parameter group
  const redisParameterGroup = createRedisParameterGroup(args.commonTags);

  // Create Redis cluster
  const { redisCluster, redisPassword } = createRedisReplicationGroup(
    redisSubnetGroup,
    redisSecurityGroup,
    redisParameterGroup,
    args.commonTags,
    args.redisNodeType,
    args.redisPort,
    args.redisNumCacheNodes,
    args.redisMaintenanceWindow,
    args.redisSnapshotWindow,
    args.redisSnapshotRetentionLimit,
    args.automaticFailoverEnabled
  );

  // Create Kubernetes secret
  const redisConfigSecret = createRedisConfigSecret(redisCluster, args.redisPort, args.k8sProvider, redisPassword);

  // Create endpoint string
  const redisEndpoint = pulumi.interpolate`${redisCluster.primaryEndpointAddress}:${redisCluster.port}`;

  return {
    redisCluster,
    primaryEndpoint: redisEndpoint,
    redisConfigSecret,
    securityGroup: redisSecurityGroup,
  };
}

/**
 * Creates a subnet group for ElastiCache Redis
 */
function createRedisSubnetGroup(
  privateSubnetIds: pulumi.Input<string>[],
  commonTags: aws.Tags
): aws.elasticache.SubnetGroup {
  return new aws.elasticache.SubnetGroup("redis-subnet-group", {
    name: "redis-subnet-group",
    subnetIds: privateSubnetIds,
    description: "Subnet group for ElastiCache Redis - Moose Cache",
    tags: {
      Name: "redis-subnet-group",
      ...commonTags,
    },
  });
}

/**
 * Creates a security group for ElastiCache Redis
 */
function createRedisSecurityGroup(
  vpc: aws.ec2.Vpc,
  eksSecurityGroupId: pulumi.Input<string>,
  commonTags: aws.Tags,
  redisPort: number
): aws.ec2.SecurityGroup {
  return new aws.ec2.SecurityGroup("redis-security-group", {
    name: "redis-security-group",
    description: "Security group for ElastiCache Redis - Moose Cache",
    vpcId: vpc.id,
    ingress: [
      {
        description: "Allow Redis from EKS",
        fromPort: redisPort,
        toPort: redisPort,
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
      Name: "redis-security-group",
      ...commonTags,
    },
  });
}

/**
 * Creates a parameter group for Redis 7.0
 */
function createRedisParameterGroup(commonTags: aws.Tags): aws.elasticache.ParameterGroup {
  return new aws.elasticache.ParameterGroup("redis-parameter-group", {
    name: "redis-parameter-group",
    family: "redis7",
    description: "Parameter group for Redis 7.0 - Moose Cache",
    parameters: [
      {
        name: "maxmemory-policy",
        value: "allkeys-lru",
      },
      {
        name: "timeout",
        value: "300",
      },
    ],
    tags: commonTags,
  });
}

/**
 * Creates the ElastiCache replication group (Redis cluster)
 */
function createRedisReplicationGroup(
  subnetGroup: aws.elasticache.SubnetGroup,
  securityGroup: aws.ec2.SecurityGroup,
  parameterGroup: aws.elasticache.ParameterGroup,
  commonTags: aws.Tags,
  redisNodeType: string,
  redisPort: number,
  redisNumCacheNodes: number,
  redisMaintenanceWindow: string,
  redisSnapshotWindow: string,
  redisSnapshotRetentionLimit: number,
  automaticFailoverEnabled: boolean
): {
  redisCluster: aws.elasticache.ReplicationGroup;
  redisPassword: pulumi.Output<string>;
} {
  const redisPassword = new random.RandomPassword("redis-password", {
    length: 16,
    special: false,
  });

  const redisCluster = new aws.elasticache.ReplicationGroup("redis-cluster", {
    replicationGroupId: "boreal-byoc-redis-cluster",
    description: "Redis cluster for Boreal BYOC",
    
    // Redis configuration
    engine: "redis",
    engineVersion: "7.0",
    nodeType: redisNodeType,
    parameterGroupName: parameterGroup.name,
    port: redisPort,
    
    // High availability configuration
    numCacheClusters: redisNumCacheNodes, // Primary + 1 replica
    automaticFailoverEnabled: automaticFailoverEnabled,
    multiAzEnabled: true,
    
    // Network configuration
    subnetGroupName: subnetGroup.name,
    securityGroupIds: [securityGroup.id],
    
    // Authentication
    transitEncryptionEnabled: true,
    atRestEncryptionEnabled: true,
    authToken: redisPassword.result, // Must be at least 16 chars for transit encryption
    
    // Maintenance and backup
    maintenanceWindow: redisMaintenanceWindow,
    snapshotWindow: redisSnapshotWindow,
    snapshotRetentionLimit: redisSnapshotRetentionLimit,
    
    // Notifications
    // notificationTopicArn: undefined, // Add SNS topic if needed
    
    tags: {
      Name: "boreal-byoc-redis-cluster",
      ...commonTags,
    },
  });

  return {
    redisCluster: redisCluster,
    redisPassword: redisPassword.result,
  };
}

/**
 * Creates a Kubernetes secret with Redis configuration
 */
function createRedisConfigSecret(
  redisCluster: aws.elasticache.ReplicationGroup,
  redisPort: number,
  k8sProvider: k8s.Provider,
  redisPassword: pulumi.Output<string>
): k8s.core.v1.Secret {
  return new k8s.core.v1.Secret(
    "sn-moose-cache-redis-config",
    {
      metadata: {
        name: "sn-moose-cache-redis-config",
        namespace: "boreal-system",
      },
      stringData: {
        "host": redisCluster.primaryEndpointAddress,
        "port": redisPort.toString(),
        "password": redisPassword,
        "url": pulumi.interpolate`rediss://default:${redisPassword}@${redisCluster.primaryEndpointAddress}:${redisPort}`,
        "ssl": "true",
      },
    },
    {
      provider: k8sProvider,
    }
  );
}
