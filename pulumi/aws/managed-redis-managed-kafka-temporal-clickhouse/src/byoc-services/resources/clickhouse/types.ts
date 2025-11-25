import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { ClickhouseS3Config } from "./s3-config-map";
import { EksClusterInfo } from "./service-account";

export interface ClickhouseArgs {
  clickhouseReplicas: number;
  clickhouseShards: number;
  clickhouseStorageSize: string;
  requestedMemory: string;
  requestedCpu: string;
  releaseOpts: pulumi.CustomResourceOptions;
  // ClickHouse server image (optional, defaults to latest stable)
  clickhouseImage?: string;
  // S3 Configuration (optional)
  s3Config?: ClickhouseS3Config;
  // EKS cluster information (required if using S3 with IAM role)
  eksClusterInfo?: EksClusterInfo;
  // Tags to apply to AWS resources
  tags?: Record<string, string>;
  // Optional S3 lifecycle tuning
  s3Lifecycle?: {
    glacierIrTransitionDays?: number;
    noncurrentExpireDays?: number;
  };
}

export interface ClickhouseDeploymentResult {
  // ClickHouse cluster installation
  clickhouseInstallation: k8s.apiextensions.CustomResource;

  // ClickHouse Keeper (for HA replication coordination)
  keeper?: k8s.apiextensions.CustomResource;

  // Supporting infrastructure
  password: pulumi.Output<string>;
  mdsConfigSecret: k8s.core.v1.Secret;
  s3ConfigMap?: k8s.core.v1.ConfigMap;
  serviceAccount?: k8s.core.v1.ServiceAccount;
  iamRole?: aws.iam.Role;
  s3Bucket?: aws.s3.Bucket;
  kmsKey?: aws.kms.Key;
}
