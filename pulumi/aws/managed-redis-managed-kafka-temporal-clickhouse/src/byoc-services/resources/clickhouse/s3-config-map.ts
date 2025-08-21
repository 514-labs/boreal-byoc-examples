import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface ClickhouseS3Config {
  bucketName: string;
  region?: string;
  // Authentication options - either use IAM role or access keys
  useIAMRole?: boolean;
  // If useIAMRole is true, these are optional
  accessKeyId?: pulumi.Input<string>;
  secretAccessKey?: pulumi.Input<string>;
  // Optional: existing IAM role ARN to use
  existingRoleArn?: string;
  // Size of local S3 cache in GB; will be converted to bytes in the rendered XML
  // Recommended starting point: 10 GB. Increase if queries frequently touch cold data.
  cacheSizeGB?: number;
  // Max part size that stays on hot (local) volume in GB; converted to bytes below
  // Recommended starting point: 1 GB. Increase if parts are large and you want them to remain hot longer.
  hotMaxPartSizeGB?: number;
  // Fraction of data to keep on hot storage before moving to cold. Range (0,1).
  // Recommended starting point: 0.2 (move when hot volume has ~20% new data).
  hotColdMoveFactor?: number;
}

/**
 * Creates a ConfigMap with ClickHouse S3 storage configuration
 *
 * @param s3Config - S3 configuration parameters
 * @param namespace - Kubernetes namespace
 * @param releaseOpts - Pulumi resource options
 * @returns ConfigMap containing S3 storage configuration
 */
export function createS3ConfigMap(
  s3Config: ClickhouseS3Config,
  namespace: string,
  releaseOpts: pulumi.CustomResourceOptions
): k8s.core.v1.ConfigMap {
  return new k8s.core.v1.ConfigMap(
    "clickhouse-s3-config",
    {
      metadata: {
        name: "clickhouse-s3-config",
        namespace: namespace,
      },
      data: {
        "storage.xml": pulumi.interpolate`<?xml version="1.0"?>
<clickhouse>
    <storage_configuration>
        <disks>
            <!-- Don't define default disk - let Bitnami chart handle it -->

            <!-- S3 disk for cold data -->
            <s3_disk>
                <type>s3</type>
                <endpoint>https://s3.${s3Config.region || "us-east-2"}.amazonaws.com/${s3Config.bucketName}/clickhouse/</endpoint>
                ${
                  s3Config.useIAMRole
                    ? `<!-- Using IAM role for authentication -->
                <use_environment_credentials>true</use_environment_credentials>`
                    : pulumi.interpolate`<!-- Using access keys for authentication -->
                <access_key_id>${s3Config.accessKeyId}</access_key_id>
                <secret_access_key>${s3Config.secretAccessKey}</secret_access_key>`
                }
                <metadata_path>/bitnami/clickhouse/disks/s3_disk/</metadata_path>
                <cache_enabled>true</cache_enabled>
                <cache_path>/bitnami/clickhouse/disks/s3_cache/</cache_path>
                <max_cache_size>${(s3Config.cacheSizeGB ?? 10) * 1024 * 1024 * 1024}</max_cache_size> <!-- cache size in bytes (from ${s3Config.cacheSizeGB ?? 10} GB) -->
                <skip_access_check>true</skip_access_check>
            </s3_disk>

            <!-- S3 disk with replica-specific paths -->
            <s3_disk_replica>
                <type>s3</type>
                <endpoint>https://s3.${s3Config.region || "us-east-2"}.amazonaws.com/${s3Config.bucketName}/clickhouse_replica/</endpoint>
                ${
                  s3Config.useIAMRole
                    ? `<use_environment_credentials>true</use_environment_credentials>`
                    : pulumi.interpolate`<access_key_id>${s3Config.accessKeyId}</access_key_id>
                <secret_access_key>${s3Config.secretAccessKey}</secret_access_key>`
                }
                <metadata_path>/bitnami/clickhouse/disks/s3_disk_replica/</metadata_path>
                <cache_enabled>true</cache_enabled>
                <cache_path>/bitnami/clickhouse/disks/s3_cache_replica/</cache_path>
                <max_cache_size>${(s3Config.cacheSizeGB ?? 10) * 1024 * 1024 * 1024}</max_cache_size>
                <skip_access_check>true</skip_access_check>
            </s3_disk_replica>
        </disks>

        <policies>
            <!-- Policy using only S3 -->
            <s3_only>
                <volumes>
                    <main>
                        <disk>s3_disk</disk>
                    </main>
                </volumes>
            </s3_only>

            <!-- Policy using S3 with replica-specific paths -->
            <s3_replicated>
                <volumes>
                    <main>
                        <disk>s3_disk_replica</disk>
                    </main>
                </volumes>
            </s3_replicated>

            <!-- Tiered storage policy (hot/cold) - enable default(local) + S3 -->
            <hot_cold>
                <volumes>
                    <hot>
                        <disk>default</disk>
                        <max_data_part_size_bytes>${(s3Config.hotMaxPartSizeGB ?? 1) * 1024 * 1024 * 1024}</max_data_part_size_bytes>
                    </hot>
                    <cold>
                        <disk>s3_disk</disk>
                    </cold>
                </volumes>
                <move_factor>${s3Config.hotColdMoveFactor ?? 0.2}</move_factor>
            </hot_cold>
        </policies>
    </storage_configuration>

    <!-- Macros for replica identification -->
    <!-- Note: The actual shard and replica values will be set by ClickHouse at runtime -->
    <macros>
        <cluster>clickhouse-cluster</cluster>
        <!-- shard and replica macros are set dynamically by ClickHouse -->
    </macros>
</clickhouse>`,
      },
    },
    releaseOpts
  );
}
