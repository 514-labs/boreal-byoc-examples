import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Installs Clickhouse
 *
 * @param releaseOpts - The release options
 * @returns The Clickhouse resource
 */
export async function installClickhouse(releaseOpts: pulumi.CustomResourceOptions) {
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
        auth: {
          username: "default",
          password: "default",
        },
        shards: 1,
        replicaCount: 1,
        // Keeper configuration (Zookeeper alternative)
        // keeper: {
        //   enabled: true,
        // },
        // Service configuration
        service: {
          type: "ClusterIP",
          ports: {
            http: 8123,
            tcp: 9000,
            mysql: 9004,
          },
        },
        persistence: {
          enabled: false
        },
        keeper: {
          persistence: {
            enabled: false
          },
        },
        // Resource limits
        // resources: {
        //   requests: {
        //     memory: "256Mi",
        //     cpu: "250m",
        //   },
        //   limits: {
        //     memory: "2Gi",
        //     cpu: "1000m",
        //   },
        // },
        // Persistence
        // persistence: {
        //   enabled: true,
        //   size: "8Gi",
        // },
      },
    },
    {
      ...releaseOpts,
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
        // For self-hosted ClickHouse, these cloud provider fields are not applicable
        "cloud-provider": "", // Empty for self-hosted
        "cloud-region": "", // Empty for self-hosted
        "org-id": "", // Empty for self-hosted
        "token-key": "", // Empty for self-hosted
        "token-secret": "", // Empty for self-hosted

        // Connection configuration
        "use-ssl": "true", // Set to "true" if you enable SSL
        "host-port": "clickhouse.byoc-clickhouse.svc.cluster.local:8443", // HTTP interface
        "native-port": "clickhouse.byoc-clickhouse.svc.cluster.local:9440", // Native TCP interface

        // Authentication credentials (add these if your app needs them)
        username: "default",
        password: "default",
      },
    },
    {
      ...releaseOpts,
    }
  );
}
