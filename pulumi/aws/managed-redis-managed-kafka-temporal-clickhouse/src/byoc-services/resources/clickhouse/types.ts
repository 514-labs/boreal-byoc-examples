import * as pulumi from "@pulumi/pulumi";
import { ClickhouseS3Config } from "./s3-config-map";
import { EksClusterInfo } from "./service-account";

export interface ClickhouseArgs {
  clickhouseReplicas: number;
  clickhouseShards: number;
  clickhouseStorageSize: string;
  requestedMemory: string;
  requestedCpu: string;
  releaseOpts: pulumi.CustomResourceOptions;
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
  helmRelease: pulumi.Output<any>;
  password: pulumi.Output<string>;
  mdsConfigSecret: pulumi.Output<any>;
  s3ConfigMap?: pulumi.Output<any>;
  serviceAccount?: pulumi.Output<any>;
  iamRole?: pulumi.Output<any>;
  s3Bucket?: pulumi.Output<any>;
}
