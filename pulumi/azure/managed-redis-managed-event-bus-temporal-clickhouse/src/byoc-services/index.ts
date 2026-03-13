import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createAzureRedis } from "./resources/redis";
import { createEventHub } from "./resources/eventhub";
import { installTemporal } from "./resources/temporal";
import { deployClickhouse } from "./resources/clickhouse";

async function main() {
  const stackName = pulumi.getStack();
  const projectName = pulumi.getProject();

  const config = new pulumi.Config();

  const orgId = config.require("orgId");

  const commonTags: { [k: string]: string } = {
    Cloud: config.require("tagCloud"),
    Environment: config.require("tagEnvironment"),
    Project: projectName,
    Stack: stackName,
    OrgId: orgId,
  };

  const baseStack = new pulumi.StackReference("base", {
    name: `514labs/${projectName}/base`,
  });

  const resourceGroupName = baseStack.getOutput("resourceGroupName") as pulumi.Output<string>;
  const aksClusterName = baseStack.getOutput("aksClusterName") as pulumi.Output<string>;
  const kubeconfigOutput = baseStack.getOutput("kubeconfig") as pulumi.Output<string>;
  const privateSubnetIdOutput = baseStack.getOutput("privateSubnetId") as pulumi.Output<string>;
  const publicSubnetIdOutput = baseStack.getOutput("publicSubnetId") as pulumi.Output<string>;
  const isolatedSubnetIdOutput = baseStack.getOutput("isolatedSubnetId") as pulumi.Output<string>;

  /// Azure Configuration
  const location = config.get("azure-native:location") || "centralus";
  console.log("Location: ", location);

  /// Redis Configuration
  const redisServiceType = config.get("redisServiceType") || "cache";
  const redisSkuName =
    config.get("redisSkuName") || (redisServiceType === "managed" ? "Balanced" : "Standard");
  const redisSkuFamily = config.get("redisSkuFamily") || "C";
  // For managed Redis, capacity can be a string (e.g., "B10", "M10") or number (legacy)
  const redisSkuCapacityRaw =
    config.get("redisSkuCapacity") || (redisServiceType === "managed" ? "B10" : "1");
  const redisSkuCapacity =
    redisServiceType === "managed" && isNaN(parseInt(redisSkuCapacityRaw))
      ? redisSkuCapacityRaw // Use as string if it's not a number (e.g., "B10", "M10")
      : parseInt(redisSkuCapacityRaw); // Parse as number for cache or legacy managed configs
  const redisEnableNonSsl = config.getBoolean("redisEnableNonSsl") || false;
  const redisEnableModules = config
    .get("redisEnableModules")
    ?.split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  const redisEvictionPolicy = config.get("redisEvictionPolicy") || "allkeys-lru";

  /// Temporal Configuration
  const temporalReplicas = parseInt(config.get("temporalReplicas") || "3");
  const temporalCassandraReplicas = parseInt(config.get("temporalCassandraReplicas") || "3");
  const temporalElasticsearchReplicas = parseInt(
    config.get("temporalElasticsearchReplicas") || "3"
  );
  const temporalNamespaceRetention = parseInt(config.get("temporalNamespaceRetention") || "7");
  const temporalCassandraStorageSize = config.get("temporalCassandraStorageSize") || "50Gi";
  const temporalElasticsearchStorageSize =
    config.get("temporalElasticsearchStorageSize") || "100Gi";

  /// Event Hub Configuration
  const eventHubSkuName = config.get("eventHubSkuName") || "Standard";
  const eventHubSkuTier = config.get("eventHubSkuTier") || "Standard";
  const eventHubSkuCapacity = parseInt(config.get("eventHubSkuCapacity") || "2");
  const eventHubMaxThroughputUnits = parseInt(config.get("eventHubMaxThroughputUnits") || "10");
  const eventHubPartitions = parseInt(config.get("eventHubPartitions") || "8");
  const eventHubMessageRetention = parseInt(config.get("eventHubMessageRetention") || "7");

  /// Clickhouse Configuration
  const clickhouseShards = parseInt(config.get("clickhouseShards") || "2");
  const clickhouseReplicas = parseInt(config.get("clickhouseReplicas") || "2");
  const clickhouseStorageSize = config.get("clickhouseStorageSize") || "200Gi";
  const clickhouseRequestedCpu = config.get("clickhouseRequestedCpu") || "2000m";
  const clickhouseLimitCpu = config.get("clickhouseLimitCpu") || "4000m";
  const clickhouseRequestedMemory = config.get("clickhouseRequestedMemory") || "4Gi";
  const clickhouseLimitMemory = config.get("clickhouseLimitMemory") || "8Gi";

  // Managed Namespace limits (should be higher than pod limits)
  const clickhouseNamespaceCpuRequest = config.get("clickhouseNamespaceCpuRequest") || "4000m";
  const clickhouseNamespaceCpuLimit = config.get("clickhouseNamespaceCpuLimit") || "8000m";
  const clickhouseNamespaceMemoryRequest = config.get("clickhouseNamespaceMemoryRequest") || "8Gi";
  const clickhouseNamespaceMemoryLimit = config.get("clickhouseNamespaceMemoryLimit") || "16Gi";

  // Create k8s provider with kubeconfig Output
  const k8sProvider = new k8s.Provider("k8s-provider", { kubeconfig: kubeconfigOutput });

  await createAzureRedis({
    resourceGroupName: resourceGroupName,
    location,
    k8sProvider,
    commonTags: commonTags,
    serviceType: redisServiceType as "cache" | "managed",
    skuName: redisSkuName,
    skuFamily: redisSkuFamily,
    capacity: redisServiceType === "managed" ? redisSkuCapacityRaw : redisSkuCapacity, // Pass string for managed, number for cache
    enableNonSsl: redisEnableNonSsl,
    enableModules: redisEnableModules,
    evictionPolicy: redisEvictionPolicy,
  });

  await createEventHub({
    resourceGroupName: resourceGroupName,
    location: location,
    k8sProvider: k8sProvider,
    commonTags: commonTags,
    skuName: eventHubSkuName,
    skuTier: eventHubSkuTier,
    skuCapacity: eventHubSkuCapacity,
    maximumThroughputUnits: eventHubMaxThroughputUnits,
    partitions: eventHubPartitions,
    messageRetentionInDays: eventHubMessageRetention,
  });

  await installTemporal({
    serverReplicas: temporalReplicas,
    cassandraReplicas: temporalCassandraReplicas,
    elasticsearchReplicas: temporalElasticsearchReplicas,
    namespaceRetention: temporalNamespaceRetention,
    cassandraStorageSize: temporalCassandraStorageSize,
    elasticsearchStorageSize: temporalElasticsearchStorageSize,
    releaseOpts: { provider: k8sProvider },
  });

  await deployClickhouse({
    helmArgs: {
      namespace: "byoc-clickhouse",
      clickhouseShards: clickhouseShards,
      clickhouseReplicas: clickhouseReplicas,
      clickhouseStorageSize: clickhouseStorageSize,
      cpuRequest: clickhouseRequestedCpu,
      cpuLimit: clickhouseLimitCpu,
      memoryRequest: clickhouseRequestedMemory,
      memoryLimit: clickhouseLimitMemory,
      releaseOpts: { provider: k8sProvider },
    },
  });

  return {
    resourceGroupName: resourceGroupName,
    privateSubnetId: privateSubnetIdOutput,
    publicSubnetId: publicSubnetIdOutput,
    isolatedSubnetId: isolatedSubnetIdOutput,
  };
}

export { main };
