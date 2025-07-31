import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Installs Temporal
 *
 * @param releaseOpts - The release options
 * @returns The Temporal resource
 */
export async function installTemporal(releaseOpts: pulumi.CustomResourceOptions) {
  const temporal = new k8s.helm.v3.Release(
    "temporal",
    {
      repositoryOpts: {
        repo: "https://go.temporal.io/helm-charts",
      },
      chart: "temporal",
      version: "0.64.0",
      namespace: "byoc-temporal",
      createNamespace: true,
      values: {
        server: {
          replicaCount: 1,
        },
        cassandra: {
          config: {
            cluster_size: 1,
          },
        },
        elasticsearch: {
          replicas: 1,
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
        ...releaseOpts,
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
        "api-key": "", // Not needed for self-hosted Temporal
        "namespace-region": "default", // Default region for self-hosted Temporal
        "namespace-retention-days": "30", // Default retention period in days
      },
    },
    {
      ...releaseOpts,
    }
  );
}
