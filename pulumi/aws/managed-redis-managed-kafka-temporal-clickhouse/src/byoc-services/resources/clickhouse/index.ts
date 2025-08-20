import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import * as random from "@pulumi/random";
import { ClickhouseArgs, ClickhouseDeploymentResult } from "./types";
import { createS3ConfigMap } from "./s3-config-map";
import { ServiceAccountManager } from "./service-account";
import { createMdsConfigSecret } from "./mds-secret";
import { createHelmRelease } from "./helm-release";
import { createS3Bucket } from "./s3-bucket";

/**
 * Installs ClickHouse with optional S3 storage support
 *
 * When S3 is configured, ClickHouse can use either:
 * 1. IAM roles (recommended for EKS) - Uses IRSA for secure, temporary credentials
 * 2. Access keys - Traditional method, less secure
 *
 * @param args - ClickHouse deployment configuration
 * @returns Deployment result with all created resources
 */
export async function installClickhouse(args: ClickhouseArgs): Promise<ClickhouseDeploymentResult> {
  const namespace = "byoc-clickhouse";

  // Generate secure password
  const password = new random.RandomPassword("clickhouse-password", {
    length: 16,
    special: false,
  });

  const dependencies: pulumi.Resource[] = [];
  let s3ConfigMap: k8s.core.v1.ConfigMap | undefined;
  let serviceAccount: k8s.core.v1.ServiceAccount | undefined;
  let iamRole: aws.iam.Role | undefined;
  let s3Bucket: aws.s3.Bucket | undefined;

  // Create S3 configuration if provided
  if (args.s3Config) {
    // Create the S3 bucket
    s3Bucket = createS3Bucket(
      args.s3Config.bucketName,
      args.tags || {},
      {},
      {
        glacierIrTransitionDays: args.s3Lifecycle?.glacierIrTransitionDays,
        noncurrentExpireDays: args.s3Lifecycle?.noncurrentExpireDays,
      }
    );
    dependencies.push(s3Bucket);

    s3ConfigMap = createS3ConfigMap(args.s3Config, namespace, {});
    dependencies.push(s3ConfigMap);
  }

  // Create service account using the ServiceAccountManager
  const serviceAccountManager = new ServiceAccountManager(namespace, {});
  const serviceAccountResult = serviceAccountManager.create({
    namespace,
    s3Config: args.s3Config,
    eksClusterInfo: args.eksClusterInfo,
    s3BucketArn: s3Bucket?.arn,
    releaseOpts: args.releaseOpts,
  });

  serviceAccount = serviceAccountResult.serviceAccount;
  iamRole = serviceAccountResult.iamRole;
  
  // Add created resources to dependencies
  dependencies.push(serviceAccount);
  if (iamRole) {
    dependencies.push(iamRole);
  }

  // Create MDS configuration secret
  const mdsConfigSecret = createMdsConfigSecret(
    password.result,
    "boreal-system", // Target namespace for MDS
    args.releaseOpts
  );

  // Create Helm release
  const helmRelease = createHelmRelease({
    args,
    password: password.result,
    namespace,
    s3ConfigMapName: s3ConfigMap?.metadata.name,
    serviceAccountName: serviceAccount?.metadata.name,
    dependencies,
  });

  return {
    helmRelease: pulumi.output(helmRelease),
    password: password.result,
    mdsConfigSecret: pulumi.output(mdsConfigSecret),
    s3ConfigMap: s3ConfigMap ? pulumi.output(s3ConfigMap) : undefined,
    serviceAccount: serviceAccount ? pulumi.output(serviceAccount) : undefined,
    iamRole: iamRole ? pulumi.output(iamRole) : undefined,
    s3Bucket: s3Bucket ? pulumi.output(s3Bucket) : undefined,
  };
}

// Re-export types for convenience
export * from "./types";
export { ClickhouseS3Config } from "./s3-config-map";
export { EksClusterInfo } from "./service-account";
