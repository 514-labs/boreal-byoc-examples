import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface ClickHouseKeeperArgs {
  /**
   * Name of the ClickHouse Keeper installation
   */
  name: string;

  /**
   * Namespace to deploy ClickHouse Keeper into
   */
  namespace: string;

  /**
   * Number of Keeper nodes (must be odd number: 1, 3, 5, etc.)
   * Recommended: 3 for production HA
   */
  replicas: number;

  /**
   * Storage size for Keeper data
   */
  storageSize: string;

  /**
   * Storage class for persistent volumes
   */
  storageClass?: string;

  /**
   * ClickHouse Keeper image
   */
  image?: string;

  /**
   * Resource requests and limits
   */
  resources?: {
    requests: {
      cpu: string;
      memory: string;
    };
    limits?: {
      cpu: string;
      memory: string;
    };
  };

  /**
   * Pulumi resource options
   */
  releaseOpts: pulumi.CustomResourceOptions;
}

/**
 * Creates a ClickHouseKeeperInstallation custom resource.
 * ClickHouse Keeper is a coordination service for ClickHouse replication,
 * similar to ZooKeeper but specifically designed for ClickHouse.
 *
 * For HA setups with replication, you need at least 3 Keeper nodes.
 *
 * @param args - ClickHouse Keeper installation arguments
 * @returns ClickHouseKeeperInstallation custom resource
 */
export function createClickHouseKeeper(
  args: ClickHouseKeeperArgs
): k8s.apiextensions.CustomResource {
  const storageClass = args.storageClass || "gp3";
  const image = args.image || "clickhouse/clickhouse-keeper:24.11";

  // Default resources if not provided
  const defaultResources = {
    requests: {
      cpu: "100m",
      memory: "256Mi",
    },
    limits: {
      cpu: "500m",
      memory: "512Mi",
    },
  };

  const resources = args.resources || defaultResources;

  // Validate replicas is odd number
  if (args.replicas % 2 === 0) {
    throw new Error(
      `ClickHouse Keeper replicas must be an odd number (1, 3, 5, etc.). Got: ${args.replicas}`
    );
  }

  const keeper = new k8s.apiextensions.CustomResource(
    args.name,
    {
      apiVersion: "clickhouse-keeper.altinity.com/v1",
      kind: "ClickHouseKeeperInstallation",
      metadata: {
        name: args.name,
        namespace: args.namespace,
      },
      spec: {
        configuration: {
          clusters: [
            {
              name: "default",
              layout: {
                replicasCount: args.replicas,
              },
            },
          ],
          settings: {
            // Keeper settings
            "logger/level": "information",
            "logger/console": "true",
            // Coordination settings
            "coordination_settings/operation_timeout_ms": "10000",
            "coordination_settings/session_timeout_ms": "30000",
            "coordination_settings/raft_logs_level": "information",
          },
        },
        // Default templates
        defaults: {
          templates: {
            podTemplate: "keeper-pod",
            dataVolumeClaimTemplate: "keeper-data",
          },
        },
        // Templates definition
        templates: {
          // Pod template
          podTemplates: [
            {
              name: "keeper-pod",
              spec: {
                containers: [
                  {
                    name: "clickhouse-keeper",
                    image: image,
                    ports: [
                      { name: "client", containerPort: 9181 },
                      { name: "raft", containerPort: 9234 },
                    ],
                    resources: {
                      requests: resources.requests,
                      limits: resources.limits || resources.requests,
                    },
                  },
                ],
              },
            },
          ],
          // Volume claim template
          volumeClaimTemplates: [
            {
              name: "keeper-data",
              spec: {
                accessModes: ["ReadWriteOnce"],
                resources: {
                  requests: {
                    storage: args.storageSize,
                  },
                },
                storageClassName: storageClass,
              },
            },
          ],
        },
      },
    },
    args.releaseOpts
  );

  return keeper;
}

/**
 * Get the connection string for ClickHouse to connect to Keeper
 *
 * The ClickHouse Keeper operator creates services with the pattern:
 * chk-{name}-default-0-{replica}
 *
 * Port 2181 is the ZooKeeper-compatible port that ClickHouse uses
 */
export function getKeeperConnectionString(
  keeperName: string,
  namespace: string,
  replicas: number
): string {
  const hosts: string[] = [];
  for (let i = 0; i < replicas; i++) {
    hosts.push(`chk-${keeperName}-default-0-${i}.${namespace}.svc.cluster.local:2181`);
  }
  return hosts.join(",");
}
