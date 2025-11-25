import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import { createS3Bucket } from "./s3-bucket";
import { createS3ConfigMap, generateS3StorageXML } from "./s3-config-map";
import { ServiceAccountManager } from "./service-account";
import { createMdsConfigSecret } from "./mds-secret";
import { createClickHouseInstallation } from "./installation";
import { createClickHouseKeeper, getKeeperConnectionString } from "./keeper";
import { ClickhouseArgs, ClickhouseDeploymentResult } from "./types";

/**
 * Deploys a ClickHouse database cluster and supporting infrastructure.
 *
 * This function:
 * 1. Creates ClickHouse Keeper for coordination (if replicas > 1)
 * 2. Creates S3 bucket for data storage (if S3 config provided)
 * 3. Creates IAM role and service account for S3 access (if using IAM role)
 * 4. Creates ConfigMap with S3 storage configuration
 * 5. Creates MDS secret with ClickHouse credentials
 * 6. Deploys ClickHouse cluster via ClickHouseInstallation CRD
 *
 * Note: The Altinity ClickHouse Operator must be installed first.
 *
 * @param args - ClickHouse deployment arguments
 * @returns Deployment result with ClickHouse cluster and infrastructure resources
 */
export async function deployClickhouseDatabase(
  args: ClickhouseArgs
): Promise<ClickhouseDeploymentResult> {
  const namespace = "byoc-clickhouse";

  // Generate a password for ClickHouse
  const password = new random.RandomPassword("clickhouse-password", {
    length: 16,
    special: false,
  });

  // Deploy ClickHouse Keeper if replicas > 1 (required for replication)
  let keeper;
  let keeperConnectionString;
  if (args.clickhouseReplicas > 1) {
    // Use 3 Keeper nodes for HA (must be odd number)
    const keeperReplicas = 3;
    keeper = createClickHouseKeeper({
      name: "clickhouse-keeper",
      namespace: namespace,
      replicas: keeperReplicas,
      storageSize: "10Gi",
      storageClass: "gp3",
      resources: {
        requests: {
          cpu: "100m",
          memory: "256Mi",
        },
        limits: {
          cpu: "500m",
          memory: "512Mi",
        },
      },
      releaseOpts: args.releaseOpts,
    });

    keeperConnectionString = getKeeperConnectionString(
      "clickhouse-keeper",
      namespace,
      keeperReplicas
    );
  }

  // Create S3 bucket if S3 configuration is provided
  // Note: Don't pass releaseOpts here as it contains K8s provider
  let s3BucketResult;
  if (args.s3Config) {
    s3BucketResult = createS3Bucket(
      args.s3Config.bucketName,
      args.tags || {},
      {}, // Empty options - let AWS provider use default
      {
        ...args.s3Lifecycle,
        useKmsEncryption: true, // Enable KMS
      }
    );
  }

  // Create service account (with or without IAM role)
  const serviceAccountManager = new ServiceAccountManager(namespace, args.releaseOpts);

  const serviceAccountResult = serviceAccountManager.create({
    namespace: namespace,
    s3Config: args.s3Config,
    eksClusterInfo: args.eksClusterInfo,
    s3BucketArn: s3BucketResult?.bucket.arn,
    kmsKeyArn: s3BucketResult?.kmsKey?.arn,
    releaseOpts: args.releaseOpts,
  });

  // Generate S3 storage XML if S3 configuration is provided
  // We keep the ConfigMap for reference, but the actual config is inlined in the CHI
  let s3ConfigMap;
  let s3StorageXML;
  if (args.s3Config) {
    s3ConfigMap = createS3ConfigMap(args.s3Config, namespace, args.releaseOpts);
    s3StorageXML = generateS3StorageXML(args.s3Config);
  }

  // Create MDS config secret
  const mdsConfigSecret = createMdsConfigSecret(password.result, "boreal-system", args.releaseOpts);

  // Deploy ClickHouse cluster via ClickHouseInstallation CRD
  const clickhouseInstallation = createClickHouseInstallation({
    name: "clickhouse-cluster",
    namespace: namespace,
    shards: args.clickhouseShards,
    replicas: args.clickhouseReplicas,
    storageSize: args.clickhouseStorageSize,
    storageClass: "gp3",
    // Use latest LTS version. Check https://hub.docker.com/r/clickhouse/clickhouse-server/tags
    // LTS versions: 24.3, 24.8 (recommended for production)
    // Latest: 24.11+
    image: args.clickhouseImage || "clickhouse/clickhouse-server:25.8",
    resources: {
      requests: {
        cpu: args.requestedCpu,
        memory: args.requestedMemory,
      },
    },
    serviceAccountName: "clickhouse",
    enableS3: !!args.s3Config,
    s3StorageXML: s3StorageXML,
    password: password.result,
    zookeeperNodes: keeperConnectionString,
    releaseOpts: keeper ? { ...args.releaseOpts, dependsOn: [keeper] } : args.releaseOpts,
  });

  return {
    clickhouseInstallation,
    keeper,
    password: password.result,
    mdsConfigSecret,
    s3ConfigMap,
    serviceAccount: serviceAccountResult.serviceAccount,
    iamRole: serviceAccountResult.iamRole,
    s3Bucket: s3BucketResult?.bucket,
    kmsKey: s3BucketResult?.kmsKey,
  };
}
