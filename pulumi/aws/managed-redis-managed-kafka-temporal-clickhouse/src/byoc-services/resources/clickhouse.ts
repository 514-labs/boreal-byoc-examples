import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

export interface ClickhouseArgs {
  clickhouseReplicas: number;
  clickhouseShards: number;
  clickhouseStorageSize: string;
  requestedMemory: string;
  requestedCpu: string;
  releaseOpts: pulumi.CustomResourceOptions;
}

/**
 * Installs the Clickhouse Operator
 *
 * @param releaseOpts - The release options
 * @returns The Clickhouse Operator resource
 */
export async function installClickhouse(args: ClickhouseArgs) {
  const password = new random.RandomPassword("clickhouse-password", {
    length: 16,
    special: false,
  });

  const clickhouse = new k8s.helm.v3.Release(
    "clickhouse",
    {
      repositoryOpts: {
        repo: "https://charts.bitnami.com/bitnami",
      },
      chart: "clickhouse",
      version: "9.4.0",
      namespace: "byoc-clickhouse",
      createNamespace: true,
      values: {
        fullnameOverride: "clickhouse",
        auth: {
          username: "default",
          password: password.result,
        },
        shards: args.clickhouseShards,
        replicaCount: args.clickhouseReplicas,
        /// Service configuration
        service: {
          type: "ClusterIP",
          ports: {
            http: 8123,
            tcp: 9000,
            mysql: 9004,
          },
        },
        /// Persistence
        persistence: {
          enabled: false,
          size: args.clickhouseStorageSize,
        },
        keeper: {
          persistence: {
            enabled: false
          },
        },
        /// Resource limits
        resources: {
          requests: {
            memory: args.requestedMemory,
            cpu: args.requestedCpu,
          }
        },
      },
    },
    {
      ...args.releaseOpts,
    }
  );

  // Create the secret with ClickHouse configuration for the application
  const clickhouseConfigSecret = new k8s.core.v1.Secret(
    "sn-mds-clickhouse-config",
    {
      metadata: {
        name: "sn-mds-clickhouse-config",
        namespace: "boreal-system",
      },
      stringData: {
        "uses-cloud-service": "false",
        /// Cloud Service Host Configuration
        "cloud-provider": "", // Empty for self-hosted
        "cloud-region": "", // Empty for self-hosted
        "org-id": "", // Empty for self-hosted
        "token-key": "", // Empty for self-hosted
        "token-secret": "", // Empty for self-hosted

        // Connection configuration
        "use-ssl": "true", // Set to "true" if you enable SSL

        /// Non-Cloud Service Host Configuration
        "host": "clickhouse.byoc-clickhouse.svc.cluster.local",
        "host-http-port": "8123", // HTTP interface
        "native-port": "9000", // Native TCP interface
        "admin-username": "default",
        "admin-password": password.result,
      },
    },
    {
      ...args.releaseOpts,
    }
  );
}
