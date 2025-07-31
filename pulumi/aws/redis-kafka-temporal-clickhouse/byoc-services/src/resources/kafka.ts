import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Installs Kafka
 *
 * @param releaseOpts - The release options
 * @returns Kafka helm resource
 */
export async function installKafka(releaseOpts: pulumi.CustomResourceOptions) {
  const kafka = new k8s.helm.v3.Release(
    "kafka",
    {
      repositoryOpts: {
        repo: "https://charts.bitnami.com/bitnami",
      },
      chart: "kafka",
      version: "32.3.8",
      namespace: "byoc-kafka",
      createNamespace: true,
      values: {
        // Enable authentication
        auth: {
          enabled: true,
          brokerUser: "moose",
          brokerPassword: "moose-password-123",
          interBrokerUser: "admin",
          interBrokerPassword: "admin-password-123",
          zookeeperUser: "zookeeper",
          zookeeperPassword: "zookeeper-password-123",
          // Enable SASL authentication
          sasl: {
            enabled: true,
            mechanism: "PLAIN",
          },
        },
        // Configure listeners using the new object format
        listeners: {
          client: {
            name: "PLAINTEXT",
            protocol: "PLAINTEXT",
            containerPort: 9092,
            sslClientAuth: "",
          },
          controller: {
            name: "CONTROLLER",
            protocol: "PLAINTEXT",
            containerPort: 9093,
            sslClientAuth: "",
          },
          interbroker: {
            name: "INTERNAL",
            protocol: "SASL_PLAINTEXT", 
            containerPort: 9094,
            sslClientAuth: "",
          },
          external: {
            name: "EXTERNAL",
            protocol: "SASL_PLAINTEXT",
            containerPort: 9095,
            sslClientAuth: "",
          },
        },
        
        // Replication settings
        defaultReplicationFactor: 3,
        offsetsTopicReplicationFactor: 1,
        transactionStateLogReplicationFactor: 1,
        transactionStateLogMinIsr: 1,
        
        // Service configuration
        service: {
          type: "ClusterIP",
          port: 9092,
        },
        
        // Enable external access if needed
        externalAccess: {
          enabled: false, // Set to true if you need external access
          service: {
            type: "LoadBalancer",
          },
        },
        controller: {
          persistence: {
            enabled: false
          },
        },
        broker: {
          persistence: {
            enabled: false
          },
        },
        
        // Persistence
        // persistence: {
        //   enabled: true,
        //   size: "8Gi",
        // },
        
        // Zookeeper configuration
        zookeeper: {
          enabled: true,
          auth: {
            enabled: true,
            serverUsers: "zookeeper",
            serverPasswords: "zookeeper-password-123",
            clientUser: "zookeeper",
            clientPassword: "zookeeper-password-123",
          },
        },
      },
    },
    {
        ...releaseOpts,
    }
  );

  // Create the secret with Kafka configuration for the application
  const kafkaConfigSecret = new k8s.core.v1.Secret(
    "sn-mds-redpanda-config",
    {
      metadata: {
        name: "sn-mds-redpanda-config",
        namespace: "boreal-system", // Change this to your application namespace
      },
      stringData: {
        "auth-url": "", // Not needed for self-hosted Kafka
        "client-id": "moose",
        "client-secret": "moose-password-123",
        "cluster-api-url": "", // Not needed for self-hosted Kafka
        "broker": "kafka.byoc-kafka.svc.cluster.local:9092", // Using PLAINTEXT listener for client connections
        "sasl-mechanism": "PLAIN",
        "replication-factor": "1",
        "message-timeout-ms": "30000",
        "security-protocol": "SASL_PLAINTEXT",
      },
    },
    {
      ...releaseOpts,
    }
  );
}
