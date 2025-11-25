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
   * Empty array means watch all namespaces (cluster-wide).
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
      chart: "altinity-clickhouse-operator",
      version: args.chartVersion, // If undefined, uses latest
      repositoryOpts: {
        repo: "https://docs.altinity.com/clickhouse-operator/",
      },
      namespace: namespace,
      createNamespace: true,
      values: {
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
        // Empty array or undefined means watch all namespaces
        ...(args.watchNamespaces && args.watchNamespaces.length > 0
          ? { watchNamespaces: args.watchNamespaces.join(",") }
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
