import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface TemporalArgs {
  serverReplicas: number;
  cassandraReplicas: number;
  namespaceRetention: number;
  elasticsearchReplicas: number;
  cassandraStorageSize: string;
  elasticsearchStorageSize: string;
  releaseOpts: pulumi.CustomResourceOptions;
}

export async function installTemporal(args: TemporalArgs) {
  const temporal = new k8s.helm.v3.Release(
    "temporal",
    {
      repositoryOpts: {
        repo: "https://go.temporal.io/helm-charts",
      },
      chart: "temporal",
      version: "0.68.1",
      namespace: "byoc-temporal",
      createNamespace: true,
      values: {
        fullnameOverride: "temporal",
        server: {
          replicaCount: args.serverReplicas,
          config: {
            namespaces: {
              create: true,
              namespace: [{ name: "default", retention: `${args.namespaceRetention}d` }],
            },
          },
        },
        cassandra: {
          persistence: {
            enabled: true,
            storageClass: "boreal-managed-csi", // Premium_ZRS with customer-managed encryption
            size: args.cassandraStorageSize,
          },
          config: {
            cluster_size: args.cassandraReplicas,
          },
        },
        elasticsearch: {
          enabled: true,
          replicas: args.elasticsearchReplicas,
          persistence: {
            enabled: true,
            labels: { enabled: true },
          },
          volumeClaimTemplate: {
            accessModes: ["ReadWriteOnce"],
            storageClassName: "boreal-managed-csi", // Premium_ZRS with customer-managed encryption
            resources: { requests: { storage: args.elasticsearchStorageSize } },
          },
        },
        prometheus: { enabled: false },
        grafana: { enabled: false },
      },
    },
    { ...args.releaseOpts }
  );

  new k8s.core.v1.Secret(
    "sn-mds-temporal-config",
    {
      metadata: { name: "sn-mds-temporal-config", namespace: "boreal-system" },
      stringData: {
        "uses-cloud-service": "false",
        "api-key": "",
        "namespace-region": "default",
        "namespace-retention-days": args.namespaceRetention.toString(),
        host: "temporal-frontend.byoc-temporal.svc.cluster.local",
      },
    },
    { ...args.releaseOpts }
  );
}
