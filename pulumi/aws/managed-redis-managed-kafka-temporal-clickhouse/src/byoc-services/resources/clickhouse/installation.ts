import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface ClickHouseInstallationArgs {
  /**
   * Name of the ClickHouse installation
   */
  name: string;

  /**
   * Namespace to deploy ClickHouse into
   */
  namespace: string;

  /**
   * Number of shards in the cluster
   */
  shards: number;

  /**
   * Number of replicas per shard
   */
  replicas: number;

  /**
   * Storage size for data volumes
   */
  storageSize: string;

  /**
   * Storage class for persistent volumes
   */
  storageClass?: string;

  /**
   * ClickHouse server image
   */
  image?: string;

  /**
   * Resource requests and limits
   */
  resources: {
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
   * Service account name (for IRSA/S3 access)
   */
  serviceAccountName?: string;

  /**
   * Enable S3 storage configuration
   */
  enableS3?: boolean;

  /**
   * S3 storage XML configuration (if enableS3 is true)
   */
  s3StorageXML?: pulumi.Input<string>;

  /**
   * ClickHouse admin password
   */
  password: pulumi.Input<string>;

  /**
   * ZooKeeper/Keeper connection string (required for replicas > 1)
   * Format: "host1:port,host2:port,host3:port"
   */
  zookeeperNodes?: pulumi.Input<string>;

  /**
   * Pulumi resource options
   */
  releaseOpts: pulumi.CustomResourceOptions;
}

/**
 * Creates a ClickHouseInstallation custom resource.
 * This CRD is managed by the Altinity ClickHouse Operator.
 *
 * @param args - ClickHouse installation arguments
 * @returns ClickHouseInstallation custom resource
 */
export function createClickHouseInstallation(
  args: ClickHouseInstallationArgs
): k8s.apiextensions.CustomResource {
  const storageClass = args.storageClass || "gp3";
  const image = args.image;
  const serviceAccountName = args.serviceAccountName || "clickhouse";

  // Build the configuration files section
  // Inline the S3 XML configuration directly (ConfigMap references don't work with the operator)
  const configFilesSpec =
    args.enableS3 && args.s3StorageXML
      ? pulumi.output(args.s3StorageXML).apply((xmlContent) => ({
          "config.d/storage.xml": xmlContent,
        }))
      : pulumi.output({});

  const installation = new k8s.apiextensions.CustomResource(
    args.name,
    {
      apiVersion: "clickhouse.altinity.com/v1",
      kind: "ClickHouseInstallation",
      metadata: {
        name: args.name,
        namespace: args.namespace,
      },
      spec: pulumi
        .all([configFilesSpec, args.zookeeperNodes || ""])
        .apply(([configFiles, zkNodes]) => ({
          configuration: {
            // Cluster configuration
            clusters: [
              {
                name: "default",
                layout: {
                  shardsCount: args.shards,
                  replicasCount: args.replicas,
                },
                // Enable inter-server authentication for distributed queries
                settings: {
                  "default/user": "default",
                  "default/password": args.password,
                },
              },
            ],
            // ZooKeeper/Keeper configuration (required for replication)
            ...(zkNodes && args.replicas > 1
              ? {
                  zookeeper: {
                    nodes: zkNodes.split(",").map((node: string) => {
                      const [host, port] = node.split(":");
                      return { host, port: parseInt(port || "9181") };
                    }),
                  },
                }
              : {}),
            // Users configuration
            users: {
              "default/password": args.password,
              "default/networks/ip": ["0.0.0.0/0"],
              "default/profile": "default",
            },
            // Settings for inter-server communication
            settings: {
              "remote_servers/default/secret": args.password,
            },
            // Configuration files (e.g., S3 storage)
            ...(Object.keys(configFiles).length > 0 ? { files: configFiles } : {}),
          },
          // Default templates to use
          defaults: {
            templates: {
              serviceTemplate: "chi-service",
              podTemplate: "pod-template",
              dataVolumeClaimTemplate: "data-volume",
            },
          },
          // Templates definition
          templates: {
            // Service template
            serviceTemplates: [
              {
                name: "chi-service",
                spec: {
                  type: "ClusterIP",
                  ports: [
                    { name: "http", port: 8123, targetPort: 8123 },
                    { name: "tcp", port: 9000, targetPort: 9000 },
                    { name: "interserver", port: 9009, targetPort: 9009 },
                  ],
                },
              },
            ],
            // Pod template
            podTemplates: [
              {
                name: "pod-template",
                spec: {
                  serviceAccountName: serviceAccountName,
                  containers: [
                    {
                      name: "clickhouse",
                      image: image,
                      ports: [
                        { name: "http", containerPort: 8123 },
                        { name: "tcp", containerPort: 9000 },
                        { name: "interserver", containerPort: 9009 },
                      ],
                      resources: {
                        requests: {
                          memory: args.resources.requests.memory,
                          cpu: args.resources.requests.cpu,
                        },
                        limits: args.resources.limits || {
                          memory: args.resources.requests.memory,
                          cpu: args.resources.requests.cpu,
                        },
                      },
                    },
                  ],
                },
              },
            ],
            // Volume claim template
            volumeClaimTemplates: [
              {
                name: "data-volume",
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
        })),
    },
    args.releaseOpts
  );

  return installation;
}

/**
 * Creates an alias service for ClickHouse with a simpler name.
 * The operator creates a service with the pattern clickhouse-{installation-name},
 * but applications may prefer a simpler name like "clickhouse".
 */
export function createClickHouseAliasService(
  installationName: string,
  serviceName: string,
  namespace: string,
  releaseOpts: pulumi.CustomResourceOptions
): k8s.core.v1.Service {
  return new k8s.core.v1.Service(
    serviceName,
    {
      metadata: {
        name: serviceName,
        namespace: namespace,
        labels: {
          app: "clickhouse",
          "clickhouse.altinity.com/chi": installationName,
        },
      },
      spec: {
        type: "ClusterIP",
        selector: {
          "clickhouse.altinity.com/chi": installationName,
        },
        ports: [
          { name: "http", port: 8123, targetPort: 8123 },
          { name: "tcp", port: 9000, targetPort: 9000 },
          { name: "interserver", port: 9009, targetPort: 9009 },
        ],
      },
    },
    releaseOpts
  );
}
