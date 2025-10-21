import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export function createDatadog(
  clusterName: string,
  datadogApiKey: pulumi.Output<string>,
  datadogAppKey: pulumi.Output<string>
) {
  // Create namespace
  const datadogNamespace = new k8s.core.v1.Namespace("datadog", {
    metadata: {
      name: "datadog",
      labels: {
        "kubernetes.io/metadata.name": "datadog",
      },
    },
  });

  // Create API key secret with the correct key name that Datadog expects
  const datadogApiKeySecret = new k8s.core.v1.Secret("datadog-api-key", {
    metadata: {
      name: "datadog-api-key",
      namespace: datadogNamespace.metadata.name,
    },
    stringData: {
      // This key MUST be named 'api-key' for Datadog to find it
      "api-key": datadogApiKey,
    },
  });

  const datadogAppKeySecret = new k8s.core.v1.Secret("datadog-app-key", {
    metadata: {
      name: "datadog-app-key",
      namespace: datadogNamespace.metadata.name,
    },
    stringData: {
      "app-key": datadogAppKey,
    },
  });

  /// exlusions can be done here by the follwowing:
  /// > name:.*
  /// > image:.*
  /// > kube_namespace:.*
  /// where ".*" is a regex to match the namespace, pod, or container name.
  const containerExcludeList = [
    "kube_namespace:default",
    "kube_namespace:kube-system",
    "kube_namespace:kube-public",
    "kube_namespace:kube-node-lease",
    "kube_namespace:gatekeeper-system",
  ].join(" ");

  // Create chart with Azure AKS configuration
  // Based on Datadog documentation for Azure AKS monitoring
  return new k8s.helm.v3.Chart(
    "datadog",
    {
      fetchOpts: {
        repo: "https://helm.datadoghq.com",
        version: "3.139.0",
      },
      namespace: datadogNamespace.metadata.name,
      chart: "datadog",
      // Add transformation to fix the APIService insecureSkipTLSVerify issue
      // AKS Automatic injects caBundle via admission webhook, which conflicts with insecureSkipTLSVerify: true
      transformations: [
        (obj: any) => {
          if (
            obj.kind === "APIService" &&
            obj.metadata?.name === "v1beta1.external.metrics.k8s.io"
          ) {
            // Set insecureSkipTLSVerify to false to be compatible with caBundle injection
            if (obj.spec) {
              obj.spec.insecureSkipTLSVerify = false;
            }
          }
        },
      ],
      values: {
        // Add tolerations for known taints
        tolerations: [{ operator: "Exists" }, { key: "orgId", operator: "Exists" }],

        // Azure AKS specific configuration
        providers: {
          aks: {
            enabled: true,
          },
        },

        // Enable Cluster Agent with metrics provider
        clusterAgent: {
          enabled: true,
          replicas: 2,
          metricsProvider: {
            // Disabled because AKS Automatic provides KEDA which already registers
            // the v1beta1.external.metrics.k8s.io APIService for HPA autoscaling
            // Having both would create a conflict
            enabled: false,
            useDatadogMetrics: false,
          },
          // Add tolerations for orgId taints
          tolerations: [{ operator: "Exists" }, { key: "orgId", operator: "Exists" }],

          /// exlusions can be done here by the follwowing:
          /// > name:.*
          /// > image:.*
          /// > kube_namespace:.*
          /// where ".*" is a regex to match the namespace, pod, or container name.
          containerExclude: containerExcludeList,
        },

        // creates agents dedicated for running the Cluster Checks instead of running in the Daemonset's agents.
        clusterChecksRunner: {
          enabled: true,
        },

        datadog: {
          // Cluster identification
          clusterName: clusterName,
          site: "us5.datadoghq.com",
          apiKeyExistingSecret: datadogApiKeySecret.metadata.name,
          appKeyExistingSecret: datadogAppKeySecret.metadata.name,

          // Azure AKS needs to ignore cilium for network policy
          ignoreAutoConfig: ["cilium"],

          asm: {
            threats: {
              enabled: true,
            },
            sca: {
              enabled: true,
            },
            iast: {
              enabled: true,
            },
          },

          containerExclude: containerExcludeList,
          containerExcludeMetrics: containerExcludeList,

          // Disable standard KSM in favor of Core KSM
          kubeStateMetricsEnabled: false,
          kubeStateMetricsCore: {
            enabled: true,
            useClusterCheckRunners: true,
          },

          // Enable container collection
          containerCollectAll: true,
          processAgent: {
            enabled: true,
            processCollection: true,
          },

          // Enable orchestrator explorer (for pod/container visibility)
          orchestratorExplorer: {
            enabled: true,
          },

          // Enable logs collection
          logs: {
            enabled: false,
          },

          // Enable APM (according to the Helm values, though may require special config)
          apm: {
            enabled: false,
            instrumentation: {
              enabled: false,
            },
          },

          sbom: {
            containerImage: {
              enabled: true,
            },
            host: {
              enabled: true,
            },
          },

          securityAgent: {
            runtime: {
              enabled: false,
            },
            compliance: {
              enabled: false,
              host_benchmark: {
                enabled: true,
              },
            },
          },

          // Enable OpenTelemetry collector
          // creates the endpoints on the datadog agents for accepts otel metrics from our apps.
          // "http://$(HOST_IP):4317" # sends to gRPC receiver on port 4317
          // "http://$(HOST_IP):4318" # sends to HTTP receiver on port 4318
          otlp: {
            receiver: {
              protocols: {
                grpc: {
                  enabled: false,
                },
                http: {
                  enabled: true,
                },
              },
            },
          },
        },

        // Enable agents with proper tolerations for all nodes
        agents: {
          enabled: true,

          // Use host network for proper hostname resolution in Azure
          useHostNetwork: true,

          // Environment variables for Azure metadata and hostname
          env: [
            {
              // Tell Datadog to use Azure instance metadata
              name: "DD_HOSTNAME_TRUST_UTS_NAMESPACE",
              value: "true",
            },
          ],

          // Comprehensive tolerations to run on all nodes
          tolerations: [
            // Tolerate ALL taints
            { operator: "Exists" },
            // Explicitly tolerate org ID and mdsPreview taints
            { key: "orgId", operator: "Exists" },
            { key: "mdsPreview", operator: "Exists" },
            // Common Azure AKS taints
            { key: "node.kubernetes.io/not-ready", operator: "Exists", effect: "NoExecute" },
            { key: "node.kubernetes.io/unreachable", operator: "Exists", effect: "NoExecute" },
            { key: "node.kubernetes.io/disk-pressure", operator: "Exists", effect: "NoSchedule" },
            { key: "node.kubernetes.io/memory-pressure", operator: "Exists", effect: "NoSchedule" },
            { key: "node.kubernetes.io/pid-pressure", operator: "Exists", effect: "NoSchedule" },
            {
              key: "node.kubernetes.io/network-unavailable",
              operator: "Exists",
              effect: "NoSchedule",
            },
            { key: "node.kubernetes.io/unschedulable", operator: "Exists", effect: "NoSchedule" },
            // Azure-specific taints
            { key: "kubernetes.azure.com/scalesetpriority", operator: "Exists" },
            { key: "CriticalAddonsOnly", operator: "Exists" },
          ],

          // Pod security settings for Azure AKS
          podSecurity: {
            securityContextConstraints: {
              create: false,
            },
            podSecurityPolicy: {
              create: false,
            },
            capabilities: [],
            privileged: false,
            allowPrivilegeEscalation: false,
          },

          // Keep RBAC for API access
          rbac: {
            create: true,
          },
        },
      },
    },
    {
      customTimeouts: {
        create: "5m",
        update: "5m",
        delete: "5m",
      },
      dependsOn: [datadogApiKeySecret],
    } as pulumi.ComponentResourceOptions
  );
}
