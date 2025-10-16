import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as azure from "@pulumi/azure-native";

interface EventHubsArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  k8sProvider: k8s.Provider;
  commonTags: { [k: string]: string };
  namespaceName?: string;
  eventHubName?: string;
  partitions?: number;
  messageRetentionInDays?: number;
  skuName?: string; // "Basic", "Standard", or "Premium"
  skuTier?: string; // "Basic", "Standard", or "Premium"
  skuCapacity?: number; // Basic/Standard: 1-20, Premium: 1-10
  maximumThroughputUnits?: number; // For auto-inflate (Standard/Premium only)
}

export async function createEventHub(args: EventHubsArgs) {
  const namespaceName = args.namespaceName ?? "boreal-byoc";
  const eventHubName = args.eventHubName ?? "boreal-byoc";
  const skuName = args.skuName ?? "Standard";
  const skuTier = args.skuTier ?? "Standard";
  const skuCapacity = args.skuCapacity ?? 2;
  const maximumThroughputUnits = args.maximumThroughputUnits ?? 10;

  // Auto-inflate is only available for Standard and Premium tiers
  const supportsAutoInflate = skuName !== "Basic";

  const ehNamespace = new azure.eventhub.Namespace("eh-namespace", {
    namespaceName: namespaceName,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    sku: { name: skuName, tier: skuTier, capacity: skuCapacity },
    isAutoInflateEnabled: supportsAutoInflate,
    maximumThroughputUnits: supportsAutoInflate ? maximumThroughputUnits : undefined,
    tags: args.commonTags,
  });

  const eventHub = new azure.eventhub.EventHub("eventhub", {
    resourceGroupName: args.resourceGroupName,
    namespaceName: ehNamespace.name,
    eventHubName: eventHubName,
    partitionCount: args.partitions ?? 8,
    messageRetentionInDays: args.messageRetentionInDays ?? 7,
  });

  const authRule = new azure.eventhub.EventHubAuthorizationRule("eh-auth", {
    resourceGroupName: args.resourceGroupName,
    namespaceName: ehNamespace.name,
    eventHubName: eventHub.name,
    rights: ["Listen", "Send", "Manage"],
  });

  const keys = azure.eventhub.listEventHubKeysOutput({
    resourceGroupName: args.resourceGroupName,
    namespaceName: ehNamespace.name,
    eventHubName: eventHub.name,
    authorizationRuleName: authRule.name,
  });

  // Produce Kafka-compatible bootstrap by using the namespace FQDN and port 9093
  const bootstrapServers = ehNamespace.name.apply((n) => `${n}.servicebus.windows.net:9093`);

  // Create Kafka config secret similar to AWS, adjusted for Event Hubs
  const secret = new k8s.core.v1.Secret(
    "sn-mds-redpanda-config",
    {
      metadata: {
        name: "sn-mds-redpanda-config",
        namespace: "boreal-system",
      },
      stringData: {
        "uses-cloud-service": "true",
        // Event Hubs Kafka clients use SASL over SSL with username `$ConnectionString` and password = connection string
        broker: bootstrapServers,
        "sasl-mechanism": "PLAIN",
        "replication-factor": "3",
        "message-timeout-ms": "30000",
        "security-protocol": "SASL_SSL",
        "sasl-admin-username": "$ConnectionString",
        "sasl-admin-password": keys.primaryConnectionString,
      },
    },
    { provider: args.k8sProvider }
  );
}
