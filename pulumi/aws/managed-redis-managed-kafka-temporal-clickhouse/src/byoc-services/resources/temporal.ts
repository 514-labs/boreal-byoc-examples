import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface TemporalArgs {
  serverReplicas: number;
  cassandraReplicas: number;
  namespaceRetention: number;
  elasticsearchReplicas: number;
  cassandraStorageSize: string;
  elasticsearchStorageSize: string;
  // Resource specifications
  cassandraMemory?: string;
  cassandraCpu?: string;
  serverMemory?: string;
  serverCpu?: string;
  releaseOpts: pulumi.CustomResourceOptions;
}

/**
 * Installs the Temporal workflow engine via Helm chart with Cassandra
 * and Elasticsearch backends.
 *
 * Deploys into the `byoc-temporal` namespace and creates a Kubernetes
 * secret with connection details in `boreal-system`.
 *
 * @param args - Temporal configuration: server/Cassandra/Elasticsearch replica
 *   counts and storage sizes, optional resource requests, namespace retention
 *   period, and Pulumi resource options for the Helm release.
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
                  retention: `${args.namespaceRetention}d`,
                },
              ],
            },
          },
          resources: {
            requests: {
              cpu: args.serverCpu || "500m",
              memory: args.serverMemory || "512Mi",
            },
            limits: {
              cpu: args.serverCpu || "500m",
              memory: args.serverMemory || "512Mi",
            },
          },
          frontend: {
            affinity: temporalComponentAntiAffinity("frontend"),
            podDisruptionBudget: { maxUnavailable: 1 },
          },
          history: {
            affinity: temporalComponentAntiAffinity("history"),
            podDisruptionBudget: { maxUnavailable: 1 },
          },
          matching: {
            affinity: temporalComponentAntiAffinity("matching"),
            podDisruptionBudget: { maxUnavailable: 1 },
          },
          worker: {
            affinity: temporalComponentAntiAffinity("worker"),
            podDisruptionBudget: { maxUnavailable: 1 },
          },
        },
        cassandra: {
          persistence: {
            enabled: true,
            storageClass: "gp3",
            size: args.cassandraStorageSize,
          },
          config: {
            cluster_size: args.cassandraReplicas,
          },
          affinity: {
            podAntiAffinity: softAffinity({ app: "temporal-cassandra" }),
            // The ES subchart constructs its own affinity block from
            // `antiAffinity`/`nodeAffinity` values only, so the cross-service
            // attraction is expressed here on the Cassandra side.
            podAffinity: softAffinity({ app: "elasticsearch-master" }, 50),
          },
          resources: {
            requests: {
              cpu: args.cassandraCpu || "1000m",
              memory: args.cassandraMemory || "2Gi",
            },
            limits: {
              cpu: args.cassandraCpu || "1000m",
              memory: args.cassandraMemory || "2Gi",
            },
          },
        },
        elasticsearch: {
          enabled: true,
          replicas: args.elasticsearchReplicas,
          antiAffinity: "soft",
          maxUnavailable: 1,
          persistence: {
            enabled: true,
            labels: {
              enabled: true,
            },
          },
          volumeClaimTemplate: {
            accessModes: ["ReadWriteOnce"],
            storageClassName: "gp3",
            resources: {
              requests: {
                storage: args.elasticsearchStorageSize,
              },
            },
          },
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

  // The incubator/cassandra subchart templates PDBs with the removed
  // policy/v1beta1 API, so we create one directly with policy/v1.
  const cassandraPdb = new k8s.policy.v1.PodDisruptionBudget(
    "temporal-cassandra-pdb",
    {
      metadata: {
        name: "temporal-cassandra-pdb",
        namespace: "byoc-temporal",
      },
      spec: {
        maxUnavailable: 1,
        selector: {
          matchLabels: {
            app: "temporal-cassandra",
          },
        },
      },
    },
    {
      ...args.releaseOpts,
      dependsOn: [temporal],
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
        host: "temporal-frontend.byoc-temporal.svc.cluster.local", // the port is added by the application
      },
    },
    {
      ...args.releaseOpts,
    }
  );
}

function softAffinity(labels: Record<string, string>, weight = 100) {
  return {
    preferredDuringSchedulingIgnoredDuringExecution: [
      {
        weight,
        podAffinityTerm: {
          labelSelector: {
            matchExpressions: Object.entries(labels).map(([key, value]) => ({
              key,
              operator: "In",
              values: [value],
            })),
          },
          topologyKey: "kubernetes.io/hostname",
        },
      },
    ],
  };
}

function temporalComponentAntiAffinity(component: string) {
  return {
    podAntiAffinity: softAffinity({
      "app.kubernetes.io/name": "temporal",
      "app.kubernetes.io/component": component,
    }),
    podAffinity: softAffinity(
      {
        "app.kubernetes.io/name": "temporal",
      },
      50
    ),
  };
}
