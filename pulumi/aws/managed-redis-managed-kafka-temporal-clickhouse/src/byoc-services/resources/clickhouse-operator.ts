import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface OperatorArgs {
  /**
   * Namespace to deploy the operator into.
   * Defaults to "clickhouse-operator"
   */
  namespace?: string;

  /**
   * Version of the operator chart to install.
   * If not specified, uses the latest version.
   */
  chartVersion?: string;

  /**
   * Resource requests for the operator pod
   */
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };

  /**
   * Namespaces to watch for ClickHouseInstallation CRDs.
   * If not specified or empty array, the operator will watch only its own namespace.
   * To watch all namespaces cluster-wide, you need to configure RBAC appropriately.
   */
  watchNamespaces?: string[];

  /**
   * Pulumi resource options
   */
  releaseOpts: pulumi.CustomResourceOptions;
}

export interface OperatorResult {
  helmRelease: k8s.helm.v3.Release;
  namespace: string;
}

/**
 * Installs the Altinity ClickHouse Operator via Helm.
 * The operator manages ClickHouse clusters via ClickHouseInstallation CRDs.
 *
 * Repository: https://docs.altinity.com/clickhouse-operator/
 * Chart: altinity-clickhouse-operator
 * GitHub: https://github.com/Altinity/clickhouse-operator
 *
 * Helm Commands:
 * - Add repo: helm repo add clickhouse-operator https://docs.altinity.com/clickhouse-operator/
 * - Update: helm repo update
 * - List versions: helm search repo clickhouse-operator/altinity-clickhouse-operator --versions
 *
 * @param args - Operator configuration arguments
 * @returns Operator installation result
 */
export function installClickhouseOperator(args: OperatorArgs): OperatorResult {
  const namespace = args.namespace || "clickhouse-operator";

  // Default resource limits for the operator
  const defaultResources = {
    requests: {
      cpu: "100m",
      memory: "128Mi",
    },
    limits: {
      cpu: "500m",
      memory: "512Mi",
    },
  };

  const resources = args.resources || defaultResources;

  // Install the Altinity ClickHouse Operator
  const helmRelease = new k8s.helm.v3.Release(
    "clickhouse-operator",
    {
      // Use a short release name to avoid Kubernetes 63-char limit on resource names
      name: "ch-operator",
      chart: "altinity-clickhouse-operator",
      version: args.chartVersion, // If undefined, uses latest
      repositoryOpts: {
        repo: "https://docs.altinity.com/clickhouse-operator/",
      },
      namespace: namespace,
      createNamespace: true,
      values: {
        // Override the full name to keep resource names short (K8s 63-char limit)
        fullnameOverride: "ch-operator",

        // Operator configuration
        operator: {
          resources: resources,
        },
        // Metrics exporter configuration (optional)
        metrics: {
          enabled: true,
          resources: {
            requests: {
              cpu: "50m",
              memory: "64Mi",
            },
            limits: {
              cpu: "200m",
              memory: "256Mi",
            },
          },
        },
        // Watch namespaces configuration
        // The watch section is nested under configs.files.config.yaml
        ...(args.watchNamespaces && args.watchNamespaces.length > 0
          ? {
              configs: {
                files: {
                  "config.yaml": {
                    watch: {
                      namespaces: args.watchNamespaces,
                    },
                  },
                },
              },
            }
          : {}),
      },
    },
    args.releaseOpts
  );

  return {
    helmRelease,
    namespace,
  };
}
