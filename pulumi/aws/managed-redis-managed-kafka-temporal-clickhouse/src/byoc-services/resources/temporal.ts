import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface TemporalArgs {
  serverReplicas: number;
  cassandraReplicas: number;
  namespaceRetention: number;
  elasticsearchReplicas: number;
  releaseOpts: pulumi.CustomResourceOptions;
}

/**
 * Installs the Clickhouse Operator
 *
 * @param releaseOpts - The release options
 * @returns The Clickhouse Operator resource
 */
export async function installTemporal(args: TemporalArgs) {
  const temporal = new k8s.helm.v3.Release(
    "temporal",
    {
      repositoryOpts: {
        repo: "https://go.temporal.io/helm-charts",
      },
      chart: "temporal",
      version: "0.65.0",
      namespace: "byoc-temporal",
      createNamespace: true,
      values: {
        fullnameOverride: "temporal",
        server: {
          replicaCount: args.serverReplicas,
          config: {
            namespaces: {
              create: true,
              namespace: [
                {
                  name: "default",
                  retention: args.namespaceRetention.toString(),
                },
              ],
            },
          },
        },
        cassandra: {
          config: {
            cluster_size: args.cassandraReplicas,
          },
        },
        elasticsearch: {
          replicas: args.elasticsearchReplicas,
        },
        prometheus: {
          enabled: false,
        },
        grafana: {
          enabled: false,
        },
      },
    },
    {
      ...args.releaseOpts,
    }
  );

  // Create the secret with Temporal configuration for the application
  const temporalConfigSecret = new k8s.core.v1.Secret(
    "sn-mds-temporal-config",
    {
      metadata: {
        name: "sn-mds-temporal-config",
        namespace: "boreal-system",
      },
      stringData: {
        "uses-cloud-service": "false",
        "api-key": "", // Not needed for self-hosted Temporal
        "namespace-region": "default", // Default region for self-hosted Temporal
        "namespace-retention-days": args.namespaceRetention.toString(), // Default retention period in days
        "host": "temporal-frontend.byoc-temporal.svc.cluster.local" // the port is added by the application
      },
    },
    {
      ...args.releaseOpts,
    }
  );
}
