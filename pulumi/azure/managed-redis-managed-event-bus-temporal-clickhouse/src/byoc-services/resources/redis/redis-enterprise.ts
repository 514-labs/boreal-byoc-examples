import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as azure from "@pulumi/azure-native";
/**
 * Azure Managed Redis (Redis Enterprise)
 *
 * High-performance Redis service built on Redis Enterprise.
 *
 * Key Features:
 * - Redis Enterprise (multi-threaded architecture)
 * - Up to 15x higher performance vs Azure Cache for Redis
 * - Up to 99.999% availability with Active-Active geo-replication
 * - Redis 7.4+ with latest features
 * - Advanced modules: RediSearch, RedisJSON, RedisBloom, RedisTimeSeries
 * - Independent scaling of memory and compute
 * - Good for: High-traffic production, mission-critical workloads
 *
 * SKU Naming:
 * - Azure Managed Redis uses direct SKU names: "B5", "B10", "M10", "X3", "A250", etc.
 * - B-series: Balanced (Memory + Compute) - B0, B1, B3, B5, B10, B20, B50, B100, etc.
 * - M-series: Memory Optimized - M10, M20, M50, M100, M150, M250, M350, M500, M700, M1000, M1500, M2000
 * - X-series: Compute Optimized - X3, X5, X10, X20, X50, X100, X150, X250, X350, X500, X700
 * - A-series: Flash Optimized - A250, A500, A700, A1000, A1500, A2000, A4500
 *
 * Cost: ~$251-$32,000+/mo depending on SKU (with High-Availability)
 *
 * Connection:
 * - Port: 10000 (TLS)
 * - Protocol: Standard Redis (RESP/RESP3) with OSS Cluster mode
 */

export interface RedisEnterpriseArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  k8sProvider: k8s.Provider;
  commonTags: { [k: string]: string };
  redisName?: string;
  skuName?: string; // Optimization type: "Balanced", "MemoryOptimized", "ComputeOptimized", "FlashOptimized"
  capacity?: string | number; // Instance size: "B5", "B10", "M10", "X3", "A250", etc. OR number for backward compatibility
  enableModules?: string[]; // e.g., ["RediSearch", "RedisJSON", "RedisBloom", "RedisTimeSeries"]
  evictionPolicy?: string; // Default: "allkeys-lru"
}

export async function createRedisEnterprise(args: RedisEnterpriseArgs) {
  const name = args.redisName ?? "boreal-byoc-redis";
  const evictionPolicy = args.evictionPolicy ?? "allkeys-lru";

  // Determine SKU name
  // If capacity is a string (e.g., "B5", "B10", "M10", "X3", "A250"), use it directly
  // Otherwise, construct from optimization type + size for backward compatibility
  let skuName: string;
  if (typeof args.capacity === "string") {
    // Direct SKU name provided (e.g., "B5", "B10", "M10")
    skuName = args.capacity;
  } else if (args.capacity !== undefined) {
    // Legacy: construct SKU from optimization type + number
    // Default to Balanced (B-series) if not specified
    const optimizationType = args.skuName ?? "Balanced";
    const size = args.capacity;

    // Map optimization type to series prefix
    let prefix: string;
    if (optimizationType === "MemoryOptimized" || optimizationType === "Memory Optimized") {
      prefix = "M";
    } else if (
      optimizationType === "ComputeOptimized" ||
      optimizationType === "Compute Optimized"
    ) {
      prefix = "X";
    } else if (optimizationType === "FlashOptimized" || optimizationType === "Flash Optimized") {
      prefix = "A";
    } else {
      // Default to Balanced (B-series)
      prefix = "B";
    }

    skuName = `${prefix}${size}`;
  } else {
    // Default to B10 (Balanced, 12 GB)
    skuName = "B10";
  }

  // Azure Managed Redis Enterprise Cluster
  const redisCluster = new azure.redisenterprise.RedisEnterprise("redis-enterprise-cluster", {
    clusterName: name,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    sku: {
      name: skuName,
    },
    minimumTlsVersion: "1.2",
    zones: ["1", "2", "3"], // Zone redundancy for high availability
    tags: args.commonTags,
  });

  // Redis Enterprise Database within the cluster
  const redisDatabase = new azure.redisenterprise.Database("redis-enterprise-database", {
    databaseName: "default",
    clusterName: redisCluster.name,
    resourceGroupName: args.resourceGroupName,
    clientProtocol: "Encrypted", // Use TLS
    clusteringPolicy: "OSSCluster", // OSS Cluster mode for compatibility
    evictionPolicy: evictionPolicy,
    // Enable Redis modules if specified
    modules: args.enableModules?.map((moduleName) => ({
      name: moduleName,
    })),
  });

  // Connection details
  const host = redisCluster.hostName;
  const port = pulumi.output(10000); // Default port for Redis Enterprise

  // Retrieve the primary access key using listDatabaseKeys
  const keys = azure.redisenterprise.listDatabaseKeysOutput({
    clusterName: redisCluster.name,
    databaseName: redisDatabase.name,
    resourceGroupName: args.resourceGroupName,
  });
  const password = keys.primaryKey;

  // Create Kubernetes secret with Redis configuration
  const secret = new k8s.core.v1.Secret(
    "sn-moose-cache-redis-config",
    {
      metadata: {
        name: "sn-moose-cache-redis-config",
        namespace: "boreal-system",
      },
      stringData: {
        host: host,
        port: port.apply(String),
        password: password,
        url: pulumi.interpolate`rediss://default:${password}@${host}:${port}`,
        ssl: "true",
      },
    },
    { provider: args.k8sProvider }
  );

  return {
    cluster: redisCluster,
    database: redisDatabase,
    secret: secret,
    serviceType: "managed" as const,
  };
}
