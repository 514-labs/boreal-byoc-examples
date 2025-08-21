import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ClickhouseArgs } from "./types";

interface HelmReleaseArgs {
  args: ClickhouseArgs;
  password: pulumi.Output<string>;
  namespace: string;
  s3ConfigMapName?: pulumi.Output<string>;
  serviceAccountName?: pulumi.Output<string>;
  dependencies?: pulumi.Resource[];
}

/**
 * Creates the ClickHouse Helm release
 *
 * @param helmArgs - Configuration for the Helm release
 * @returns ClickHouse Helm release
 */
export function createHelmRelease(helmArgs: HelmReleaseArgs): k8s.helm.v3.Release {
  const {
    args,
    password,
    namespace,
    s3ConfigMapName,
    serviceAccountName,
    dependencies = [],
  } = helmArgs;

  return new k8s.helm.v3.Release(
    "clickhouse",
    {
      repositoryOpts: {
        repo: "https://charts.bitnami.com/bitnami",
      },
      chart: "clickhouse",
      version: "9.4.0",
      namespace: namespace,
      createNamespace: true,
      values: {
        fullnameOverride: "clickhouse",
        auth: {
          username: "default",
          password: password,
        },
        shards: args.clickhouseShards,
        replicaCount: args.clickhouseReplicas,

        // Reference the S3 configuration if provided
        ...(s3ConfigMapName && {
          existingConfigdConfigmap: s3ConfigMapName,
        }),

        // Service configuration
        service: {
          type: "ClusterIP",
          ports: {
            http: 8123,
            tcp: 9000,
            mysql: 9004,
          },
        },

        // Persistence configuration
        persistence: {
          // Enable persistence when using S3 for metadata and hot data
          enabled: args.s3Config ? true : false,
          size: args.clickhouseStorageSize,
          storageClass: args.s3Config ? "gp3" : undefined, // Use gp3 for better performance with S3
        },

        keeper: {
          enabled: true,
          persistence: {
            // Enable keeper persistence when using S3
            enabled: args.s3Config ? true : false,
            size: "10Gi",
            storageClass: args.s3Config ? "gp3" : undefined,
          },
        },

        // Extra volumes for S3 cache when S3 is enabled
        ...(args.s3Config && {
          extraVolumes: [
            {
              name: "s3-cache",
              emptyDir: {
                sizeLimit: "20Gi",
              },
            },
            {
              name: "s3-metadata",
              emptyDir: {
                sizeLimit: "5Gi",
              },
            },
          ],
          extraVolumeMounts: [
            {
              name: "s3-cache",
              mountPath: "/bitnami/clickhouse/disks/s3_cache",
            },
            {
              name: "s3-cache",
              mountPath: "/bitnami/clickhouse/disks/s3_cache_replica",
            },
            {
              name: "s3-metadata",
              mountPath: "/bitnami/clickhouse/disks/s3_disk",
            },
          ],
        }),

        // Service account configuration
        ...(serviceAccountName && {
          serviceAccount: {
            create: false,
            name: serviceAccountName,
          },
        }),

        // Resource limits
        resources: {
          requests: {
            memory: args.requestedMemory,
            cpu: args.requestedCpu,
          },
          limits: {
            memory: args.requestedMemory,
            cpu: args.requestedCpu,
          },
        },

        // Additional ClickHouse configuration
        logLevel: "information",

        // Metrics configuration
        metrics: {
          enabled: true,
          serviceMonitor: {
            enabled: false, // Enable if using Prometheus Operator
          },
        },
      },
    },
    {
      ...args.releaseOpts,
      dependsOn: [...dependencies],
    }
  );
}
