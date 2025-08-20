import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { ClickhouseS3Config } from "./s3-config-map";

export interface EksClusterInfo {
  clusterName: string;
  oidcProviderArn: string;
}

export interface ServiceAccountConfig {
  namespace: string;
  s3Config?: ClickhouseS3Config;
  eksClusterInfo?: EksClusterInfo;
  s3BucketArn?: pulumi.Input<string>;
  releaseOpts: pulumi.CustomResourceOptions;
}

export interface ServiceAccountResult {
  serviceAccount: k8s.core.v1.ServiceAccount;
  iamRole?: aws.iam.Role;
}

/**
 * Manages the creation of Kubernetes service accounts for ClickHouse
 * with optional IAM role integration for S3 access
 */
export class ServiceAccountManager {
  private readonly namespace: string;
  private readonly releaseOpts: pulumi.CustomResourceOptions;

  constructor(namespace: string, releaseOpts: pulumi.CustomResourceOptions) {
    this.namespace = namespace;
    this.releaseOpts = releaseOpts;
  }

  /**
   * Creates the appropriate service account based on the configuration
   * 
   * @param config - Service account configuration
   * @returns Service account and optional IAM role
   */
  public create(config: ServiceAccountConfig): ServiceAccountResult {
    // If S3 is not configured, create a basic service account
    if (!config.s3Config) {
      return {
        serviceAccount: this.createBasicServiceAccount(),
      };
    }

    // If using IAM role for S3 access
    if (config.s3Config.useIAMRole) {
      if (!config.eksClusterInfo) {
        throw new Error("eksClusterInfo is required when using S3 with IAM role");
      }

      const { clusterName, oidcProviderArn } = config.eksClusterInfo;

      // Create new IAM role and service account
      const iamRole = this.createIamRole(config.s3Config, config.eksClusterInfo, config.s3BucketArn);
      return this.createServiceAccountWithRole(
        iamRole
      );
    }

    // Using access keys - just create a basic service account
    // The S3 credentials will be provided through the ConfigMap
    return {
      serviceAccount: this.createBasicServiceAccount(),
    };
  }

  private createIamRole(s3Config: ClickhouseS3Config, eksClusterInfo: { clusterName: string; oidcProviderArn: string }, s3BucketArn?: pulumi.Input<string>): aws.iam.Role {
    const { clusterName, oidcProviderArn } = eksClusterInfo;
    // Extract the OIDC provider URL from the ARN (everything after oidc-provider/)
    const oidcProviderUrl = oidcProviderArn.split("oidc-provider/")[1];
    console.log(`oidcProviderUrl: ${oidcProviderUrl}`);
    const iamRole = new aws.iam.Role("clickhouse-s3-role", {
      name: pulumi.interpolate`${clusterName}-clickhouse-s3-role`,
      assumeRolePolicy: pulumi.interpolate`{
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": {
            "Federated": "${oidcProviderArn}"
          },
          "Action": "sts:AssumeRoleWithWebIdentity",
          "Condition": {
            "StringEquals": {
              "${oidcProviderUrl}:sub": "system:serviceaccount:${this.namespace}:clickhouse",
              "${oidcProviderUrl}:aud": "sts.amazonaws.com"
            }
          }
        }]
      }`,
      tags: {
        "Purpose": "ClickHouse S3 Access",
        "ManagedBy": "Pulumi",
      },
    });

    const bucketArn = s3BucketArn || `arn:aws:s3:::${s3Config.bucketName}`;
    const s3Policy = new aws.iam.RolePolicy("clickhouse-s3-policy", {
      role: iamRole.name,
      policy: pulumi.interpolate`{
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Action": [
              "s3:GetObject",
              "s3:PutObject",
              "s3:DeleteObject",
              "s3:ListBucket",
              "s3:GetObjectVersion",
              "s3:DeleteObjectVersion",
              "s3:GetBucketLocation"
            ],
            "Resource": [
              "${bucketArn}/*",
              "${bucketArn}"
            ]
          },
          {
            "Effect": "Allow",
            "Action": [
              "s3:ListAllMyBuckets"
            ],
            "Resource": "*"
          }
        ]
      }`,
    }, { ...this.releaseOpts, parent: iamRole });

    return iamRole;
  } 

  /**
   * Creates a basic service account without IAM role
   */
  private createBasicServiceAccount(): k8s.core.v1.ServiceAccount {
    return new k8s.core.v1.ServiceAccount("clickhouse-sa", {
      metadata: {
        name: "clickhouse",
        namespace: this.namespace,
      },
    }, this.releaseOpts);
  }

  /**
   * Creates a new IAM role and service account for S3 access
   */
  private createServiceAccountWithRole(
    iamRole: aws.iam.Role,
  ): ServiceAccountResult {
    // Create the Kubernetes service account with IAM role annotation
    const serviceAccount = new k8s.core.v1.ServiceAccount("clickhouse-sa", {
      metadata: {
        name: "clickhouse",
        namespace: this.namespace,
        annotations: {
          "eks.amazonaws.com/role-arn": iamRole.arn,
          "eks.amazonaws.com/sts-regional-endpoints": "true",
        },
      },
    }, this.releaseOpts);

    return { serviceAccount, iamRole };
  }
}