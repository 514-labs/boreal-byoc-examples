import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

/**
 * Creates an S3 bucket for ClickHouse data storage
 * 
 * @param bucketName - Name of the S3 bucket
 * @param tags - Tags to apply to the bucket
 * @param releaseOpts - Pulumi resource options
 * @returns S3 bucket resource
 */
export function createS3Bucket(
  bucketName: string,
  tags: Record<string, string>,
  releaseOpts: pulumi.CustomResourceOptions,
  opts?: {
    glacierIrTransitionDays?: number; // days to move to GLACIER_IR; recommend 365 for 1-year hot access
    noncurrentExpireDays?: number; // days to expire noncurrent versions; must be > transition days
  }
): aws.s3.Bucket {
  // Create the S3 bucket
  const bucket = new aws.s3.Bucket("clickhouse-data-bucket", {
    bucket: bucketName,
    acl: "private",
    versioning: {
      enabled: true, // Enable versioning for data protection
    },
    serverSideEncryptionConfiguration: {
      rule: {
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: "AES256", // Use S3-managed encryption
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
          days: (opts?.noncurrentExpireDays ?? 400),
        },
      },
    ],
    tags: {
      ...tags,
      Purpose: "ClickHouse-Data-Storage",
    },
  }, releaseOpts);

  // Block all public access
  new aws.s3.BucketPublicAccessBlock("clickhouse-bucket-pab", {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  }, { ...releaseOpts, parent: bucket });

  // Add bucket policy to enforce secure transport
  new aws.s3.BucketPolicy("clickhouse-bucket-policy", {
    bucket: bucket.id,
    policy: bucket.id.apply(bucketName => JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Sid: "DenyInsecureConnections",
        Effect: "Deny",
        Principal: "*",
        Action: "s3:*",
        Resource: [
          `arn:aws:s3:::${bucketName}/*`,
          `arn:aws:s3:::${bucketName}`
        ],
        Condition: {
          Bool: {
            "aws:SecureTransport": "false"
          }
        }
      }]
    })),
  }, { ...releaseOpts, parent: bucket });

  return bucket;
}
