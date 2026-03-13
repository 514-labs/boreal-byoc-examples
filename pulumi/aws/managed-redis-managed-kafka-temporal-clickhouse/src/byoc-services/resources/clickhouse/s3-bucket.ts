import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface S3BucketResult {
  bucket: aws.s3.Bucket;
  kmsKey?: aws.kms.Key;
}

/**
 * Creates an S3 bucket for ClickHouse data storage
 *
 * Note: S3 bucket names must be globally unique across all AWS accounts.
 * Bucket names must be 3-63 characters, lowercase, and can contain hyphens.
 *
 * @param bucketName - Name of the S3 bucket (can be a Pulumi Output for dynamic names)
 * @param tags - Tags to apply to the bucket
 * @param releaseOpts - Pulumi resource options
 * @returns S3 bucket and optional KMS key
 */
export function createS3Bucket(
  bucketName: pulumi.Input<string>,
  tags: Record<string, string>,
  releaseOpts: pulumi.CustomResourceOptions,
  opts?: {
    glacierIrTransitionDays?: number; // days to move to GLACIER_IR; recommend 365 for 1-year hot access
    noncurrentExpireDays?: number; // days to expire noncurrent versions; must be > transition days
    useKmsEncryption?: boolean; // Use customer-managed KMS key (default: false, use AES256)
  }
): S3BucketResult {
  const useKms = opts?.useKmsEncryption ?? false;

  // Create KMS key for S3 bucket encryption (if enabled)
  let kmsKey: aws.kms.Key | undefined;
  if (useKms) {
    kmsKey = new aws.kms.Key(
      "clickhouse-s3-kms-key",
      {
        description: "KMS key for ClickHouse S3 bucket encryption",
        enableKeyRotation: true,
        tags: {
          ...tags,
          Purpose: "ClickHouse-S3-Encryption",
        },
      },
      releaseOpts
    );

    // Create KMS key alias for easier identification
    new aws.kms.Alias(
      "clickhouse-s3-kms-alias",
      {
        name: pulumi.interpolate`alias/clickhouse-s3-${bucketName}`,
        targetKeyId: kmsKey.keyId,
      },
      { ...releaseOpts, parent: kmsKey }
    );
  }

  // Create the S3 bucket with encryption
  const bucket = new aws.s3.Bucket(
    "clickhouse-data-bucket",
    {
      bucket: bucketName,
      versioning: {
        enabled: true,
      },
      serverSideEncryptionConfiguration: {
        rule: kmsKey
          ? {
              applyServerSideEncryptionByDefault: {
                sseAlgorithm: "aws:kms",
                kmsMasterKeyId: kmsKey.arn,
              },
              bucketKeyEnabled: true, // Use S3 Bucket Keys to reduce KMS costs
            }
          : {
              applyServerSideEncryptionByDefault: {
                sseAlgorithm: "AES256", // S3-managed encryption as fallback
              },
            },
      },
      lifecycleRules: [
        {
          enabled: true,
          id: "delete-incomplete-multipart-uploads",
          abortIncompleteMultipartUploadDays: 7,
        },
        {
          enabled: true,
          id: "transition-clickhouse-objects",
          prefix: "clickhouse/",
          transitions: [
            {
              days: opts?.glacierIrTransitionDays ?? 365,
              storageClass: "GLACIER_IR",
            },
          ],
          noncurrentVersionTransitions: [
            {
              days: opts?.glacierIrTransitionDays ?? 365,
              storageClass: "GLACIER_IR",
            },
          ],
          noncurrentVersionExpiration: {
            days: opts?.noncurrentExpireDays ?? 400,
          },
        },
      ],
      tags: {
        ...tags,
        Purpose: "ClickHouse-Data-Storage",
      },
    },
    releaseOpts
  );

  // Block all public access
  new aws.s3.BucketPublicAccessBlock(
    "clickhouse-bucket-pab",
    {
      bucket: bucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    },
    { ...releaseOpts, parent: bucket }
  );

  // Add bucket policy to enforce secure transport
  new aws.s3.BucketPolicy(
    "clickhouse-bucket-policy",
    {
      bucket: bucket.id,
      policy: bucket.id.apply((bucketName) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "DenyInsecureConnections",
              Effect: "Deny",
              Principal: "*",
              Action: "s3:*",
              Resource: [`arn:aws:s3:::${bucketName}/*`, `arn:aws:s3:::${bucketName}`],
              Condition: {
                Bool: {
                  "aws:SecureTransport": "false",
                },
              },
            },
          ],
        })
      ),
    },
    { ...releaseOpts, parent: bucket }
  );

  return {
    bucket,
    kmsKey,
  };
}
