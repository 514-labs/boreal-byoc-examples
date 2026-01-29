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
                  retention: `${args.namespaceRetention}d`,
                },
              ],
            },
          },
          // Enable Prometheus metrics endpoint
          metrics: {
            prometheus: {
              timerType: "histogram",
              listenAddress: "0.0.0.0:9090",
            },
          },
          // Add Datadog autodiscovery annotation for history (where workflow metrics are)
          history: {
            podAnnotations: {
              "ad.datadoghq.com/temporal-history.checks": JSON.stringify({
                openmetrics: {
                  init_config: {},
                  instances: [
                    {
                      openmetrics_endpoint: "http://%%host%%:9090/metrics",
                      namespace: "temporal",
                      metrics: [
                        // Workflow metrics
                        "workflow_success",
                        "workflow_tasks_completed",
                        "workflow_backoff_timer",
                        "workflow_task_attempt",
                        // Error metrics
                        "client_errors",
                        // Latency metrics
                        "service_latency",
                        "persistence_latency",
                        "task_schedule_to_start_latency",
                        "activity_end_to_end_latency",
                        // Resource/health metrics
                        "pending_tasks",
                        "cache_miss",
                        "num_goroutines",
                        "memory_heap",
                      ],
                      tags: ["service:temporal"],
                    },
                  ],
                },
              }),
            },
          },
          // Set resource requests and limits for all Temporal server components
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
          // Set resource requests and limits for Cassandra
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
